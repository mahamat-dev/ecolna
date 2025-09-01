import { pgTable, uuid, text, integer, jsonb, timestamp, boolean, varchar, pgEnum, primaryKey } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './identity';
import { academicYear, term, classSection, gradeLevel, subject } from './academics';

// Enums
export const fileStatus = pgEnum('file_status', ['PENDING', 'READY', 'DELETED']);
export const audienceScope = pgEnum('note_audience_scope', [
  'ALL', 'ROLE', 'STAGE', 'GRADE_LEVEL', 'CLASS_SECTION', 'SUBJECT', 'STUDENT', 'GUARDIAN'
]);

// Tables
export const fileObject = pgTable('file_object', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  storageKey: text('storage_key').notNull().unique(),
  filename: text('filename').notNull(),
  mime: text('mime').notNull(),
  sizeBytes: integer('size_bytes'),
  sha256: text('sha256'),
  uploadedByProfileId: uuid('uploaded_by_profile_id').references(() => profiles.id, { onDelete: 'set null' }),
  status: fileStatus('status').notNull().default('PENDING'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  readyAt: timestamp('ready_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  meta: jsonb('meta'),
});

export const note = pgTable('note', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  createdByProfileId: uuid('created_by_profile_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'restrict' }),
  academicYearId: uuid('academic_year_id').references(() => academicYear.id, { onDelete: 'set null' }),
  termId: uuid('term_id').references(() => term.id, { onDelete: 'set null' }),
  isPublished: boolean('is_published').notNull().default(false),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  pinUntil: timestamp('pin_until', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

export const noteTranslation = pgTable(
  'note_translation',
  {
    noteId: uuid('note_id').notNull().references(() => note.id, { onDelete: 'cascade' }),
    locale: varchar('locale', { length: 8 }).notNull(), // fr | en | ar
    title: text('title').notNull(),
    bodyMd: text('body_md'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.noteId, t.locale], name: 'pk_note_translation' }),
  })
);

export const noteAttachment = pgTable(
  'note_attachment',
  {
    noteId: uuid('note_id').notNull().references(() => note.id, { onDelete: 'cascade' }),
    fileId: uuid('file_id').notNull().references(() => fileObject.id, { onDelete: 'restrict' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.noteId, t.fileId], name: 'pk_note_attachment' }),
  })
);

export const noteAudience = pgTable('note_audience', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  noteId: uuid('note_id').notNull().references(() => note.id, { onDelete: 'cascade' }),
  scope: audienceScope('scope').notNull(),
  role: text('role'), // for scope=ROLE (ADMIN|STAFF|TEACHER|STUDENT|GUARDIAN)
  stageId: uuid('stage_id'), // nullable, no FK in this MVP
  gradeLevelId: uuid('grade_level_id').references(() => gradeLevel.id, { onDelete: 'set null' }),
  classSectionId: uuid('class_section_id').references(() => classSection.id, { onDelete: 'set null' }),
  subjectId: uuid('subject_id').references(() => subject.id, { onDelete: 'set null' }),
  studentProfileId: uuid('student_profile_id').references(() => profiles.id, { onDelete: 'set null' }),
  guardianProfileId: uuid('guardian_profile_id').references(() => profiles.id, { onDelete: 'set null' }),
});

export const noteRead = pgTable(
  'note_read',
  {
    noteId: uuid('note_id').notNull().references(() => note.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    readAt: timestamp('read_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.noteId, t.profileId], name: 'pk_note_read' }),
  })
);