import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/client';
import { profiles, message, messageRecipient } from '../../db/schema';
import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import { requireAuth } from '../../middlewares/rbac';
import { validate } from '../../middlewares/validate';
import { SendMessageDto, ListQuery } from './dto';

export const messagesRouter = Router();

async function viewerFromReq(req: any) {
  const userId: string | undefined = req.session?.user?.id;
  if (!userId) throw Object.assign(new Error('Not authenticated'), { status: 401 });
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  if (!profile) throw Object.assign(new Error('Profile not found'), { status: 400 });
  return { userId, profileId: profile.id };
}

// Send message to one or many recipients
messagesRouter.post('/send', requireAuth, validate(SendMessageDto), async (req, res) => {
  try {
    const viewer = await viewerFromReq(req);
    const { recipients, subject, body } = req.body as z.infer<typeof SendMessageDto>;

    const [msg] = await db.insert(message).values({ senderProfileId: viewer.profileId, subject: subject ?? null, body }).returning();
    if (!msg) return res.status(500).json({ error: { message: 'Failed to send message' } });

    await db.insert(messageRecipient).values(recipients.map(rid => ({ messageId: msg.id, recipientProfileId: rid })));
    res.status(201).json({ id: msg.id });
  } catch (e: any) {
    res.status(e.status ?? 400).json({ error: { message: e.message ?? 'Bad request' } });
  }
});

// Inbox
messagesRouter.get('/inbox', requireAuth, async (req, res) => {
  try {
    const viewer = await viewerFromReq(req);
    const { limit, cursor } = ListQuery.parse(req.query);

    const base = db.select({
      id: message.id,
      subject: message.subject,
      body: message.body,
      createdAt: message.createdAt,
      senderProfileId: message.senderProfileId,
      readAt: messageRecipient.readAt,
    }).from(messageRecipient)
      .innerJoin(message, eq(messageRecipient.messageId, message.id))
      .where(eq(messageRecipient.recipientProfileId, viewer.profileId))
      .orderBy(desc(message.createdAt))
      .limit(limit + 1);

    // cursor: createdAt before a given id
    let rows = await base;
    if (cursor) {
      const [cur] = await db.select({ createdAt: message.createdAt }).from(message).where(eq(message.id, cursor));
      if (cur?.createdAt) {
        rows = await db.select({
          id: message.id, subject: message.subject, body: message.body, createdAt: message.createdAt,
          senderProfileId: message.senderProfileId, readAt: messageRecipient.readAt,
        }).from(messageRecipient)
        .innerJoin(message, eq(messageRecipient.messageId, message.id))
        .where(and(eq(messageRecipient.recipientProfileId, viewer.profileId), gt(message.createdAt, new Date(0) as any), sql`${message.createdAt} < ${cur.createdAt}`))
        .orderBy(desc(message.createdAt)).limit(limit + 1);
      }
    }

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);

    // Enrich sender names
    const senderIds = Array.from(new Set(page.map(r => r.senderProfileId)));
    const senders = senderIds.length ? await db.select({ id: profiles.id, firstName: profiles.firstName, lastName: profiles.lastName })
      .from(profiles).where(inArray(profiles.id, senderIds as any)) : [];
    const senderMap = new Map(senders.map(s => [s.id, `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()] as const));

    res.json({
      items: page.map(r => ({
        id: r.id,
        subject: r.subject,
        snippet: (r.body ?? '').slice(0, 200),
        createdAt: r.createdAt,
        senderProfileId: r.senderProfileId,
        senderName: senderMap.get(r.senderProfileId) ?? '',
        readAt: r.readAt,
      })),
      nextCursor: hasMore ? page[page.length - 1]?.id : null,
    });
  } catch (e: any) {
    res.status(e.status ?? 400).json({ error: { message: e.message ?? 'Bad request' } });
  }
});

// Sent
messagesRouter.get('/sent', requireAuth, async (req, res) => {
  try {
    const viewer = await viewerFromReq(req);
    const { limit, cursor } = ListQuery.parse(req.query);
    let rows = await db.select().from(message).where(eq(message.senderProfileId, viewer.profileId)).orderBy(desc(message.createdAt)).limit(limit + 1);
    if (cursor) {
      const [cur] = await db.select({ createdAt: message.createdAt }).from(message).where(eq(message.id, cursor));
      if (cur?.createdAt) {
        rows = await db.select().from(message)
          .where(and(eq(message.senderProfileId, viewer.profileId), sql`${message.createdAt} < ${cur.createdAt}`))
          .orderBy(desc(message.createdAt)).limit(limit + 1);
      }
    }
    const hasMore = rows.length > limit;
    res.json({ items: rows.slice(0, limit), nextCursor: hasMore ? rows[limit - 1]?.id : null });
  } catch (e: any) {
    res.status(e.status ?? 400).json({ error: { message: e.message ?? 'Bad request' } });
  }
});

// Read a message (content) if recipient
messagesRouter.get('/:id', requireAuth, async (req, res) => {
  try {
    const viewer = await viewerFromReq(req);
    const id = z.string().uuid().parse(req.params.id);
    // Try as recipient first
    const [rec] = await db.select({
      id: message.id,
      subject: message.subject,
      body: message.body,
      createdAt: message.createdAt,
      senderProfileId: message.senderProfileId,
      readAt: messageRecipient.readAt,
    }).from(messageRecipient)
    .innerJoin(message, eq(messageRecipient.messageId, message.id))
    .where(and(eq(messageRecipient.recipientProfileId, viewer.profileId), eq(message.id, id)));
    if (rec) return res.json(rec);
    // Or as sender
    const [sent] = await db.select().from(message).where(and(eq(message.id, id), eq(message.senderProfileId, viewer.profileId)));
    if (!sent) return res.status(404).json({ error: { message: 'Not found' } });
    res.json({ id: sent.id, subject: sent.subject, body: sent.body, createdAt: sent.createdAt, senderProfileId: sent.senderProfileId, readAt: null });
  } catch (e: any) {
    res.status(e.status ?? 400).json({ error: { message: e.message ?? 'Bad request' } });
  }
});

// Mark read
messagesRouter.post('/:id/read', requireAuth, async (req, res) => {
  try {
    const viewer = await viewerFromReq(req);
    const id = z.string().uuid().parse(req.params.id);
    const result: any = await db.execute(sql`
      UPDATE message_recipient SET read_at = now()
      WHERE message_id = ${id} AND recipient_profile_id = ${viewer.profileId}
    `);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(e.status ?? 400).json({ error: { message: e.message ?? 'Bad request' } });
  }
});
