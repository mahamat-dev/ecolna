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
  "image/png",
  "image/jpeg",
  "image/webp"
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
    locale: z.enum(["fr", "en", "ar"]),
    title: z.string().min(1).max(200),
    bodyMd: z.string().max(100_000).optional().nullable(),
  })).min(1),
  attachments: z.array(z.string().uuid()).default([]),
  audiences: z.array(z.object({
    scope: z.enum(["ALL", "ROLE", "STAGE", "GRADE_LEVEL", "CLASS_SECTION", "SUBJECT", "STUDENT", "GUARDIAN"]),
    role: z.enum(["ADMIN", "STAFF", "TEACHER", "STUDENT", "GUARDIAN"]).optional(),
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
  mine: z.enum(["true", "false"]).optional(),
  audience: z.enum(["mine", "any"]).optional().default("any"),
  isPublished: z.enum(["true", "false"]).optional(),
  q: z.string().optional(),
  yearId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(), // ISO timestamp for publishedAt (desc)
  locale: z.enum(["fr", "en", "ar"]).optional(),
});