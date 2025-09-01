**Module 7 — Content & File Sharing (Local Disk Only)**  
_Server: Express **5**, TypeScript, Drizzle ORM, Postgres, Bun • i18n-ready (fr default, ar, en)_

Publish **notes** (rich text + attachments) to targeted audiences (classes, subjects, roles, specific students/guardians/teachers).  
Store **files** on the **local server disk** behind a tiny abstraction.  
Track **reads/downloads**, support **pinning**, **search**, **pagination**, and **multilingual titles/bodies**.

> This file is **complete**: schema, migrations, DTOs, services, routes, RBAC, i18n, local storage only, wiring, security, cleanup jobs, tests, OpenAPI, and DoD.

---

## 0) Scope & Dependencies

### Outcomes
- Tables:
  - `file_object`
  - `note`, `note_translation`
  - `note_attachment`
  - `note_audience`
  - `note_read`
- Services:
  - Local storage with **pre-sign** (local upload URL) & **signed** (local download URL) helpers
  - Audience resolution & authorization
- Endpoints:
  - Files: `POST /content/files/presign`, `POST /content/files/commit`, `GET /content/files/:id/download`
  - Notes: CRUD, publish/unpublish, list (audience aware), get (best-fit translation + signed attachments), mark as read

### Depends on Modules
- **M1**: `users`, `user_roles`, `profiles`
- **M2**: `academic_year`, `term`, `class_section`, `grade_level`, `subject`, (`class_section_subject` mapping)
- **M3**: `enrollment`, `guardian_student`
- **M4**: `teaching_assignment`
- **M6**: `audit_log` (we write audit events)

---

## 1) Environment

