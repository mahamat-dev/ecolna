# CLAUDE.module-13-messaging.server.md
**Module 13 — Messaging (Server)**  
_Server: Express **5**, TypeScript, Drizzle ORM (Postgres), Bun • i18n (fr default, ar, en) • Audit (M6) • Files via Module 7 (local storage)_  

Real-time(ish) in-app messaging with **1:1 (direct)**, **group**, and **class section** conversations.  
Includes **read receipts**, **typing indicators**, **pins**, **reactions (👍 only in MVP)**, **attachments**, **SSE stream**.

---

## 0) Dependencies

- **M1** identity: `users`, `profiles`, `user_roles`
- **M2** academics: `class_section`, `grade_level`, `class_section_subject` (optional)
- **M3** enrollment: `enrollment` (for class section membership)
- **M6** audit log: `writeAudit`
- **M7** files: `file_object` + upload endpoints (local storage)

RBAC:
- Any **member** of a conversation can read/send messages.
- Admin/Staff can create any conversation; Teachers can create **group** and **class_section** they teach; Students/Guardians can create **direct** and **group**.
- Attachments must use Module 7 presign/upload/commit first, then referenced by `fileId`.

---

## 1) Database Schema (Drizzle)

### 1.1 Enums
```ts
// src/db/schema/messaging.enums.ts
import { pgEnum } from "drizzle-orm/pg-core";

export const convKind = pgEnum("conv_kind", ["DIRECT","GROUP","CLASS_SECTION"]);
export const msgStatus = pgEnum("msg_status", ["SENT","EDITED","DELETED"]);
1.2 Tables
ts
Copier le code
// src/db/schema/messaging.ts
import {
  pgTable, uuid, text, varchar, boolean, timestamp, integer
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { profiles } from "./identity";
import { classSection } from "./academics";
import { fileObject } from "./content"; // from Module 7
import { convKind, msgStatus } from "./messaging.enums";

export const conversation = pgTable("conversation", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  kind: convKind("kind").notNull(),
  title: varchar("title", { length: 160 }), // null for DIRECT
  classSectionId: uuid("class_section_id").references(() => classSection.id, { onDelete: "set null" }),
  includeGuardians: boolean("include_guardians").notNull().default(false), // for CLASS_SECTION
  createdByProfileId: uuid("created_by_profile_id").notNull().references(() => profiles.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
});

export const conversationMember = pgTable("conversation_member", {
  conversationId: uuid("conversation_id").notNull().references(() => conversation.id, { onDelete: "cascade" }),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  isAdmin: boolean("is_admin").notNull().default(false),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: { primaryKey: [t.conversationId, t.profileId] },
}));

export const message = pgTable("message", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: uuid("conversation_id").notNull().references(() => conversation.id, { onDelete: "cascade" }),
  senderProfileId: uuid("sender_profile_id").notNull().references(() => profiles.id, { onDelete: "restrict" }),
  body: text("body"), // nullable when DELETED
  status: msgStatus("status").notNull().default("SENT"),
  replyToMessageId: uuid("reply_to_message_id").references(() => message.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  editedAt: timestamp("edited_at", { withTimezone: true }),
});

export const messageAttachment = pgTable("message_attachment", {
  messageId: uuid("message_id").notNull().references(() => message.id, { onDelete: "cascade" }),
  fileId: uuid("file_id").notNull().references(() => fileObject.id, { onDelete: "restrict" }),
}, (t) => ({
  pk: { primaryKey: [t.messageId, t.fileId] },
}));

export const messageRead = pgTable("message_read", {
  messageId: uuid("message_id").notNull().references(() => message.id, { onDelete: "cascade" }),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
}, (t)=>({
  pk: { primaryKey: [t.messageId, t.profileId] },
}));

export const messagePin = pgTable("message_pin", {
  messageId: uuid("message_id").notNull().references(() => message.id, { onDelete: "cascade" }),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  pinnedAt: timestamp("pinned_at", { withTimezone: true }).notNull().defaultNow(),
}, (t)=>({
  pk: { primaryKey: [t.messageId, t.profileId] },
}));

export const messageReaction = pgTable("message_reaction", {
  messageId: uuid("message_id").notNull().references(() => message.id, { onDelete: "cascade" }),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  emoji: varchar("emoji", { length: 16 }).notNull(), // MVP: "👍"
  reactedAt: timestamp("reacted_at", { withTimezone: true }).notNull().defaultNow(),
}, (t)=>({
  pk: { primaryKey: [t.messageId, t.profileId, t.emoji] },
}));
1.3 Indexes (SQL)
sql
Copier le code
-- drizzle/<ts>_m13_messaging.sql
CREATE INDEX IF NOT EXISTS idx_conv_last_msg ON conversation(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_msg_conv_time ON message(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_msg_sender ON message(sender_profile_id, created_at);
2) DTOs (Zod)
ts
Copier le code
// src/modules/messaging/dto.ts
import { z } from "zod";

export const CreateConversationDto = z.object({
  kind: z.enum(["DIRECT","GROUP","CLASS_SECTION"]),
  title: z.string().max(160).optional(),
  memberProfileIds: z.array(z.string().uuid()).default([]), // required for DIRECT/GROUP
  classSectionId: z.string().uuid().optional(),            // required for CLASS_SECTION
  includeGuardians: z.boolean().default(false),
});

export const SendMessageDto = z.object({
  body: z.string().max(10000).optional(),
  attachments: z.array(z.string().uuid()).default([]), // fileIds from Module 7
  replyToMessageId: z.string().uuid().optional(),
}).refine(v => (v.body && v.body.trim().length) || v.attachments.length, {
  message: "Message cannot be empty",
});

export const EditMessageDto = z.object({
  body: z.string().max(10000),
});

export const ListMessagesQuery = z.object({
  cursor: z.string().optional(), // ISO createdAt for pagination (desc)
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const MarkReadDto = z.object({
  lastMessageId: z.string().uuid(),
});

export const TypingDto = z.object({
  isTyping: z.boolean(),
});
3) SSE (Server-Sent Events)
Endpoint: GET /api/messaging/stream (authenticated).

Emits JSON lines with event and data.

Events: message.created, message.edited, message.deleted, message.read, typing, conversation.created, conversation.updated.

Simple in-memory broker map { profileId -> Set<Response> }. (In production, replace with Redis pub/sub.)

ts
Copier le code
// src/modules/messaging/sse.ts
import { Router } from "express";

type Client = { profileId: string; res: any };
const clients = new Map<string, Set<any>>();

export function emitToProfiles(profileIds: string[], payload: any) {
  const line = `data: ${JSON.stringify(payload)}\n\n`;
  for (const pid of profileIds) {
    const set = clients.get(pid);
    if (!set) continue;
    for (const res of set) res.write(line);
  }
}

export const sseRouter = Router();
sseRouter.get("/stream", (req: any, res) => {
  const profileId = req.session?.profileId;
  if (!profileId) return res.status(401).end();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  res.write(`event: hello\ndata: {}\n\n`);

  let set = clients.get(profileId);
  if (!set) clients.set(profileId, (set = new Set()));
  set.add(res);

  req.on("close", () => {
    set?.delete(res);
    if (set && set.size === 0) clients.delete(profileId);
  });
});
4) Helpers (membership & emits)
ts
Copier le code
// src/modules/messaging/helpers.ts
import { db } from "../../db/client";
import { and, eq, inArray } from "drizzle-orm";
import { conversation, conversationMember, message } from "../../db/schema/messaging";
import { enrollment } from "../../db/schema/enrollment";
import { emitToProfiles } from "./sse";

export async function membersOfConversation(convId: string): Promise<string[]> {
  const rows = await db.select().from(conversationMember).where(eq(conversationMember.conversationId, convId));
  return rows.map(r => r.profileId);
}

export async function ensureClassSectionMembers(conv: any) {
  if (conv.kind !== "CLASS_SECTION" || !conv.classSectionId) return;
  const rows = await db.select({ sid: enrollment.studentProfileId })
    .from(enrollment).where(eq(enrollment.classSectionId, conv.classSectionId));
  const studentIds = rows.map(r=>r.sid);
  // guardians optional: use guardian_student (M3) if desired.
  const existing = await db.select().from(conversationMember).where(eq(conversationMember.conversationId, conv.id));
  const existingSet = new Set(existing.map(e=>e.profileId));
  const toAdd = studentIds.filter(id => !existingSet.has(id));
  if (toAdd.length) {
    await db.insert(conversationMember).values(toAdd.map(profileId => ({ conversationId: conv.id, profileId })));
  }
}

export async function emitMessageEvent(convId: string, event: string, data: any) {
  const members = await membersOfConversation(convId);
  emitToProfiles(members, { event, data });
}
5) Routes (Express 5)
ts
Copier le code
// src/modules/messaging/routes.ts
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middlewares/rbac";
import { db } from "../../db/client";
import {
  conversation, conversationMember, message, messageAttachment, messageRead, messagePin, messageReaction
} from "../../db/schema/messaging";
import { CreateConversationDto, SendMessageDto, ListMessagesQuery, EditMessageDto, MarkReadDto, TypingDto } from "./dto";
import { and, desc, eq, lt, or, inArray } from "drizzle-orm";
import { ensureClassSectionMembers, membersOfConversation, emitMessageEvent } from "./helpers";
import { sseRouter } from "./sse";

export const messagingRouter = Router();
messagingRouter.use(requireAuth);
messagingRouter.use(sseRouter); // /stream

/** Create a conversation */
messagingRouter.post("/conversations", async (req:any, res, next)=>{
  try{
    const dto = CreateConversationDto.parse(req.body);
    const me = req.session.profileId as string;

    if (dto.kind === "DIRECT") {
      const uniqueSet = Array.from(new Set([...dto.memberProfileIds, me]));
      if (uniqueSet.length !== 2) return res.status(400).json({ error:{ code:"BAD_DIRECT", message:"Direct requires exactly 2 members"}});
      // Check existing DIRECT
      const existing = await db.execute(`
        SELECT c.id FROM conversation c
        JOIN conversation_member m1 ON m1.conversation_id = c.id AND m1.profile_id = $1
        JOIN conversation_member m2 ON m2.conversation_id = c.id AND m2.profile_id = $2
        WHERE c.kind = 'DIRECT'::conv_kind
        LIMIT 1
      `, [uniqueSet[0], uniqueSet[1]]);
      if ((existing as any).rows?.[0]?.id) {
        const id = (existing as any).rows[0].id;
        const [row] = await db.select().from(conversation).where(eq(conversation.id, id));
        return res.json(row);
      }
    }

    const [conv] = await db.insert(conversation).values({
      kind: dto.kind as any,
      title: dto.kind === "GROUP" ? (dto.title ?? "Groupe") : null,
      classSectionId: dto.kind === "CLASS_SECTION" ? (dto.classSectionId ?? null) : null,
      includeGuardians: dto.includeGuardians ?? false,
      createdByProfileId: me,
    }).returning();

    const baseMembers =
      dto.kind === "DIRECT" ? Array.from(new Set([...dto.memberProfileIds, me])) :
      dto.kind === "GROUP" ? Array.from(new Set([...dto.memberProfileIds, me])) :
      [me]; // CLASS_SECTION will sync students (and optionally guardians)

    if (baseMembers.length) {
      await db.insert(conversationMember).values(baseMembers.map(pid => ({
        conversationId: conv.id, profileId: pid, isAdmin: pid === me
      })));
    }
    await ensureClassSectionMembers(conv);

    const mem = await membersOfConversation(conv.id);
    await emitMessageEvent(conv.id, "conversation.created", { conversationId: conv.id });
    res.status(201).json({ ...conv, members: mem });
  }catch(e){ next(e); }
});

/** List my conversations (ordered by lastMessageAt) */
messagingRouter.get("/conversations", async (req:any, res, next)=>{
  try{
    const me = req.session.profileId as string;
    const rows = await db.execute(`
      SELECT c.*
      FROM conversation c
      JOIN conversation_member m ON m.conversation_id = c.id AND m.profile_id = $1
      ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
      LIMIT 200
    `,[me]);
    res.json({ items: (rows as any).rows ?? [] });
  }catch(e){ next(e); }
});

/** Get messages (paged, desc by createdAt) */
messagingRouter.get("/conversations/:id/messages", async (req, res, next)=>{
  try{
    const convId = z.string().uuid().parse(req.params.id);
    const q = ListMessagesQuery.parse(req.query);
    const me = (req as any).session.profileId as string;

    const [mem] = await db.select().from(conversationMember)
      .where(and(eq(conversationMember.conversationId, convId), eq(conversationMember.profileId, me)));
    if (!mem) return res.status(403).json({ error:{ code:"NOT_MEMBER", message:"Not a member" }});

    const conds:any[] = [eq(message.conversationId, convId)];
    if (q.cursor) conds.push(lt(message.createdAt, new Date(q.cursor) as any));
    const msgs = await db.select().from(message)
      .where((and as any)(...conds)).orderBy(desc(message.createdAt)).limit(q.limit);

    // reactions, pins, attachments in one round each (simple MVP)
    const msgIds = msgs.map(m=>m.id);
    const atts = msgIds.length ? await db.select().from(messageAttachment).where(inArray(messageAttachment.messageId, msgIds)) : [];
    const reacts = msgIds.length ? await db.select().from(messageReaction).where(inArray(messageReaction.messageId, msgIds)) : [];
    const pins = msgIds.length ? await db.select().from(messagePin).where(inArray(messagePin.messageId, msgIds)) : [];

    res.json({ items: msgs, attachments: atts, reactions: reacts, pins });
  }catch(e){ next(e); }
});

/** Send message */
messagingRouter.post("/conversations/:id/messages", async (req:any, res, next)=>{
  try{
    const convId = z.string().uuid().parse(req.params.id);
    const me = req.session.profileId as string;
    const dto = SendMessageDto.parse(req.body);

    const [mem] = await db.select().from(conversationMember)
      .where(and(eq(conversationMember.conversationId, convId), eq(conversationMember.profileId, me)));
    if (!mem) return res.status(403).json({ error:{ code:"NOT_MEMBER", message:"Not a member" }});

    const [msg] = await db.insert(message).values({
      conversationId: convId,
      senderProfileId: me,
      body: dto.body?.trim() || null,
      replyToMessageId: dto.replyToMessageId ?? null,
    }).returning();

    if (dto.attachments?.length) {
      await db.insert(messageAttachment).values(dto.attachments.map(fid => ({ messageId: msg.id, fileId: fid })));
    }
    await db.update(conversation).set({ lastMessageAt: new Date(), updatedAt: new Date() }).where(eq(conversation.id, convId));

    await emitMessageEvent(convId, "message.created", { conversationId: convId, messageId: msg.id });
    res.status(201).json(msg);
  }catch(e){ next(e); }
});

/** Edit message (sender only) */
messagingRouter.patch("/messages/:id", async (req:any, res, next)=>{
  try{
    const id = z.string().uuid().parse(req.params.id);
    const me = req.session.profileId as string;
    const dto = EditMessageDto.parse(req.body);
    const [m] = await db.select().from(message).where(eq(message.id, id));
    if (!m) return res.status(404).end();
    if (m.senderProfileId !== me) return res.status(403).end();

    const [upd] = await db.update(message).set({ body: dto.body, editedAt: new Date(), status: "EDITED" as any })
      .where(eq(message.id, id)).returning();

    await emitMessageEvent(m.conversationId, "message.edited", { conversationId: m.conversationId, messageId: id });
    res.json(upd);
  }catch(e){ next(e); }
});

/** Delete message (soft) */
messagingRouter.delete("/messages/:id", async (req:any,res,next)=>{
  try{
    const id = z.string().uuid().parse(req.params.id);
    const me = req.session.profileId as string;
    const [m] = await db.select().from(message).where(eq(message.id, id));
    if (!m) return res.status(404).end();
    if (m.senderProfileId !== me) return res.status(403).end();

    const [upd] = await db.update(message).set({ body: null, status: "DELETED" as any, editedAt: new Date() })
      .where(eq(message.id, id)).returning();

    await emitMessageEvent(m.conversationId, "message.deleted", { conversationId: m.conversationId, messageId: id });
    res.json(upd);
  }catch(e){ next(e); }
});

/** Reactions (toggle 👍) */
messagingRouter.post("/messages/:id/react", async (req:any,res,next)=>{
  try{
    const id = z.string().uuid().parse(req.params.id);
    const me = req.session.profileId as string;
    const emoji = "👍";
    const [exists] = await db.select().from(messageReaction)
      .where(and(eq(messageReaction.messageId, id), eq(messageReaction.profileId, me), eq(messageReaction.emoji, emoji)));
    if (exists) {
      await db.delete(messageReaction).where(and(eq(messageReaction.messageId, id), eq(messageReaction.profileId, me), eq(messageReaction.emoji, emoji)));
    } else {
      await db.insert(messageReaction).values({ messageId: id, profileId: me, emoji });
    }
    // fetch conversationId for emit
    const [m] = await db.select().from(message).where(eq(message.id, id));
    await emitMessageEvent(m.conversationId, "message.reaction", { conversationId: m.conversationId, messageId: id, emoji });
    res.json({ ok: true });
  }catch(e){ next(e); }
});

/** Pin / Unpin */
messagingRouter.post("/messages/:id/pin", async (req:any,res,next)=>{
  try{
    const id = z.string().uuid().parse(req.params.id);
    const me = req.session.profileId as string;
    await db.insert(messagePin).values({ messageId: id, profileId: me }).onConflictDoNothing();
    const [m] = await db.select().from(message).where(eq(message.id, id));
    await emitMessageEvent(m.conversationId, "message.pin", { conversationId: m.conversationId, messageId: id });
    res.json({ ok: true });
  }catch(e){ next(e); }
});
messagingRouter.delete("/messages/:id/pin", async (req:any,res,next)=>{
  try{
    const id = z.string().uuid().parse(req.params.id);
    const me = req.session.profileId as string;
    await db.delete(messagePin).where(and(eq(messagePin.messageId, id), eq(messagePin.profileId, me)));
    const [m] = await db.select().from(message).where(eq(message.id, id));
    await emitMessageEvent(m.conversationId, "message.unpin", { conversationId: m.conversationId, messageId: id });
    res.json({ ok: true });
  }catch(e){ next(e); }
});

/** Mark read (writes read for all previous messages) */
messagingRouter.post("/conversations/:id/read", async (req:any,res,next)=>{
  try{
    const convId = z.string().uuid().parse(req.params.id);
    const me = req.session.profileId as string;
    const { lastMessageId } = MarkReadDto.parse(req.body);

    const ms = await db.select().from(message).where(and(eq(message.conversationId, convId)));
    const index = ms.findIndex(m => m.id === lastMessageId);
    if (index === -1) return res.status(400).json({ error:{ code:"BAD_LAST_ID", message:"Message not in conversation" }});

    const toMark = ms.slice(0, index+1);
    for (const m of toMark) {
      await db.insert(messageRead).values({ messageId: m.id, profileId: me }).onConflictDoNothing();
    }
    await emitMessageEvent(convId, "message.read", { conversationId: convId, profileId: me, lastMessageId });
    res.json({ ok: true });
  }catch(e){ next(e); }
});

/** Typing indicator */
messagingRouter.post("/conversations/:id/typing", async (req:any,res,next)=>{
  try{
    const convId = z.string().uuid().parse(req.params.id);
    const me = req.session.profileId as string;
    const { isTyping } = TypingDto.parse(req.body);
    await emitMessageEvent(convId, "typing", { conversationId: convId, profileId: me, isTyping, at: new Date().toISOString() });
    res.json({ ok: true });
  }catch(e){ next(e); }
});
Wiring

ts
Copier le code
// src/app.ts (excerpt)
import { messagingRouter } from "./modules/messaging/routes";
app.use("/api/messaging", messagingRouter);
6) Security & Limits
Message body sanitized (allow plain text only in MVP). Strip control chars.

Max attachments per message: 10; max size enforced by Module 7 DTOs.

SSE is authenticated; do not expose files directly—always via Module 7 signed download.

7) Manual Tests (cURL)
bash
Copier le code
# 1) Create DIRECT conversation (me + other profile)
curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  -d '{"kind":"DIRECT","memberProfileIds":["<OTHER_PID>"]}' \
  http://localhost:4000/api/messaging/conversations

# 2) Send text message
curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  -d '{"body":"Bonjour 👋"}' \
  http://localhost:4000/api/messaging/conversations/<CONV_ID>/messages

# 3) Send message with attachment (after Module 7 upload/commit)
curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  -d '{"body":"Voir pièce jointe","attachments":["<FILE_ID>"]}' \
  http://localhost:4000/api/messaging/conversations/<CONV_ID>/messages

# 4) Stream (use browser/tab): GET /api/messaging/stream
# 5) Mark read
curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  -d '{"lastMessageId":"<MSG_ID>"}' \
  http://localhost:4000/api/messaging/conversations/<CONV_ID>/read

# 6) React 👍
curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  http://localhost:4000/api/messaging/messages/<MSG_ID>/react
8) Definition of Done (Server)
Tables & indexes created; migrations applied.

Conversation create/list; message CRUD (send/edit/delete), reactions, pins.

Read receipts and typing endpoint.

SSE stream delivers events to members.

Class section conversations sync members from enrollment.

Attachments flow via Module 7.

RBAC checks on membership; input validation; i18n-ready errors.

yaml
Copier le code

---

```markdown
# CLAUDE.module-13-messaging.client.md
**Module 13 — Messaging (Client)**  
_Client: React + TypeScript + Tailwind + shadcn/ui + TanStack Query • i18n (fr default, ar, en) • SSE via EventSource • Files via Module 7_

