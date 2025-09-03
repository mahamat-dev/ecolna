import { pgTable, uuid, integer, timestamp, boolean, time, varchar, text } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { classSection, subject } from './academics';
import { profiles } from './identity';

export const timetablePeriod = pgTable('timetable_period', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  label: varchar('label', { length: 64 }).notNull(), // e.g., "P1", "08:00–08:50"
  startsAt: time('starts_at').notNull(), // local school time
  endsAt: time('ends_at').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const timetableSlot = pgTable('timetable_slot', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  classSectionId: uuid('class_section_id')
    .notNull()
    .references(() => classSection.id, { onDelete: 'cascade' }),
  subjectId: uuid('subject_id')
    .notNull()
    .references(() => subject.id, { onDelete: 'restrict' }),
  teacherProfileId: uuid('teacher_profile_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'restrict' }),
  dayOfWeek: integer('day_of_week').notNull(), // 1=Mon … 7=Sun
  periodId: uuid('period_id')
    .notNull()
    .references(() => timetablePeriod.id, { onDelete: 'restrict' }),
  room: varchar('room', { length: 64 }),
  validFrom: timestamp('valid_from', { withTimezone: true }).notNull().defaultNow(), // date the slot becomes active
  validTo: timestamp('valid_to', { withTimezone: true }), // nullable = open ended
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const timetableException = pgTable('timetable_exception', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  classSectionId: uuid('class_section_id')
    .notNull()
    .references(() => classSection.id, { onDelete: 'cascade' }),
  date: timestamp('date', { withTimezone: true }).notNull(), // calendar day (use midnight local)
  canceled: boolean('canceled').notNull().default(true), // true = cancel all lessons for the section on this date
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});