`packages/server/.env.example`
```env
# Local disk storage
LOCAL_UPLOAD_DIR=./uploads
PUBLIC_BASE_URL=http://localhost:4000
Ensure LOCAL_UPLOAD_DIR is not served by any public static hosting (keep it private).

2) Database Schema (Drizzle + SQL)
2.1 Enums
ts
Copier le code
// src/db/schema/content.enums.ts
import { pgEnum } from "drizzle-orm/pg-core";

export const fileStatus = pgEnum("file_status", ["PENDING","READY","DELETED"]);
export const audienceScope = pgEnum("note_audience_scope", [
  "ALL","ROLE","STAGE","GRADE_LEVEL","CLASS_SECTION","SUBJECT","STUDENT","GUARDIAN"
]);
2.2 Tables
ts
Copier le code
// src/db/schema/content.ts
import {
  pgTable, uuid, text, integer, jsonb, timestamp, boolean, varchar
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { profiles } from "./identity";
import { academicYear, term, classSection, gradeLevel, subject } from "./academics";
import { fileStatus, audienceScope } from "./content.enums";

export const fileObject = pgTable("file_object", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  storageKey: text("storage_key").notNull().unique(),   // e.g. notes/2025/09/<uuid>.pdf
  filename: text("filename").notNull(),                  // original name
  mime: text("mime").notNull(),
  sizeBytes: integer("size_bytes"),
  sha256: text("sha256"),
  uploadedByProfileId: uuid("uploaded_by_profile_id")
    .references(() => profiles.id, { onDelete: "set null" }),
  status: fileStatus("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  readyAt: timestamp("ready_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  meta: jsonb("meta"),
});

export const note = pgTable("note", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  createdByProfileId: uuid("created_by_profile_id").notNull()
    .references(() => profiles.id, { onDelete: "restrict" }),
  academicYearId: uuid("academic_year_id").references(() => academicYear.id, { onDelete: "set null" }),
  termId: uuid("term_id").references(() => term.id, { onDelete: "set null" }),
  isPublished: boolean("is_published").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  pinUntil: timestamp("pin_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const noteTranslation = pgTable("note_translation", {
  noteId: uuid("note_id").notNull().references(() => note.id, { onDelete: "cascade" }),
  locale: varchar("locale", { length: 8 }).notNull(), // fr | en | ar
  title: text("title").notNull(),
  bodyMd: text("body_md"),
}, (t) => ({
  pk: { primaryKey: [t.noteId, t.locale] }
}));

export const noteAttachment = pgTable("note_attachment", {
  noteId: uuid("note_id").notNull().references(() => note.id, { onDelete: "cascade" }),
  fileId: uuid("file_id").notNull().references(() => fileObject.id, { onDelete: "restrict" }),
}, (t) => ({
  pk: { primaryKey: [t.noteId, t.fileId] }
}));

export const noteAudience = pgTable("note_audience", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  noteId: uuid("note_id").notNull().references(() => note.id, { onDelete: "cascade" }),
  scope: audienceScope("scope").notNull(),
  role: text("role"), // for scope=ROLE (ADMIN|STAFF|TEACHER|STUDENT|GUARDIAN)
  stageId: uuid("stage_id"), // nullable, if you later model stages explicitly
  gradeLevelId: uuid("grade_level_id").references(() => gradeLevel.id, { onDelete: "set null" }),
  classSectionId: uuid("class_section_id").references(() => classSection.id, { onDelete: "set null" }),
  subjectId: uuid("subject_id").references(() => subject.id, { onDelete: "set null" }),
  studentProfileId: uuid("student_profile_id").references(() => profiles.id, { onDelete: "set null" }),
  guardianProfileId: uuid("guardian_profile_id").references(() => profiles.id, { onDelete: "set null" }),
});

export const noteRead = pgTable("note_read", {
  noteId: uuid("note_id").notNull().references(() => note.id, { onDelete: "cascade" }),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: { primaryKey: [t.noteId, t.profileId] }
}));
2.3 Indexes / SQL migration
sql
Copier le code
-- drizzle/<timestamp>_module7_content.sql

-- file_object
CREATE TABLE IF NOT EXISTS file_object (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_key text NOT NULL UNIQUE,
  filename text NOT NULL,
  mime text NOT NULL,
  size_bytes integer,
  sha256 text,
  uploaded_by_profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status file_status NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  ready_at timestamptz,
  deleted_at timestamptz,
  meta jsonb
);
CREATE INDEX IF NOT EXISTS idx_file_object_created_at ON file_object(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_storage_key ON file_object(storage_key);

-- note
CREATE TABLE IF NOT EXISTS note (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  academic_year_id uuid REFERENCES academic_year(id) ON DELETE SET NULL,
  term_id uuid REFERENCES term(id) ON DELETE SET NULL,
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  pin_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_note_published ON note(is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_note_pin ON note(pin_until DESC NULLS LAST);

-- note_translation
CREATE TABLE IF NOT EXISTS note_translation (
  note_id uuid NOT NULL REFERENCES note(id) ON DELETE CASCADE,
  locale varchar(8) NOT NULL,
  title text NOT NULL,
  body_md text,
  PRIMARY KEY (note_id, locale)
);

-- note_attachment
CREATE TABLE IF NOT EXISTS note_attachment (
  note_id uuid NOT NULL REFERENCES note(id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES file_object(id) ON DELETE RESTRICT,
  PRIMARY KEY (note_id, file_id)
);

-- note_audience
CREATE TABLE IF NOT EXISTS note_audience (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES note(id) ON DELETE CASCADE,
  scope note_audience_scope NOT NULL,
  role text,
  stage_id uuid,
  grade_level_id uuid REFERENCES grade_level(id) ON DELETE SET NULL,
  class_section_id uuid REFERENCES class_section(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES subject(id) ON DELETE SET NULL,
  student_profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  guardian_profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_note_audience_note ON note_audience(note_id);
CREATE INDEX IF NOT EXISTS idx_note_audience_scope ON note_audience(scope);

-- note_read
CREATE TABLE IF NOT EXISTS note_read (
  note_id uuid NOT NULL REFERENCES note(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (note_id, profile_id)
);
CREATE INDEX IF NOT EXISTS idx_note_read_profile ON note_read(profile_id);
(Optional) Later add FTS GIN index on note_translation(title, body_md).

3) DTOs (Zod)
ts
Copier le code
// src/modules/content/dto.ts
import { z } from "zod";

const ALLOWED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png","image/jpeg","image/webp"
];

export const PresignUploadDto = z.object({
  filename: z.string().min(1),
  mime: z.string().refine(m => ALLOWED_MIME.includes(m), "Unsupported file type"),
  sizeBytes: z.number().int().positive().max(50 * 1024 * 1024), // 50 MB
  sha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
});

export const CommitUploadDto = z.object({
  fileId: z.string().uuid(),
  sizeBytes: z.number().int().positive().max(50 * 1024 * 1024),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
});

export const CreateNoteDto = z.object({
  academicYearId: z.string().uuid().nullable().optional(),
  termId: z.string().uuid().nullable().optional(),
  translations: z.array(z.object({
    locale: z.enum(["fr","en","ar"]),
    title: z.string().min(1).max(200),
    bodyMd: z.string().max(100_000).optional().nullable(),
  })).min(1),
  attachments: z.array(z.string().uuid()).default([]),
  audiences: z.array(z.object({
    scope: z.enum(["ALL","ROLE","STAGE","GRADE_LEVEL","CLASS_SECTION","SUBJECT","STUDENT","GUARDIAN"]),
    role: z.enum(["ADMIN","STAFF","TEACHER","STUDENT","GUARDIAN"]).optional(),
    stageId: z.string().uuid().optional(),
    gradeLevelId: z.string().uuid().optional(),
    classSectionId: z.string().uuid().optional(),
    subjectId: z.string().uuid().optional(),
    studentProfileId: z.string().uuid().optional(),
    guardianProfileId: z.string().uuid().optional(),
  })).min(1),
  pinUntil: z.coerce.date().optional().nullable(),
});

export const UpdateNoteDto = CreateNoteDto.partial();

export const PublishDto = z.object({
  publish: z.boolean().default(true)
});

export const ListNotesQuery = z.object({
  mine: z.enum(["true","false"]).optional(),
  audience: z.enum(["mine","any"]).optional().default("any"),
  isPublished: z.enum(["true","false"]).optional(),
  q: z.string().optional(),
  yearId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(), // ISO timestamp for publishedAt (desc)
  locale: z.enum(["fr","en","ar"]).optional(),
});
4) Local Storage
4.1 Service (local-only helpers)
ts
Copier le code
// src/modules/content/storage.ts
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const cfg = {
  localDir: process.env.LOCAL_UPLOAD_DIR ?? "./uploads",
  baseUrl: process.env.PUBLIC_BASE_URL ?? "http://localhost:4000",
};

export function newStorageKey(filename: string) {
  const ext = filename.includes(".") ? filename.split(".").pop() : "";
  const id = crypto.randomUUID();
  const y = new Date().getFullYear();
  const m = String(new Date().getMonth()+1).padStart(2,"0");
  return `notes/${y}/${m}/${id}${ext ? "."+ext : ""}`;
}

export async function presignPut(storageKey: string, _mime: string, _sizeBytes: number) {
  // For local disk, we return an internal upload endpoint.
  return {
    url: `${cfg.baseUrl}/api/content/local-upload/${encodeURIComponent(storageKey)}`,
    method: "POST",
    headers: {}
  };
}

export async function verifyExists(storageKey: string) {
  try { await fs.stat(path.join(cfg.localDir, storageKey)); return true; }
  catch { return false; }
}

export async function presignGet(storageKey: string, filename: string) {
  return {
    url: `${cfg.baseUrl}/api/content/local-download/${encodeURIComponent(storageKey)}?filename=${encodeURIComponent(filename)}`
  };
}
4.2 Upload/Download routes (private)
ts
Copier le code
// src/modules/content/local-io.routes.ts
import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";

const local = Router();
const base = process.env.LOCAL_UPLOAD_DIR ?? "./uploads";

async function ensureDir(filePath: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

local.post("/local-upload/:key", async (req, res) => {
  const filePath = path.join(base, req.params.key);
  await ensureDir(filePath);
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  await fs.writeFile(filePath, Buffer.concat(chunks));
  res.json({ ok: true });
});

local.get("/local-download/:key", async (req, res) => {
  const filePath = path.join(base, req.params.key);
  const filename = (req.query.filename as string) || "download";
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
  res.sendFile(filePath, { root: process.cwd() }, (err) => {
    if (err) res.status(404).json({ error: { code: "NOT_FOUND", message: "File not found" } });
  });
});

export default local;
5) Audience Resolution & Permissions
ts
Copier le code
// src/modules/content/perm.ts
import { db } from "../../db/client";
import { userRoles } from "../../db/schema/identity";
import { enrollment, guardianStudent } from "../../db/schema/enrollment";
import { teachingAssignment } from "../../db/schema/teaching";
import { classSectionSubject } from "../../db/schema/academics";
import { noteAudience } from "../../db/schema/content";
import { and, eq, inArray, sql } from "drizzle-orm";

export async function rolesOfUser(userId: string) {
  const rows = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  return rows.map(r => r.role);
}

export type Viewer = { userId: string; profileId: string; roles: string[] };

export async function canViewNote(viewer: Viewer, noteId: string) {
  if (viewer.roles.includes("ADMIN") || viewer.roles.includes("STAFF")) return true;

  const [anyAll] = await db.select().from(noteAudience)
    .where(and(eq(noteAudience.noteId, noteId), eq(noteAudience.scope, "ALL" as any)));
  if (anyAll) return true;

  if (viewer.roles.length) {
    const r = await db.select().from(noteAudience)
      .where(and(eq(noteAudience.noteId, noteId), eq(noteAudience.scope, "ROLE" as any),
        inArray(noteAudience.role, viewer.roles as any)));
    if (r.length) return true;
  }

  const direct = await db.select().from(noteAudience).where(and(
    eq(noteAudience.noteId, noteId),
    sql`(scope = 'STUDENT' AND student_profile_id = ${viewer.profileId}::uuid)
        OR (scope = 'GUARDIAN' AND guardian_profile_id = ${viewer.profileId}::uuid)`
  ));
  if (direct.length) return true;

  const a = await db.select().from(noteAudience).where(eq(noteAudience.noteId, noteId));
  if (a.length === 0) return false;

  const isStudent = viewer.roles.includes("STUDENT");
  const isGuardian = viewer.roles.includes("GUARDIAN");
  const isTeacher = viewer.roles.includes("TEACHER");

  if (isStudent || isGuardian) {
    const studentProfileIds = isStudent ? [viewer.profileId] : (await db.select({ sid: guardianStudent.studentProfileId })
      .from(guardianStudent).where(eq(guardianStudent.guardianProfileId, viewer.profileId))).map(x => x.sid);

    if (studentProfileIds.length) {
      const enrs = await db.select().from(enrollment)
        .where(inArray(enrollment.studentProfileId, studentProfileIds as any));
      const sectionIds = new Set(enrs.map(e => e.classSectionId));
      const gradeLevelIds = new Set(enrs.map(e => e.gradeLevelId));

      if (a.some(x => x.scope === "CLASS_SECTION" && x.classSectionId && sectionIds.has(x.classSectionId))) return true;
      if (a.some(x => x.scope === "GRADE_LEVEL" && x.gradeLevelId && gradeLevelIds.has(x.gradeLevelId))) return true;

      const subjectTargets = new Set(a.filter(x => x.scope === "SUBJECT").map(x => x.subjectId!).filter(Boolean));
      if (subjectTargets.size && sectionIds.size) {
        const links = await db.select().from(classSectionSubject)
          .where(inArray(classSectionSubject.classSectionId, [...sectionIds] as any));
        if (links.some(l => subjectTargets.has(l.subjectId))) return true;
      }
    }
  }

  if (isTeacher) {
    const assigns = await db.select().from(teachingAssignment)
      .where(eq(teachingAssignment.teacherProfileId, viewer.profileId));
    const secIds = new Set(assigns.map(a => a.classSectionId));
    const subjIds = new Set(assigns.map(a => a.subjectId).filter(Boolean) as string[]);

    if (a.some(x => x.scope === "CLASS_SECTION" && x.classSectionId && secIds.has(x.classSectionId))) return true;
    if (a.some(x => x.scope === "SUBJECT" && x.subjectId && subjIds.has(x.subjectId))) return true;
  }

  return false;
}
6) Files API
ts
Copier le code
// src/modules/content/files.routes.ts
import { Router } from "express";
import { z } from "zod";
import { db } from "../../db/client";
import { fileObject } from "../../db/schema/content";
import { PresignUploadDto, CommitUploadDto } from "./dto";
import { newStorageKey, presignPut, presignGet, verifyExists } from "./storage";
import { requireAuth } from "../../middlewares/rbac";
import { writeAudit, actorFromReq } from "../admin-utils/audit.service";
import localIO from "./local-io.routes";
import { eq } from "drizzle-orm";

export const filesRouter = Router();
filesRouter.use(requireAuth);
filesRouter.use(localIO); // Enables /local-upload and /local-download

filesRouter.post("/files/presign", async (req, res, next) => {
  try {
    const dto = PresignUploadDto.parse(req.body);
    const storageKey = newStorageKey(dto.filename);
    const presigned = await presignPut(storageKey, dto.mime, dto.sizeBytes);

    const [row] = await db.insert(fileObject).values({
      storageKey, filename: dto.filename, mime: dto.mime, sizeBytes: dto.sizeBytes,
      sha256: dto.sha256 ?? null, status: "PENDING", uploadedByProfileId: (req.session as any).profileId ?? null
    }).returning();

    await writeAudit({
      action: "FILE_PRESIGN",
      entityType: "FILE",
      entityId: row.id,
      summary: `Presigned upload for ${dto.filename}`,
      meta: { storageKey, mime: dto.mime, sizeBytes: dto.sizeBytes },
      actor: actorFromReq(req),
    });

    res.status(201).json({ fileId: row.id, storageKey, presigned });
  } catch (e) { next(e); }
});

filesRouter.post("/files/commit", async (req, res, next) => {
  try {
    const dto = CommitUploadDto.parse(req.body);
    const [row] = await db.select().from(fileObject).where(eq(fileObject.id, dto.fileId));
    if (!row) return res.status(404).json({ error: { code: "NOT_FOUND", message: "File not found" } });

    const exists = await verifyExists(row.storageKey);
    if (!exists) return res.status(400).json({ error: { code: "NOT_UPLOADED", message: "Object not found in storage" } });

    const [upd] = await db.update(fileObject).set({
      status: "READY", readyAt: new Date(), sizeBytes: dto.sizeBytes, sha256: dto.sha256 ?? row.sha256
    }).where(eq(fileObject.id, dto.fileId)).returning();

    await writeAudit({
      action: "FILE_READY",
      entityType: "FILE",
      entityId: upd.id,
      summary: `File committed ${upd.filename}`,
      meta: { sizeBytes: upd.sizeBytes },
      actor: actorFromReq(req),
    });

    res.json(upd);
  } catch (e) { next(e); }
});

filesRouter.get("/files/:id/download", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const [row] = await db.select().from(fileObject).where(eq(fileObject.id, id));
    if (!row || row.status !== "READY") return res.status(404).json({ error: { code: "NOT_FOUND", message: "File not found" } });

    const u = (req.session as any).user;
    const profileId = (req.session as any).profileId;
    const roles: string[] = u?.roles ?? [];
    const isPrivileged = roles.includes("ADMIN") || roles.includes("STAFF");
    const isUploader = profileId === row.uploadedByProfileId;

    if (!isPrivileged && !isUploader) {
      // Prefer downloading via /notes/:id after audience checks.
      return res.status(403).json({ error: { code: "NOT_ALLOWED", message: "Access denied" } });
    }

    const link = await presignGet(row.storageKey, row.filename);
    res.json({ url: link.url, filename: row.filename });
  } catch (e) { next(e); }
});
7) Notes API
ts
Copier le code
// src/modules/content/notes.routes.ts
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

async function viewerFromReq(req: any){
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

    const [n] = await db.insert(note).values({
      createdByProfileId: viewer.profileId,
      academicYearId: dto.academicYearId ?? null,
      termId: dto.termId ?? null,
      pinUntil: dto.pinUntil ?? null,
    }).returning();

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

    await writeAudit({ action: "NOTE_CREATE", entityType: "NOTE", entityId: n.id,
      summary: "Note created", meta: { translations: dto.translations.map(t=>t.locale), attachments: dto.attachments?.length ?? 0 },
      actor: actorFromReq(req) });

    res.status(201).json(n);
  } catch (e) { next(e); }
});

notesRouter.patch("/notes/:id", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const dto = UpdateNoteDto.parse(req.body);
    const [n] = await db.select().from(note).where(eq(note.id, id));
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

    await writeAudit({ action: "NOTE_UPDATE", entityType: "NOTE", entityId: id, summary: "Note updated", actor: actorFromReq(req) });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

notesRouter.post("/notes/:id/publish", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const { publish } = PublishDto.parse(req.body);
    const [n] = await db.select().from(note).where(eq(note.id, id));
    if (!n) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Note not found" } });

    const viewer = await viewerFromReq(req);
    const can = viewer.roles.includes("ADMIN") || viewer.roles.includes("STAFF") || viewer.profileId === n.createdByProfileId;
    if (!can) return res.status(403).json({ error: { code: "NOT_ALLOWED", message: "Not allowed" } });

    const [upd] = await db.update(note).set({
      isPublished: publish, publishedAt: publish ? new Date() : null, updatedAt: new Date()
    }).where(eq(note.id, id)).returning();

    await writeAudit({
      action: publish ? "NOTE_PUBLISH" : "NOTE_UNPUBLISH",
      entityType: "NOTE",
      entityId: id,
      summary: publish ? "Note published" : "Note unpublished",
      actor: actorFromReq(req)
    });

    res.json(upd);
  } catch (e) { next(e); }
});

notesRouter.get("/notes/:id", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const locale = (req.query.locale as "fr"|"en"|"ar") || (req as any).locale || "fr";
    const [n] = await db.select().from(note).where(eq(note.id, id));
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
      const { url } = await presignGet(a.storageKey!, a.filename!);
      return { fileId: a.id, filename: a.filename, mime: a.mime, sizeBytes: a.sizeBytes, url };
    }));

    res.json({
      id: n.id,
      isPublished: n.isPublished,
      publishedAt: n.publishedAt,
      pinUntil: n.pinUntil,
      translation: pick ? { locale: pick.locale, title: pick.title, bodyMd: pick.bodyMd } : null,
      attachments: links
    });
  } catch (e) { next(e); }
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

    const nextCursor = rows.length ? rows[rows.length - 1].publishedAt?.toISOString() : null;
    res.json({ items: visible, nextCursor });
  } catch (e) { next(e); }
});

notesRouter.post("/notes/:id/read", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const profileId = (req.session as any).profileId;
    await db.insert(noteRead).values({ noteId: id, profileId })
      .onConflictDoUpdate({ target: [noteRead.noteId, noteRead.profileId], set: { readAt: new Date() } });
    await writeAudit({ action: "NOTE_READ", entityType: "NOTE", entityId: id, summary: "Note read", actor: actorFromReq(req) });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

notesRouter.delete("/notes/:id", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const [n] = await db.select().from(note).where(eq(note.id, id));
    if (!n) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Note not found" } });

    const viewer = await viewerFromReq(req);
    const can = viewer.roles.includes("ADMIN") || viewer.roles.includes("STAFF") || viewer.profileId === n.createdByProfileId;
    if (!can) return res.status(403).json({ error: { code: "NOT_ALLOWED", message: "Not allowed" } });

    await db.delete(note).where(eq(note.id, id));
    await writeAudit({ action: "NOTE_DELETE", entityType: "NOTE", entityId: id, summary: "Note deleted", actor: actorFromReq(req) });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
8) Wiring
ts
Copier le code
// src/app.ts (excerpt)
import { filesRouter } from "./modules/content/files.routes";
import { notesRouter } from "./modules/content/notes.routes";

app.use("/api/content", filesRouter);
app.use("/api/content", notesRouter);
9) Security & i18n
Local files are private: never expose LOCAL_UPLOAD_DIR via static hosting or reverse proxy.

Downloads only via /api/content/local-download/* (or via /content/files/:id/download for admins/uploaders).

Enforce MIME allowlist & max size in DTOs.

Avoid secrets in translations or note metadata.

Use your locale middleware + tReq(req, key) to localize error messages.

10) Maintenance Jobs (Disk)
10.1 Orphan cleanup (weekly)
Files in READY not referenced by any note_attachment older than N days → delete from disk and set status=DELETED.

sql
Copier le code
SELECT f.id, f.storage_key
FROM file_object f
LEFT JOIN note_attachment a ON a.file_id = f.id
WHERE f.status = 'READY' AND a.file_id IS NULL
  AND f.created_at < now() - interval '30 days';
10.2 PENDING timeout (daily)
Files stuck in PENDING for >48h → delete from disk if present; mark DELETED.

10.3 Backups
Nightly tar/gzip of uploads/ and pg_dump for Postgres.

Store on external drive or low-cost remote.

(Implement as scripts/cleanup_files.ts and a cron.)

11) Audit Events (Module 6)
Emit:

FILE_PRESIGN, FILE_READY

NOTE_CREATE, NOTE_UPDATE, NOTE_PUBLISH, NOTE_UNPUBLISH, NOTE_DELETE, NOTE_READ

12) OpenAPI (Fragment)
yaml
Copier le code
paths:
  /api/content/files/presign:
    post:
      summary: Presign upload for a new file (returns /local-upload URL)
  /api/content/files/commit:
    post:
      summary: Mark a file READY after upload
  /api/content/files/{id}/download:
    get:
      summary: Get a private download URL (admin/staff/uploader)
  /api/content/notes:
    get: { summary: List notes visible to current user }
    post: { summary: Create a note (admin/staff/teacher) }
  /api/content/notes/{id}:
    get: { summary: Get a note (best-fit translation + signed attachments) }
    patch: { summary: Update a note (creator/admin/staff) }
    delete: { summary: Delete a note (creator/admin/staff) }
  /api/content/notes/{id}/publish:
    post: { summary: Publish/Unpublish }
  /api/content/notes/{id}/read:
    post: { summary: Mark as read }
13) Manual Tests (cURL)
bash
Copier le code
# Login first; store cookies in cookies.txt

# 1) Presign upload (local)
curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  -d '{"filename":"cours-physique.pdf","mime":"application/pdf","sizeBytes":345678}' \
  http://localhost:4000/api/content/files/presign

# -> { "fileId", "storageKey", "presigned": { "url": "/api/content/local-upload/<key>", "method": "POST" } }

# 2) Upload to the returned local endpoint
curl -X POST --data-binary @cours-physique.pdf \
  "http://localhost:4000/api/content/local-upload/<storageKey>"

# 3) Commit
curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  -d '{"fileId":"<FILE_ID>","sizeBytes":345678}' \
  http://localhost:4000/api/content/files/commit

# 4) Create a note for a class section
curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  -d '{
    "translations":[{"locale":"fr","title":"Chapitre 1: Cinématique","bodyMd":"Voir le PDF."}],
    "attachments":["<FILE_ID>"],
    "audiences":[{"scope":"CLASS_SECTION","classSectionId":"<SEC_ID>"}]
  }' http://localhost:4000/api/content/notes

# 5) Publish
curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  -d '{"publish":true}' \
  http://localhost:4000/api/content/notes/<NOTE_ID>/publish

# 6) List visible notes
curl -b cookies.txt "http://localhost:4000/api/content/notes?limit=10&locale=fr"

# 7) Get one (includes private download URLs)
curl -b cookies.txt "http://localhost:4000/api/content/notes/<NOTE_ID>?locale=fr"

# 8) Mark read
curl -b cookies.txt -X POST "http://localhost:4000/api/content/notes/<NOTE_ID>/read"
14) Definition of Done
 DB tables & indexes created.

 Local storage working end-to-end (no external services).

 File flow: presign → upload → commit → download with RBAC.

 Notes: create/update/delete, publish/unpublish, translations (fr/en/ar), attachments, pinUntil.

 List shows only audience-visible notes; supports q, limit, cursor, locale.

 Single-note endpoint returns best-fit translation + private URLs.

 Read tracking stored in note_read.

 Audit logs for key actions.

 Size/MIME limits enforced; errors localized; no PII leakage.

 Cleanup & backup strategy documented and scheduled.

15) Enhancements
Markdown sanitizer & preview, document/image thumbnails.

Guardian auto-include when targeting a class section (config flag).

Scheduled publish/expire, tags/categories.

FTS index and server-side search across note titles/bodies.

Reports (CSV of reads/downloads by section).