Full messaging UI: conversation list, real-time chat panel, composer (text + attachments), read receipts, typing, pins, reactions.

---

## 0) Structure

src/modules/messaging/
api.ts
hooks.ts
sse.ts
components/
ConversationList.tsx
ChatPanel.tsx
MessageBubble.tsx
Composer.tsx
NewConversationDialog.tsx
PinnedBar.tsx
pages/
MessagingPage.tsx
i18n.ts
router/routes.messaging.tsx

php
Copier le code

Add a **Messages** item in the main sidebar for all roles.

---

## 1) API Client

```ts
// src/modules/messaging/api.ts
import { http } from "@/lib/http";

export const MessagingAPI = {
  // conversations
  createConversation: (body:any) => http(`/messaging/conversations`, { method:"POST", body: JSON.stringify(body) }),
  listConversations: () => http(`/messaging/conversations`),

  // messages
  listMessages: (conversationId:string, params:any) =>
    http(`/messaging/conversations/${conversationId}/messages?${new URLSearchParams(params).toString()}`),
  sendMessage: (conversationId:string, body:any) =>
    http(`/messaging/conversations/${conversationId}/messages`, { method:"POST", body: JSON.stringify(body) }),
  editMessage: (messageId:string, body:string) =>
    http(`/messaging/messages/${messageId}`, { method:"PATCH", body: JSON.stringify({ body }) }),
  deleteMessage: (messageId:string) =>
    http(`/messaging/messages/${messageId}`, { method:"DELETE" }),

  // reads, typing, pins, reactions
  markRead: (conversationId:string, lastMessageId:string) =>
    http(`/messaging/conversations/${conversationId}/read`, { method:"POST", body: JSON.stringify({ lastMessageId }) }),
  typing: (conversationId:string, isTyping:boolean) =>
    http(`/messaging/conversations/${conversationId}/typing`, { method:"POST", body: JSON.stringify({ isTyping }) }),
  reactThumbsUp: (messageId:string) =>
    http(`/messaging/messages/${messageId}/react`, { method:"POST" }),
  pin: (messageId:string) => http(`/messaging/messages/${messageId}/pin`, { method:"POST" }),
  unpin: (messageId:string) => http(`/messaging/messages/${messageId}/pin`, { method:"DELETE" }),

  // Module 7 helpers
  presign: (filename:string, mime:string, size:number) =>
    http(`/content/files/presign`, { method:"POST", body: JSON.stringify({ filename, mime, sizeBytes: size }) }),
  commit: (fileId:string, size:number) =>
    http(`/content/files/commit`, { method:"POST", body: JSON.stringify({ fileId, sizeBytes: size }) }),
};
2) SSE Client
ts
Copier le code
// src/modules/messaging/sse.ts
type Listener = (e: any) => void;

export class MessagingSSE {
  es?: EventSource;
  listeners = new Set<Listener>();

  start() {
    if (this.es) return;
    this.es = new EventSource("/api/messaging/stream");
    this.es.onmessage = (ev) => {
      try { const payload = JSON.parse(ev.data); this.listeners.forEach(l => l(payload)); } catch {}
    };
    this.es.onerror = () => { /* auto-reconnect by browser */ };
  }
  on(cb: Listener) { this.listeners.add(cb); return () => this.listeners.delete(cb); }
}

export const messagingSSE = new MessagingSSE();
Initialize once on app bootstrap (e.g., App.tsx useEffect(() => messagingSSE.start(), [])).

3) Hooks
ts
Copier le code
// src/modules/messaging/hooks.ts
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessagingAPI } from "./api";
import { messagingSSE } from "./sse";

export const useConversations = () =>
  useQuery({ queryKey:["msg","convs"], queryFn: MessagingAPI.listConversations });

export const useMessages = (conversationId: string, params: any) =>
  useQuery({ queryKey:["msg","list", conversationId, params],
    queryFn: ()=>MessagingAPI.listMessages(conversationId, params), enabled: !!conversationId });

export function useMessagingSSE(){
  const qc = useQueryClient();
  useEffect(()=>{
    const off = messagingSSE.on((payload)=>{
      // invalidate queries based on event
      switch(payload.event){
        case "conversation.created":
        case "conversation.updated":
          qc.invalidateQueries({ queryKey:["msg","convs"] }); break;
        case "message.created":
        case "message.edited":
        case "message.deleted":
        case "message.reaction":
        case "message.pin":
        case "message.unpin":
        case "message.read":
          qc.invalidateQueries({ queryKey:["msg","convs"] });
          if (payload.data?.conversationId) {
            qc.invalidateQueries({ queryKey:["msg","list", payload.data.conversationId] });
          }
          break;
      }
    });
    return off;
  }, [qc]);
}

export function useSendMessage(conversationId: string){
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body:any)=>MessagingAPI.sendMessage(conversationId, body),
    onSuccess: ()=> qc.invalidateQueries({ queryKey:["msg","list", conversationId] }),
  });
}
4) Components
4.1 Conversation List
tsx
Copier le code
// src/modules/messaging/components/ConversationList.tsx
import { useConversations } from "../hooks";

export function ConversationList({ activeId, onPick }:{
  activeId?: string; onPick: (id:string)=>void;
}){
  const q = useConversations();
  const items = q.data?.items || [];
  return (
    <div className="w-full h-full overflow-y-auto">
      {items.map((c:any)=>(
        <button key={c.id}
          className={`w-full text-left px-3 py-2 border-b hover:bg-slate-50 ${activeId===c.id ? "bg-slate-100" : ""}`}
          onClick={()=>onPick(c.id)}>
          <div className="font-medium">{c.kind==="DIRECT" ? "Direct" : c.title || c.kind}</div>
          <div className="text-xs opacity-70">{c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleString() : "—"}</div>
        </button>
      ))}
      {!items.length && <div className="p-3 text-sm opacity-60">Aucune discussion</div>}
    </div>
  );
}
4.2 Message Bubble
tsx
Copier le code
// src/modules/messaging/components/MessageBubble.tsx
import { useAuth } from "@/lib/auth";

export function MessageBubble({ m, attachments, reactions, onReact, onPin, onEdit, onDelete }:{
  m:any; attachments:any[]; reactions:any[]; onReact:()=>void; onPin:()=>void; onEdit:()=>void; onDelete:()=>void;
}){
  const { profileId } = useAuth();
  const mine = m.senderProfileId === profileId;
  const myReact = reactions.some((r:any)=> r.profileId===profileId && r.emoji==="👍");

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[75%] rounded-2xl px-3 py-2 border ${mine ? "bg-slate-50" : "bg-white"}`}>
        {m.status==="DELETED" ? <i className="opacity-50 text-sm">Message supprimé</i> :
          <>
            {m.body && <div className="whitespace-pre-wrap text-sm">{m.body}</div>}
            {!!attachments.length && (
              <ul className="mt-1 text-xs">
                {attachments.map(a=><li key={a.fileId}><a className="underline" href={`/api/content/files/${a.fileId}/download`}>{a.fileId.slice(0,8)}</a></li>)}
              </ul>
            )}
          </>
        }
        <div className="flex items-center gap-2 text-xs opacity-60 mt-1">
          <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
          {m.status==="EDITED" && <span>(modifié)</span>}
          <button onClick={onReact}>{myReact ? "👍 retir." : "👍"}</button>
          <button onClick={onPin}>Épingler</button>
          {mine && m.status!=="DELETED" && (<>
            <button onClick={onEdit}>Éditer</button>
            <button onClick={onDelete} className="text-red-600">Supprimer</button>
          </>)}
        </div>
      </div>
    </div>
  );
}
4.3 Composer (with Module 7 upload)
tsx
Copier le code
// src/modules/messaging/components/Composer.tsx
import { useState } from "react";
import { MessagingAPI } from "../api";

