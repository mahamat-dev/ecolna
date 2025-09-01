import { pgTable, uuid, integer, text, boolean, date, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './identity';
import { academicYear, classSection } from './academics';

export const enrollmentStatus = pgEnum('enrollment_status', [
  'ACTIVE','TRANSFERRED_OUT','WITHDRAWN','GRADUATED'
]);

export const enrollment = pgTable(
  'enrollment',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    studentProfileId: uuid('student_profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),

    classSectionId: uuid('class_section_id')
      .notNull()
      .references(() => classSection.id, { onDelete: 'restrict' }),

    academicYearId: uuid('academic_year_id')
      .notNull()
      .references(() => academicYear.id, { onDelete: 'restrict' }),

    status: enrollmentStatus('status').notNull().default('ACTIVE'),

    joinedOn: date('joined_on'),
    exitedOn: date('exited_on'),
    exitReason: text('exit_reason'),

    rollNo: integer('roll_no'),
  },
  (t) => ({
    uqStudentYear: uniqueIndex('uq_enrollment_student_year').on(t.studentProfileId, t.academicYearId),
    uqStudentSection: uniqueIndex('uq_enrollment_student_section').on(t.studentProfileId, t.classSectionId),
    uqRollInSection: uniqueIndex('uq_roll_in_section').on(t.classSectionId, t.rollNo),
  })
);

export const guardianStudent = pgTable(
  'guardian_student',
  {
    guardianProfileId: uuid('guardian_profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),

    studentProfileId: uuid('student_profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),

    linkType: text('link_type'),
    isPrimary: boolean('is_primary').notNull().default(false),
  },
  (t) => ({
    pk: { columns: [t.guardianProfileId, t.studentProfileId] },
  })
);