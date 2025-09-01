import { pgTable, uuid, text, boolean, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const roleEnum = pgEnum('role', ['ADMIN','STAFF','TEACHER','STUDENT','GUARDIAN']);
export const authEnum = pgEnum('auth_method', ['EMAIL','LOGIN_ID']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').unique(),
  loginId: text('login_id').unique(),
  authMethod: authEnum('auth_method').notNull().default('LOGIN_ID'),
  passwordHash: text('password_hash').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  failedLogins: integer('failed_logins').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  secretUpdatedAt: timestamp('secret_updated_at', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userRoles = pgTable('user_roles', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: roleEnum('role').notNull(),
}, (t) => ({ pk: { columns: [t.userId, t.role] }}));

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').unique().references(() => users.id, { onDelete: 'set null' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  phone: text('phone'),
  dob: timestamp('dob'),
  photoUrl: text('photo_url'),
  address: text('address'),
  city: text('city'),
  region: text('region'),
  country: text('country').default('TD'),
});

export const staff = pgTable('staff', {
  profileId: uuid('profile_id').primaryKey().references(() => profiles.id, { onDelete: 'cascade' }),
  staffNo: text('staff_no').unique(),
  position: text('position'),
});
export const student = pgTable('student', {
  profileId: uuid('profile_id').primaryKey().references(() => profiles.id, { onDelete: 'cascade' }),
  admissionNo: text('admission_no').unique(),
});
export const guardian = pgTable('guardian', {
  profileId: uuid('profile_id').primaryKey().references(() => profiles.id, { onDelete: 'cascade' }),
  relationship: text('relationship'),
});