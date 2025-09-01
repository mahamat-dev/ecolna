import {
   pgTable,
   serial,
   text,
   varchar,
   timestamp,
   boolean,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export * from './schema/identity';
export * from './schema/academics';

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
