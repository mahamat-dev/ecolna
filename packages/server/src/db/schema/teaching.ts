import { pgTable, uuid, boolean, integer, text } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './identity';
import { academicYear, term, subject, classSection } from './academics';

export const teachingAssignment = pgTable('teaching_assignment', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

  teacherProfileId: uuid('teacher_profile_id').notNull()
    .references(() => profiles.id, { onDelete: 'restrict' }),

  classSectionId: uuid('class_section_id').notNull()
    .references(() => classSection.id, { onDelete: 'cascade' }),

  subjectId: uuid('subject_id').notNull()
    .references(() => subject.id, { onDelete: 'restrict' }),

  academicYearId: uuid('academic_year_id').notNull()
    .references(() => academicYear.id, { onDelete: 'restrict' }),

  termId: uuid('term_id').references(() => term.id, { onDelete: 'set null' }),

  isLead: boolean('is_lead').notNull().default(true),
  isHomeroom: boolean('is_homeroom').notNull().default(false),

  hoursPerWeek: integer('hours_per_week'),
  notes: text('notes'),
});