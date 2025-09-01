import { Router } from "express";
import { z } from "zod";
import { db } from "../../db/client";
import {
  note, noteTranslation, noteAttachment, noteAudience, noteRead, fileObject
} from "../../db/schema/content";
import { CreateNoteDto, UpdateNoteDto, PublishDto, ListNotesQuery } from "./dto";
import { requireAuth } from "../../middlewares/rbac";
import { and, desc, eq, lt } from "drizzle-orm";
import { canViewNote, rolesOfUser } from "./perm";
import { writeAudit, actorFromReq } from "../admin-utils/audit.service";
import { presignGet } from "./storage";

export const notesRouter = Router();
notesRouter.use(requireAuth);

async function viewerFromReq(req: any) {
  const userId = req.session?.user?.id;
  const profileId = req.session?.profileId;
  const roles = await rolesOfUser(userId);
  return { userId, profileId, roles };
}

notesRouter.post("/notes", async (req, res, next) => {
  try {
    const dto = CreateNoteDto.parse(req.body);
    const viewer = await viewerFromReq(req);
    if (!(viewer.roles.includes("ADMIN") || viewer.roles.includes("STAFF") || viewer.roles.includes("TEACHER"))) {
      return res.status(403).json({ error: { code: "NOT_ALLOWED", message: "Not allowed" } });
    }

    const noteRows = await db.insert(note).values({
      createdByProfileId: viewer.profileId,
      academicYearId: dto.academicYearId ?? null,
      termId: dto.termId ?? null,
      pinUntil: dto.pinUntil ?? null,
    }).returning();

    const n = noteRows[0];
    if (!n) {
      return res.status(500).json({ error: { code: "INSERT_FAILED", message: "Failed to create note" } });
    }

    if (dto.translations?.length) {
      await db.insert(noteTranslation).values(dto.translations.map(t => ({
        noteId: n.id, locale: t.locale, title: t.title, bodyMd: t.bodyMd ?? null
      })));
    }
    if (dto.attachments?.length) {
      await db.insert(noteAttachment).values(dto.attachments.map(fid => ({ noteId: n.id, fileId: fid })));
    }
    await db.insert(noteAudience).values(dto.audiences.map(a => ({
      noteId: n.id,
      scope: a.scope as any, role: a.role ?? null,
      stageId: a.stageId ?? null, gradeLevelId: a.gradeLevelId ?? null,
      classSectionId: a.classSectionId ?? null, subjectId: a.subjectId ?? null,
      studentProfileId: a.studentProfileId ?? null, guardianProfileId: a.guardianProfileId ?? null
    })));

    const actor = actorFromReq(req);
    await writeAudit(db, {
      action: "NOTE_CREATE", entityType: "NOTE", entityId: n.id,
      summary: "Note created", meta: { translations: dto.translations.map(t => t.locale), attachments: dto.attachments?.length ?? 0 },
      actorUserId: actor.userId, actorRoles: actor.roles, ip: actor.ip
    });

    res.status(201).json(n);
  } catch (e) {
    next(e);
  }
});