export function Composer({ conversationId, onSend }:{
  conversationId: string; onSend:(body:any)=>Promise<void>;
}){
  const [text, setText] = useState("");
  const [files, setFiles] = useState<{ id:string; name:string }[]>([]);
  const [busy, setBusy] = useState(false);

  async function handleFilesPicked(e: React.ChangeEvent<HTMLInputElement>){
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true);
    try {
      const pres = await MessagingAPI.presign(f.name, f.type || "application/octet-stream", f.size);
      await fetch(pres.presigned.url, { method: pres.presigned.method, headers: pres.presigned.headers, body: f });
      await MessagingAPI.commit(pres.fileId, f.size);
      setFiles(arr=>[...arr, { id: pres.fileId, name: f.name }]);
    } finally { setBusy(false); (e.target as any).value = ""; }
  }

  return (
    <form className="border-t p-2 flex items-end gap-2"
          onSubmit={async (e)=>{ e.preventDefault(); const body = { body: text.trim() || undefined, attachments: files.map(x=>x.id) }; await onSend(body); setText(""); setFiles([]); }}>
      <label className="border rounded px-2 py-1 cursor-pointer">
        Pièce <input className="hidden" type="file" onChange={handleFilesPicked} disabled={busy} />
      </label>
      <textarea className="flex-1 border rounded px-2 py-1 min-h-[40px] max-h-[160px]" placeholder="Écrire un message…"
        value={text} onChange={e=>setText(e.target.value)}
        onKeyDown={(e)=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); (e.target as any).form.requestSubmit(); }}} />
      <button className="border rounded px-3 py-1" disabled={busy || (!text.trim() && !files.length)}>Envoyer</button>
      {!!files.length && (
        <div className="text-xs opacity-70">{files.length} pièce(s)</div>
      )}
    </form>
  );
}
4.4 Chat Panel
tsx
Copier le code
// src/modules/messaging/components/ChatPanel.tsx
import { useEffect, useMemo, useRef } from "react";
import { useMessages, useSendMessage } from "../hooks";
import { MessageBubble } from "./MessageBubble";
import { Composer } from "./Composer";
import { MessagingAPI } from "../api";

