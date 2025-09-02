import {
   pgTable,
   serial,
   text,
   varchar,
   timestamp,
   boolean,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export * from './schema/identity.ts';
export * from './schema/academics.ts';
export * from './schema/enrollment.ts';
export * from './schema/audit.ts';
export * from './schema/teaching.ts';
export * from './schema/attendance.ts';
export * from './schema/content.ts';
export * from './schema/assess.ts';

export const users = pgTable('users', {
   id: serial('id').primaryKey(),
   email: varchar('email', { length: 255 }).notNull().unique(),
   name: varchar('name', { length: 255 }),
   createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
   updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
   isActive: boolean('is_active').notNull().default(true),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