notesRouter.patch("/notes/:id", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const dto = UpdateNoteDto.parse(req.body);
    const noteRows = await db.select().from(note).where(eq(note.id, id));
    const n = noteRows[0];
    if (!n) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Note not found" } });

    const viewer = await viewerFromReq(req);
    const canEdit = viewer.roles.includes("ADMIN") || viewer.roles.includes("STAFF") || viewer.profileId === n.createdByProfileId;
    if (!canEdit) return res.status(403).json({ error: { code: "NOT_ALLOWED", message: "Not allowed" } });

    if (dto.academicYearId !== undefined || dto.termId !== undefined || "pinUntil" in dto) {
      await db.update(note).set({
        academicYearId: dto.academicYearId ?? n.academicYearId,
        termId: dto.termId ?? n.termId,
        pinUntil: dto.pinUntil ?? n.pinUntil,
        updatedAt: new Date()
      }).where(eq(note.id, id));
    }

    if (dto.translations) {
      for (const t of dto.translations) {
        await db.insert(noteTranslation).values({ noteId: id, locale: t.locale, title: t.title, bodyMd: t.bodyMd ?? null })
          .onConflictDoUpdate({ target: [noteTranslation.noteId, noteTranslation.locale],
            set: { title: t.title, bodyMd: t.bodyMd ?? null } });
      }
    }
    if (dto.attachments) {
      await db.delete(noteAttachment).where(eq(noteAttachment.noteId, id));
      if (dto.attachments.length) {
        await db.insert(noteAttachment).values(dto.attachments.map(fid => ({ noteId: id, fileId: fid })));
      }
    }
    if (dto.audiences) {
      await db.delete(noteAudience).where(eq(noteAudience.noteId, id));
      await db.insert(noteAudience).values(dto.audiences.map(a => ({
        noteId: id, scope: a.scope as any, role: a.role ?? null, stageId: a.stageId ?? null,
        gradeLevelId: a.gradeLevelId ?? null, classSectionId: a.classSectionId ?? null, subjectId: a.subjectId ?? null,
        studentProfileId: a.studentProfileId ?? null, guardianProfileId: a.guardianProfileId ?? null
      })));
    }

    const actor = actorFromReq(req);
    await writeAudit(db, {
      action: "NOTE_UPDATE", entityType: "NOTE", entityId: id, summary: "Note updated",
      actorUserId: actor.userId, actorRoles: actor.roles, ip: actor.ip
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

notesRouter.post("/notes/:id/publish", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const { publish } = PublishDto.parse(req.body);
    const noteRows = await db.select().from(note).where(eq(note.id, id));
    const n = noteRows[0];
    if (!n) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Note not found" } });

    const viewer = await viewerFromReq(req);
    const can = viewer.roles.includes("ADMIN") || viewer.roles.includes("STAFF") || viewer.profileId === n.createdByProfileId;
    if (!can) return res.status(403).json({ error: { code: "NOT_ALLOWED", message: "Not allowed" } });

    const updRows = await db.update(note).set({
      isPublished: publish, publishedAt: publish ? new Date() : null, updatedAt: new Date()
    }).where(eq(note.id, id)).returning();

    const upd = updRows[0];
    if (!upd) {
      return res.status(500).json({ error: { code: "UPDATE_FAILED", message: "Failed to update note" } });
    }

    const actor = actorFromReq(req);
    await writeAudit(db, {
      action: publish ? "NOTE_PUBLISH" : "NOTE_UNPUBLISH",
      entityType: "NOTE",
      entityId: id,
      summary: publish ? "Note published" : "Note unpublished",
      actorUserId: actor.userId, actorRoles: actor.roles, ip: actor.ip
    });

    res.json(upd);
  } catch (e) {
    next(e);
  }
});

notesRouter.get("/notes/:id", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const locale = (req.query.locale as "fr" | "en" | "ar") || (req as any).locale || "fr";
    const noteRows = await db.select().from(note).where(eq(note.id, id));
    const n = noteRows[0];
    if (!n) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Note not found" } });

    const viewer = await viewerFromReq(req);
    if (!(await canViewNote(viewer, id)) && !(viewer.profileId === n.createdByProfileId)) {
      return res.status(403).json({ error: { code: "NOT_ALLOWED", message: "Access denied" } });
    }

    const trs = await db.select().from(noteTranslation).where(eq(noteTranslation.noteId, id));
    const pick = trs.find(t => t.locale === locale)
      || trs.find(t => t.locale === "fr")
      || trs.find(t => t.locale === "en")
      || trs[0] || null;

    const atts = await db.select({
      id: fileObject.id, filename: fileObject.filename, mime: fileObject.mime, sizeBytes: fileObject.sizeBytes, storageKey: fileObject.storageKey
    }).from(noteAttachment).leftJoin(fileObject, eq(noteAttachment.fileId, fileObject.id))
      .where(eq(noteAttachment.noteId, id));

    const links = await Promise.all(atts.map(async a => {
      if (!a.storageKey || !a.filename) return null;
      const { url } = await presignGet(a.storageKey, a.filename);
      return { fileId: a.id, filename: a.filename, mime: a.mime, sizeBytes: a.sizeBytes, url };
    }));

    res.json({
      id: n.id,
      isPublished: n.isPublished,
      publishedAt: n.publishedAt,
      pinUntil: n.pinUntil,
      translation: pick ? { locale: pick.locale, title: pick.title, bodyMd: pick.bodyMd } : null,
      attachments: links.filter(Boolean)
    });
  } catch (e) {
    next(e);
  }
});

