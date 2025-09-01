import { pgTable, uuid, text, integer, boolean, date, primaryKey, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';

export const educationStage = pgTable('education_stage', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  orderIndex: integer('order_index').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
});

export const gradeLevel = pgTable(
  'grade_level',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    stageId: uuid('stage_id').notNull().references(() => educationStage.id, { onDelete: 'restrict' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    orderIndex: integer('order_index').notNull().default(0),
  },
  (t) => ({
    uqStageCode: uniqueIndex('uq_grade_level_stage_code').on(t.stageId, t.code),
  })
);

export const academicYear = pgTable('academic_year', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  code: text('code').notNull().unique(), // e.g., 2025-2026
  startsOn: date('starts_on').notNull(),
  endsOn: date('ends_on').notNull(),
  isActive: boolean('is_active').notNull().default(true),
});

export const term = pgTable(
  'term',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    academicYearId: uuid('academic_year_id')
      .notNull()
      .references(() => academicYear.id, { onDelete: 'cascade' }),
    name: text('name').notNull(), // Trimestre 1 / Semestre 2
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on').notNull(),
    orderIndex: integer('order_index').notNull().default(0),
  },
  (t) => ({
    uqYearName: uniqueIndex('uq_term_year_name').on(t.academicYearId, t.name),
  })
);

export const subject = pgTable('subject', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  stageId: uuid('stage_id').references(() => educationStage.id, { onDelete: 'set null' }),
  isActive: boolean('is_active').notNull().default(true),
});

export const classSection = pgTable(
  'class_section',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    academicYearId: uuid('academic_year_id')
      .notNull()
      .references(() => academicYear.id, { onDelete: 'cascade' }),
    gradeLevelId: uuid('grade_level_id')
      .notNull()
      .references(() => gradeLevel.id, { onDelete: 'restrict' }),
    name: text('name').notNull(), // e.g., A / B / Science
    capacity: integer('capacity'),
    room: text('room'),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => ({
    uqTriple: uniqueIndex('uq_class_section_triple').on(t.academicYearId, t.gradeLevelId, t.name),
  })
);

export const classSectionSubject = pgTable(
  'class_section_subject',
  {
    classSectionId: uuid('class_section_id')
      .notNull()
      .references(() => classSection.id, { onDelete: 'cascade' }),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subject.id, { onDelete: 'restrict' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.classSectionId, t.subjectId], name: 'pk_class_section_subject' }),
  })
);

// Optional relations if needed later
export const educationStageRelations = relations(educationStage, ({ many }) => ({
  gradeLevels: many(gradeLevel),
  subjects: many(subject),
}));

export const gradeLevelRelations = relations(gradeLevel, ({ one, many }) => ({
  stage: one(educationStage, { fields: [gradeLevel.stageId], references: [educationStage.id] }),
  sections: many(classSection),
}));

export const academicYearRelations = relations(academicYear, ({ many }) => ({
  terms: many(term),
  sections: many(classSection),
}));

export const termRelations = relations(term, ({ one }) => ({
  year: one(academicYear, { fields: [term.academicYearId], references: [academicYear.id] }),
}));

export const subjectRelations = relations(subject, ({ one, many }) => ({
  stage: one(educationStage, { fields: [subject.stageId], references: [educationStage.id] }),
  classLinks: many(classSectionSubject),
}));

export const classSectionRelations = relations(classSection, ({ one, many }) => ({
  year: one(academicYear, { fields: [classSection.academicYearId], references: [academicYear.id] }),
  level: one(gradeLevel, { fields: [classSection.gradeLevelId], references: [gradeLevel.id] }),
  subjects: many(classSectionSubject),
}));