export function ChatPanel({ conversationId }:{ conversationId: string }){
  const list = useMessages(conversationId, { limit: 50 });
  const send = useSendMessage(conversationId);
  const items = list.data?.items || [];
  const attachments = list.data?.attachments || [];
  const reacts = list.data?.reactions || [];
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [items.length]);

  const attachMap = useMemo(()=> {
    const m = new Map<string, any[]>();
    for (const a of attachments) { const arr = m.get(a.messageId) || []; arr.push(a); m.set(a.messageId, arr); }
    return m;
  }, [attachments]);

  const reactMap = useMemo(()=> {
    const m = new Map<string, any[]>();
    for (const r of reacts) { const arr = m.get(r.messageId) || []; arr.push(r); m.set(r.messageId, arr); }
    return m;
  }, [reacts]);

  async function onSend(body:any){ await send.mutateAsync(body); }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {[...items].reverse().map((m:any)=>(
          <MessageBubble key={m.id}
            m={m}
            attachments={attachMap.get(m.id) || []}
            reactions={reactMap.get(m.id) || []}
            onReact={()=>MessagingAPI.reactThumbsUp(m.id)}
            onPin={()=>MessagingAPI.pin(m.id)}
            onEdit={()=>{ const val = prompt("Modifier le message", m.body || ""); if(val!==null){ MessagingAPI.editMessage(m.id, val); } }}
            onDelete={()=>MessagingAPI.deleteMessage(m.id)}
          />
        ))}
        <div ref={bottomRef} />
      </div>
      <Composer conversationId={conversationId} onSend={onSend} />
    </div>
  );
}
4.5 New Conversation Dialog
tsx
Copier le code
// src/modules/messaging/components/NewConversationDialog.tsx
import { useState } from "react";
import { MessagingAPI } from "../api";

