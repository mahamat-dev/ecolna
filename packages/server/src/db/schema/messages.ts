import { pgTable, uuid, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './identity';

export const message = pgTable('message', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  senderProfileId: uuid('sender_profile_id').notNull().references(() => profiles.id, { onDelete: 'restrict' }),
  subject: text('subject'),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const messageRecipient = pgTable('message_recipient', {
  messageId: uuid('message_id').notNull().references(() => message.id, { onDelete: 'cascade' }),
  recipientProfileId: uuid('recipient_profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  readAt: timestamp('read_at', { withTimezone: true }),
  archived: boolean('archived').notNull().default(false),
  deleted: boolean('deleted').notNull().default(false),
});