notesRouter.get("/notes", async (req, res, next) => {
  try {
    const q = ListNotesQuery.parse(req.query);
    const viewer = await viewerFromReq(req);

    const conds: any[] = [];
    conds.push(eq(note.isPublished, q.isPublished ? q.isPublished === "true" : true));
    if (q.yearId) conds.push(eq(note.academicYearId, q.yearId));
    if (q.cursor) conds.push(lt(note.publishedAt, new Date(q.cursor) as any));

    const rows = await db.select().from(note)
      .where(conds.length ? (and as any)(...conds) : undefined)
      .orderBy(desc(note.pinUntil), desc(note.publishedAt))
      .limit(q.limit);

    const visible = [];
    for (const n of rows) {
      const can = await canViewNote(viewer, n.id) || (q.mine === "true" && viewer.profileId === n.createdByProfileId);
      if (!can) continue;
      const trs = await db.select().from(noteTranslation).where(eq(noteTranslation.noteId, n.id));
      const pick = trs.find(t => t.locale === (q.locale ?? (req as any).locale ?? "fr"))
        || trs.find(t => t.locale === "fr") || trs.find(t => t.locale === "en") || trs[0] || null;
      if (q.q && pick) {
        const hay = `${pick.title} ${pick.bodyMd ?? ""}`.toLowerCase();
        if (!hay.includes(q.q.toLowerCase())) continue;
      }
      visible.push({
        id: n.id, isPublished: n.isPublished, publishedAt: n.publishedAt, pinUntil: n.pinUntil,
        title: pick?.title ?? "(no title)", locale: pick?.locale ?? "fr"
      });
    }

    const lastRow = rows[rows.length - 1];
    const nextCursor = lastRow?.publishedAt?.toISOString() ?? null;
    res.json({ items: visible, nextCursor });
  } catch (e) {
    next(e);
  }
});

notesRouter.post("/notes/:id/read", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const profileId = (req.session as any).profileId;
    await db.insert(noteRead).values({ noteId: id, profileId })
      .onConflictDoUpdate({ target: [noteRead.noteId, noteRead.profileId], set: { readAt: new Date() } });
    
    const actor = actorFromReq(req);
    await writeAudit(db, {
      action: "NOTE_READ", entityType: "NOTE", entityId: id, summary: "Note read",
      actorUserId: actor.userId, actorRoles: actor.roles, ip: actor.ip
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

notesRouter.delete("/notes/:id", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const noteRows = await db.select().from(note).where(eq(note.id, id));
    const n = noteRows[0];
    if (!n) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Note not found" } });

    const viewer = await viewerFromReq(req);
    const can = viewer.roles.includes("ADMIN") || viewer.roles.includes("STAFF") || viewer.profileId === n.createdByProfileId;
    if (!can) return res.status(403).json({ error: { code: "NOT_ALLOWED", message: "Not allowed" } });

    await db.delete(note).where(eq(note.id, id));
    
    const actor = actorFromReq(req);
    await writeAudit(db, {
      action: "NOTE_DELETE", entityType: "NOTE", entityId: id, summary: "Note deleted",
      actorUserId: actor.userId, actorRoles: actor.roles, ip: actor.ip
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});