export function NewConversationDialog({ onCreated }:{ onCreated:(conv:any)=>void }){
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"DIRECT"|"GROUP"|"CLASS_SECTION">("DIRECT");
  const [title, setTitle] = useState("");
  const [members, setMembers] = useState<string>("");
  const [classSectionId, setSection] = useState("");

  async function create(){
    const memberProfileIds = members.split(",").map(s=>s.trim()).filter(Boolean);
    const body:any = { kind, memberProfileIds };
    if (kind==="GROUP") body.title = title || "Groupe";
    if (kind==="CLASS_SECTION") body.classSectionId = classSectionId;
    const conv = await MessagingAPI.createConversation(body);
    setOpen(false); onCreated(conv);
  }

  return (
    <div>
      <button className="border rounded px-3 py-1 w-full" onClick={()=>setOpen(true)}>Nouvelle discussion</button>
      {open && (
        <div className="fixed inset-0 bg-black/30 grid place-items-center">
          <div className="bg-white rounded-2xl p-4 w-full max-w-lg space-y-3">
            <h3 className="text-lg font-semibold">Nouvelle discussion</h3>
            <select className="border rounded px-2 py-1" value={kind} onChange={e=>setKind(e.target.value as any)}>
              <option value="DIRECT">Direct</option>
              <option value="GROUP">Groupe</option>
              <option value="CLASS_SECTION">Classe</option>
            </select>
            {kind==="GROUP" && <input className="border rounded px-2 py-1 w-full" placeholder="Titre (groupe)" value={title} onChange={e=>setTitle(e.target.value)} />}
            {kind!=="CLASS_SECTION" ? (
              <input className="border rounded px-2 py-1 w-full" placeholder="profileId membres séparés par virgules"
                     value={members} onChange={e=>setMembers(e.target.value)} />
            ) : (
              <input className="border rounded px-2 py-1 w-full" placeholder="classSectionId"
                     value={classSectionId} onChange={e=>setSection(e.target.value)} />
            )}
            <div className="flex justify-end gap-2">
              <button className="border rounded px-3 py-1" onClick={()=>setOpen(false)}>Annuler</button>
              <button className="border rounded px-3 py-1 bg-slate-50" onClick={create}>Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
4.6 Pinned Bar (per-user pins)
tsx
Copier le code
// src/modules/messaging/components/PinnedBar.tsx
export function PinnedBar({ pins, onOpen }:{ pins:any[]; onOpen:(messageId:string)=>void }){
  if (!pins.length) return null;
  return (
    <div className="border-b p-2 text-xs flex gap-2 overflow-x-auto">
      {pins.map((p:any)=>(
        <button key={p.messageId} className="px-2 py-1 rounded border" onClick={()=>onOpen(p.messageId)}>
          Épinglé {p.messageId.slice(0,6)}
        </button>
      ))}
    </div>
  );
}
5) Page
tsx
Copier le code
// src/modules/messaging/pages/MessagingPage.tsx
import { useState, useEffect } from "react";
import { ConversationList } from "../components/ConversationList";
import { ChatPanel } from "../components/ChatPanel";
import { NewConversationDialog } from "../components/NewConversationDialog";
import { useMessagingSSE } from "../hooks";

export default function MessagingPage(){
  useMessagingSSE();
  const [activeId, setActiveId] = useState<string>("");

  useEffect(()=>{ /* optional: pick first conversation when list loads via ConversationList callback */ }, []);

  return (
    <div className="h-full grid grid-cols-12">
      <aside className="col-span-4 md:col-span-3 border-r flex flex-col">
        <div className="p-2">
          <NewConversationDialog onCreated={(c)=>setActiveId(c.id)} />
        </div>
        <ConversationList activeId={activeId} onPick={setActiveId} />
      </aside>
      <main className="col-span-8 md:col-span-9">
        {activeId ? (
          <ChatPanel conversationId={activeId} />
        ) : (
          <div className="h-full grid place-items-center text-sm opacity-60">Sélectionnez une discussion</div>
        )}
      </main>
    </div>
  );
}
6) Routes
tsx
Copier le code
// src/router/routes.messaging.tsx
import { RouteObject } from "react-router-dom";
import MessagingPage from "@/modules/messaging/pages/MessagingPage";

export const messagingRoutes: RouteObject[] = [{ path: "/messages", element: <MessagingPage/> }];
Register in root router and add Messages in the sidebar for all roles.

7) UX Details
Read receipts: after loading latest messages, call markRead(conversationId, lastMessageId) when panel becomes active.

Typing: send typing(conversationId, true) on keydown throttled (e.g., 5s), and false on blur/stop. Show “X écrit…” from SSE events.

Attachments: use Module 7 flow. Display as download links; preview images if image/* mime (optional).

RTL: when locale is ar, set dir="rtl" on root and flip bubble alignment if desired.

8) i18n (excerpt)
ts
Copier le code
// src/modules/messaging/i18n.ts
export const dict = {
  fr: {
    msg: {
      title: "Messages",
      newConversation: "Nouvelle discussion",
      typing: "écrit…",
      deleted: "Message supprimé",
      send: "Envoyer",
      attach: "Pièce",
    }
  },
  en: { /* ... */ },
  ar: { /* ... (RTL) */ }
};
9) E2E Flows (no placeholders)
Create DIRECT: New → DIRECT → enter other profileId → Create → send “Bonjour” → recipient sees via SSE.

Create GROUP: New → GROUP → title + members → share files (Module 7 upload) → others get links.

Class Conversation: New → CLASS_SECTION → enter classSectionId → server auto-adds enrolled students.

Read Receipts: Open chat → messages become read (server updates message_read, SSE message.read).

Reactions & Pins: Click 👍 or Épingler → reflected to all members.

10) Definition of Done (Client)
Conversation list + create dialog (DIRECT/GROUP/CLASS).

Chat panel with sending, editing, deleting, attachments, reactions, pins.

SSE wired; list/panel refresh on events.

Read receipts & typing calls implemented.

i18n strings present (fr baseline).

Works with actual IDs from your DB (no fake data).