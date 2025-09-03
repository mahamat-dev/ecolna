import { pgTable, uuid, text, integer, boolean, timestamp, varchar, numeric, primaryKey } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './identity';
import { classSection } from './academics';
import { fileObject } from './content';
import { disciplineStatus, disciplineRole, disciplineActionType, disciplineVisibility } from './discipline.enums';

export const disciplineCategory = pgTable('discipline_category', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  code: varchar('code', { length: 32 }).notNull().unique(),
  defaultPoints: integer('default_points').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const disciplineCategoryTranslation = pgTable(
  'discipline_category_translation',
  {
    categoryId: uuid('category_id').notNull().references(() => disciplineCategory.id, { onDelete: 'cascade' }),
    locale: varchar('locale', { length: 8 }).notNull(),
    name: text('name').notNull(),
    description: text('description'),
  },
  (t) => ({ pk: primaryKey({ columns: [t.categoryId, t.locale], name: 'pk_discipline_category_translation' }) })
);

export const disciplineIncident = pgTable('discipline_incident', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  categoryId: uuid('category_id').references(() => disciplineCategory.id, { onDelete: 'set null' }),
  status: disciplineStatus('status').notNull().default('OPEN'),
  visibility: disciplineVisibility('visibility').notNull().default('PRIVATE'),
  summary: text('summary').notNull(),
  details: text('details'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  location: varchar('location', { length: 128 }),
  reportedByProfileId: uuid('reported_by_profile_id').notNull().references(() => profiles.id, { onDelete: 'restrict' }),
  classSectionId: uuid('class_section_id').references(() => classSection.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

export const disciplineIncidentParticipant = pgTable(
  'discipline_incident_participant',
  {
    incidentId: uuid('incident_id').notNull().references(() => disciplineIncident.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    role: disciplineRole('role').notNull(),
    note: text('note'),
  },
  (t) => ({ pk: primaryKey({ columns: [t.incidentId, t.profileId, t.role], name: 'pk_discipline_incident_participant' }) })
);

export const disciplineIncidentAttachment = pgTable(
  'discipline_incident_attachment',
  {
    incidentId: uuid('incident_id').notNull().references(() => disciplineIncident.id, { onDelete: 'cascade' }),
    fileId: uuid('file_id').notNull().references(() => fileObject.id, { onDelete: 'restrict' }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.incidentId, t.fileId], name: 'pk_discipline_incident_attachment' }) })
);

export const disciplineAction = pgTable('discipline_action', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  incidentId: uuid('incident_id').notNull().references(() => disciplineIncident.id, { onDelete: 'cascade' }),
  profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  type: disciplineActionType('type').notNull(),
  points: integer('points').notNull().default(0),
  dueAt: timestamp('due_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  comment: text('comment'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const detentionSession = pgTable('detention_session', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  title: varchar('title', { length: 128 }).notNull(),
  dateTime: timestamp('date_time', { withTimezone: true }).notNull(),
  durationMinutes: integer('duration_minutes').notNull().default(60),
  room: varchar('room', { length: 64 }),
  capacity: integer('capacity').notNull().default(30),
  createdByProfileId: uuid('created_by_profile_id').notNull().references(() => profiles.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const detentionSessionEnrollment = pgTable(
  'detention_session_enrollment',
  {
    sessionId: uuid('session_id').notNull().references(() => detentionSession.id, { onDelete: 'cascade' }),
    actionId: uuid('action_id').notNull().references(() => disciplineAction.id, { onDelete: 'cascade' }),
    studentProfileId: uuid('student_profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.sessionId, t.actionId, t.studentProfileId], name: 'pk_detention_session_enrollment' }) })
);

export const detentionSessionAttendance = pgTable(
  'detention_session_attendance',
  {
    sessionId: uuid('session_id').notNull().references(() => detentionSession.id, { onDelete: 'cascade' }),
    studentProfileId: uuid('student_profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    present: boolean('present').notNull().default(false),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.sessionId, t.studentProfileId], name: 'pk_detention_session_attendance' }) })
);

