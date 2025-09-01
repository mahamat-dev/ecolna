import { pgTable, uuid, text, date, time, boolean, integer, pgEnum, primaryKey } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { classSection, subject, term, academicYear } from './academics';
import { profiles } from './identity';
import { enrollment } from './enrollment';

export const attendanceStatusEnum = pgEnum('attendance_status', ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']);

export const attendanceSession = pgTable('attendance_session', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  classSectionId: uuid('class_section_id').notNull().references(() => classSection.id, { onDelete: 'cascade' }),
  subjectId: uuid('subject_id').references(() => subject.id, { onDelete: 'set null' }),
  academicYearId: uuid('academic_year_id').notNull().references(() => academicYear.id, { onDelete: 'restrict' }),
  termId: uuid('term_id').references(() => term.id, { onDelete: 'set null' }),
  date: date('date').notNull(),
  startsAt: time('starts_at'),
  endsAt: time('ends_at'),
  takenByProfileId: uuid('taken_by_profile_id').references(() => profiles.id, { onDelete: 'set null' }),
  isFinalized: boolean('is_finalized').notNull().default(false),
  notes: text('notes'),
});

export const attendanceRecord = pgTable(
  'attendance_record',
  {
    sessionId: uuid('session_id').notNull().references(() => attendanceSession.id, { onDelete: 'cascade' }),
    enrollmentId: uuid('enrollment_id').notNull().references(() => enrollment.id, { onDelete: 'cascade' }),
    status: attendanceStatusEnum('status').notNull(),
    minutesLate: integer('minutes_late').default(0),
    comment: text('comment'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.sessionId, t.enrollmentId], name: 'pk_attendance_record' }),
  })
);