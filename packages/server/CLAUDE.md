# CLAUDE.md — Module 1: User Management (API-only, **Express 5**)

Single-institution School Management **API**  
Stack: **Bun • Express 5 • Drizzle ORM (PostgreSQL)**

**Credential policy (final)**
- **Admins** sign in with **email + password**.
- **Non-admins** (**STAFF**, **TEACHER**, **STUDENT**, **GUARDIAN**) sign in with **`login_id` + secret** (no email).
- **Only admins** can create/reset/lock/unlock/activate/deactivate users.
- **Users cannot change their own secret** (no self-service). No “first-login change”.

---

## 0) Outcomes

Ship a secure identity & RBAC layer:
- DB schema: **users / user_roles / profiles** (+ optional role shells)
- Session cookies; RBAC guards
- Endpoints: `/auth/*`, `/admin/users*`, `/admin/profiles/:id`
- Seed script for first admin
- Tests via cURL/OpenAPI examples

---

## 1) Setup

**.env**
```env
DATABASE_URL=postgres://app:app@127.0.0.1:5432/schooldb
SESSION_SECRET=change_this_long_random_string
PORT=4000
NODE_ENV=development
# Optional (prod): REDIS_URL=redis://127.0.0.1:6379
Install

bash
Copier le code
bun add express@5 cors morgan express-session connect-redis ioredis
bun add drizzle-orm postgres zod dotenv @node-rs/argon2 rate-limiter-flexible
bun add -d drizzle-kit tsx @types/node @types/express@^5
Drizzle config (drizzle.config.ts)

ts
Copier le code
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  dialect: 'postgresql',
  out: './drizzle',
  schema: './src/db/schema/**/*.ts',
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
  verbose: true,
});
DB extension (once)

sql
Copier le code
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
Drizzle commands

bash
Copier le code
bun run db:gen
bun run db:migrate
bun run db:studio
2) Database Design
Enums
role: ADMIN | STAFF | TEACHER | STUDENT | GUARDIAN

auth_method: EMAIL | LOGIN_ID

Tables (canonical)
users
column	type	constraints / notes
id	uuid	PK, default gen_random_uuid()
email	text	UNIQUE, admins only
login_id	text	UNIQUE, non-admins only
auth_method	auth_method	NOT NULL, default 'LOGIN_ID'
password_hash	text	NOT NULL (argon2)
is_active	boolean	NOT NULL, default true
failed_logins	int	NOT NULL, default 0
locked_until	timestamptz	nullable
last_login_at	timestamptz	nullable
secret_updated_at	timestamptz	default now()
created_at	timestamptz	NOT NULL, default now()

user_roles
column	type	constraints
user_id	uuid	FK → users(id) ON DELETE CASCADE
role	role	NOT NULL
PK (user_id, role)		

profiles (one per human; may be linked to a user)
column	type	constraints / notes
id	uuid	PK, default gen_random_uuid()
user_id	uuid	UNIQUE, FK → users(id) ON DELETE SET NULL
first_name	text	NOT NULL
last_name	text	NOT NULL
phone	text	optional
dob	timestamptz	optional
photo_url	text	optional
address	text	single free-text address
city	text	optional
region	text	optional
country	text	default 'TD' (Chad)

(Optional role shells to extend later)
staff(profile_id PK, staff_no UNIQUE, position)
student(profile_id PK, admission_no UNIQUE)
guardian(profile_id PK, relationship)

Drizzle schema (drop-in)
ts
Copier le code
// src/db/schema/identity.ts
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

// optional shells
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
3) Middleware & Sessions (Express 5)
CORS: origin: true, credentials: true

JSON: express.json()

Logging: morgan('dev')

Sessions: express-session (cookie: httpOnly, SameSite='lax', Secure in prod, maxAge=8h).
Use Redis store when REDIS_URL present; MemoryStore only for local dev.

Rate limit: rate-limiter-flexible on /auth/*

RBAC guards: requireAuth, requireAdmin

Error handler: consistent JSON { error: { message, details? } }

4) DTOs (zod)
ts
Copier le code
// src/modules/identity/dto.ts
import { z } from 'zod';

export const EmailLoginDto = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export const IdLoginDto = z.object({
  loginId: z.string().min(2),
  secret: z.string().min(6),
});
export const CreateUserDto = z.object({
  role: z.enum(['ADMIN','STAFF','TEACHER','STUDENT','GUARDIAN']),
  email: z.string().email().optional(),      // required if role=ADMIN
  password: z.string().min(8).optional(),    // required if role=ADMIN
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
});
export const UpdateStatusDto = z.object({ isActive: z.boolean() });

export const UpdateProfileDto = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  dob: z.coerce.date().optional(),
  photoUrl: z.string().url().optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(80).optional(),
  region: z.string().max(80).optional(),
  country: z.string().max(2).optional(), // e.g., "TD"
});
5) Generators
ts
Copier le code
// src/modules/identity/codegen.ts
const prefixes = { STUDENT: 'S', GUARDIAN: 'P', STAFF: 'STF', TEACHER: 'T' } as const;

function randDigits(n:number){ let s=''; for(let i=0;i<n;i++) s+=Math.floor(Math.random()*10); return s; }

export function makeLoginId(role:'STUDENT'|'GUARDIAN'|'STAFF'|'TEACHER'){
  return `${prefixes[role] ?? 'U'}${randDigits(6)}`;  // e.g., S123456 / STF987654
}

export function randomSecret(n=12){
  const c='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let s=''; for(let i=0;i<n;i++) s+=c[Math.floor(Math.random()*c.length)]; return s;
}
6) Services
ts
Copier le code
// src/modules/identity/service.ts
import { db } from '../../db/client';
import { users, userRoles, profiles } from '../../db/schema/identity';
import { eq } from 'drizzle-orm';
import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';
import { makeLoginId, randomSecret } from './codegen';

export async function createAdmin(email:string, password:string, firstName:string, lastName:string, phone?:string){
  const passwordHash = await argon2Hash(password);
  const result = await db.transaction(async tx => {
    const [u] = await tx.insert(users).values({ authMethod:'EMAIL', email, passwordHash, isActive:true }).returning();
    await tx.insert(userRoles).values({ userId: u.id, role: 'ADMIN' });
    const [p] = await tx.insert(profiles).values({ userId: u.id, firstName, lastName, phone: phone ?? null }).returning();
    return { u, p };
  });
  return { userId: result.u.id, profileId: result.p.id };
}

export async function createNonAdmin(role:'STUDENT'|'GUARDIAN'|'STAFF'|'TEACHER', firstName:string, lastName:string, phone?:string){
  const loginId = makeLoginId(role);
  const secret = randomSecret(12);
  const passwordHash = await argon2Hash(secret);

  const result = await db.transaction(async tx => {
    const [u] = await tx.insert(users).values({ authMethod:'LOGIN_ID', loginId, passwordHash, isActive:true }).returning();
    await tx.insert(userRoles).values({ userId: u.id, role });
    const [p] = await tx.insert(profiles).values({ userId: u.id, firstName, lastName, phone: phone ?? null }).returning();
    return { u, p };
  });
  return { userId: result.u.id, profileId: result.p.id, loginId, secret }; // secret shown once
}

export async function verifyEmailLogin(email:string, password:string){
  const [u] = await db.select().from(users).where(eq(users.email, email));
  if(!u || u.authMethod !== 'EMAIL' || !u.isActive) return null;
  if(u.lockedUntil && u.lockedUntil > new Date()) return null;
  const ok = await argon2Verify(u.passwordHash, password);
  return ok ? u : null;
}

export async function verifyIdLogin(loginId:string, secret:string){
  const [u] = await db.select().from(users).where(eq(users.loginId, loginId));
  if(!u || u.authMethod !== 'LOGIN_ID' || !u.isActive) return null;
  if(u.lockedUntil && u.lockedUntil > new Date()) return null;
  const ok = await argon2Verify(u.passwordHash, secret);
  return ok ? u : null;
}
7) Routes (Express 5)
ts
Copier le code
// src/modules/identity/routes.ts
import { Router } from 'express';
import { db } from '../../db/client';
import { users, userRoles, profiles } from '../../db/schema/identity';
import { eq } from 'drizzle-orm';
import { validate } from '../../middlewares/validate';
import { rateLimit } from '../../middlewares/rateLimit';
import { requireAuth, requireAdmin } from '../../middlewares/rbac';
import { EmailLoginDto, IdLoginDto, CreateUserDto, UpdateStatusDto, UpdateProfileDto } from './dto';
import * as svc from './service';
import { hash as argon2Hash } from '@node-rs/argon2';
import { makeLoginId, randomSecret } from './codegen';

export const identityRouter = Router();

/* ---------- AUTH ---------- */
identityRouter.post('/auth/login-email', rateLimit, validate(EmailLoginDto), async (req, res) => {
  const u = await svc.verifyEmailLogin(req.body.email, req.body.password);
  if(!u) return res.status(401).json({ error: { message: 'Invalid credentials' } });
  const roles = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, u.id));
  if(!roles.find(r => r.role === 'ADMIN')) return res.status(403).json({ error: { message: 'Admin only' } });
  req.session.user = { id: u.id, email: u.email, roles: roles.map(r=>r.role) };
  res.json({ userId: u.id, roles: roles.map(r=>r.role) });
});

identityRouter.post('/auth/login-id', rateLimit, validate(IdLoginDto), async (req, res) => {
  const u = await svc.verifyIdLogin(req.body.loginId, req.body.secret);
  if(!u) return res.status(401).json({ error: { message: 'Invalid credentials' } });
  const roles = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, u.id));
  req.session.user = { id: u.id, loginId: u.loginId, roles: roles.map(r=>r.role) };
  res.json({ userId: u.id, loginId: u.loginId, roles: roles.map(r=>r.role) });
});

identityRouter.post('/auth/logout', requireAuth, async (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

identityRouter.get('/me', async (req, res) => {
  if(!req.session.user) return res.status(401).json({ error: { message: 'Not signed in' } });
  const [p] = await db.select().from(profiles).where(eq(profiles.userId, req.session.user.id));
  res.json({ user: req.session.user, profile: p ?? null });
});

/* ---------- ADMIN: USERS ---------- */
identityRouter.post('/admin/users', requireAdmin, validate(CreateUserDto), async (req, res) => {
  const { role, email, password, firstName, lastName, phone } = req.body;
  if (role === 'ADMIN') {
    if (!email || !password) return res.status(400).json({ error: { message: 'Admin requires email & password' } });
    const out = await svc.createAdmin(email, password, firstName, lastName, phone);
    return res.status(201).json({ ...out, email });
  } else {
    const out = await svc.createNonAdmin(role, firstName, lastName, phone);
    return res.status(201).json(out); // includes loginId + secret (show once)
  }
});

identityRouter.get('/admin/users', requireAdmin, async (_req, res) => {
  const data = await db.select().from(users);
  res.json(data);
});

identityRouter.get('/admin/users/:id', requireAdmin, async (req, res) => {
  const [u] = await db.select().from(users).where(eq(users.id, req.params.id));
  if(!u) return res.status(404).json({ error: { message: 'User not found' } });
  const roles = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, u.id));
  const [p] = await db.select().from(profiles).where(eq(profiles.userId, u.id));
  res.json({ user: u, roles: roles.map(r=>r.role), profile: p ?? null });
});

identityRouter.patch('/admin/users/:id/status', requireAdmin, validate(UpdateStatusDto), async (req, res) => {
  await db.update(users).set({ isActive: req.body.isActive }).where(eq(users.id, req.params.id));
  res.json({ ok: true });
});

identityRouter.post('/admin/users/:id/lock', requireAdmin, async (req, res) => {
  const until = new Date(Date.now() + 15*60*1000);
  await db.update(users).set({ lockedUntil: until }).where(eq(users.id, req.params.id));
  res.json({ lockedUntil: until.toISOString() });
});

identityRouter.post('/admin/users/:id/unlock', requireAdmin, async (req, res) => {
  await db.update(users).set({ lockedUntil: null, failedLogins: 0 }).where(eq(users.id, req.params.id));
  res.json({ ok: true });
});

identityRouter.post('/admin/users/:id/reset-secret', requireAdmin, async (req, res) => {
  const [u] = await db.select().from(users).where(eq(users.id, req.params.id));
  if(!u) return res.status(404).json({ error: { message: 'User not found' } });
  if(u.authMethod !== 'LOGIN_ID') return res.status(400).json({ error: { message: 'Only non-admin users have secrets' } });
  const newSecret = randomSecret(12);
  const passwordHash = await argon2Hash(newSecret);
  await db.update(users).set({ passwordHash, secretUpdatedAt: new Date() }).where(eq(users.id, u.id));
  // TODO: revoke existing sessions for this user
  res.json({ newSecret }); // show once
});

identityRouter.post('/admin/users/:id/rotate-login-id', requireAdmin, async (req, res) => {
  const [u] = await db.select().from(users).where(eq(users.id, req.params.id));
  if(!u) return res.status(404).json({ error: { message: 'User not found' } });
  if(u.authMethod !== 'LOGIN_ID') return res.status(400).json({ error: { message: 'Only non-admin users have login_id' } });
  const roles = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, u.id));
  const any = roles.find(r => r.role !== 'ADMIN');
  const newLoginId = makeLoginId((any?.role as any) ?? 'STUDENT');
  await db.update(users).set({ loginId: newLoginId }).where(eq(users.id, u.id));
  res.json({ newLoginId });
});

/* ---------- ADMIN: PROFILES (address etc.) ---------- */
identityRouter.patch('/admin/profiles/:id', requireAdmin, validate(UpdateProfileDto), async (req, res) => {
  const { firstName, lastName, phone, dob, photoUrl, address, city, region, country } = req.body;
  await db.update(profiles).set({
    ...(firstName !== undefined && { firstName }),
    ...(lastName  !== undefined && { lastName }),
    ...(phone     !== undefined && { phone }),
    ...(dob       !== undefined && { dob }),
    ...(photoUrl  !== undefined && { photoUrl }),
    ...(address   !== undefined && { address }),
    ...(city      !== undefined && { city }),
    ...(region    !== undefined && { region }),
    ...(country   !== undefined && { country }),
  }).where(eq(profiles.id, req.params.id));
  res.json({ ok: true });
});
8) Error Shape & Security
Error JSON

json
Copier le code
{ "error": { "message": "string", "details": { } } }
Statuses

400 validation, 401 unauthenticated, 403 admin only, 404 not found, 423 locked, 429 rate limit, 500 server

Security checklist

Hash with Argon2

Rate-limit /auth/*; after N failures (e.g., 5) set locked_until = now()+15m

HttpOnly cookies; enable secure in production (HTTPS)

Never log/persist plaintext secrets; show them once on create/reset

Audit admin actions later (audit_log)

9) Seed First Admin (script snippet)
ts
Copier le code
// scripts/seed_admin.ts
import 'dotenv/config';
import { db } from '../src/db/client';
import { users, userRoles, profiles } from '../src/db/schema/identity';
import { hash as argon2Hash } from '@node-rs/argon2';

const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
const password = process.env.SEED_ADMIN_PASSWORD ?? 'AdminPass123';

const run = async () => {
  const passwordHash = await argon2Hash(password);
  const [u] = await db.insert(users).values({
    authMethod: 'EMAIL', email, passwordHash, isActive: true
  }).onConflictDoNothing().returning();

  if (!u) { console.log('Admin exists.'); return; }

  await db.insert(userRoles).values({ userId: u.id, role: 'ADMIN' });
  await db.insert(profiles).values({ userId: u.id, firstName: 'System', lastName: 'Admin' });
  console.log(`Seeded admin: ${email} / ${password}`);
};

run().catch(e => { console.error(e); process.exit(1); });
Run:

bash
Copier le code
SEED_ADMIN_EMAIL=admin@example.com SEED_ADMIN_PASSWORD=AdminPass123 \
bunx tsx scripts/seed_admin.ts
10) Manual Tests (cURL)
bash
Copier le code
# Admin login (email)
curl -i -c cookies.txt -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"AdminPass123"}' \
  http://localhost:4000/api/auth/login-email

# Create a student (returns loginId + secret ONCE)
curl -i -b cookies.txt -H "Content-Type: application/json" \
  -d '{"role":"STUDENT","firstName":"Amina","lastName":"Mahamat"}' \
  http://localhost:4000/api/admin/users

# Student login
curl -i -c s.txt -H "Content-Type: application/json" \
  -d '{"loginId":"S123456","secret":"k7Q8mZ2xV9"}' \
  http://localhost:4000/api/auth/login-id

# Who am I?
curl -i -b s.txt http://localhost:4000/api/me

# Reset secret
curl -i -b cookies.txt -X POST http://localhost:4000/api/admin/users/<USER_ID>/reset-secret

# Rotate login_id
curl -i -b cookies.txt -X POST http://localhost:4000/api/admin/users/<USER_ID>/rotate-login-id

# Activate / Deactivate
curl -i -b cookies.txt -X PATCH -H "Content-Type: application/json" \
  -d '{"isActive":false}' http://localhost:4000/api/admin/users/<USER_ID>/status

# Update profile address
curl -i -b cookies.txt -X PATCH -H "Content-Type: application/json" \
  -d '{"address":"Quartier Klemat, Villa 12", "city":"N’Djamena","region":"Chari-Baguirmi","country":"TD"}' \
  http://localhost:4000/api/admin/profiles/<PROFILE_ID>
11) OpenAPI (compact)
yaml
Copier le code
openapi: 3.0.3
info: { title: School API — Module 1 (Identity), version: 1.0.0 }
servers: [ { url: http://localhost:4000/api } ]
paths:
  /auth/login-email:
    post:
      requestBody:
        required: true
        content: { application/json: { schema:
          { type: object, properties: { email: {type: string, format: email}, password: {type: string, minLength: 8} }, required: [email, password] } } }
      responses: { '200': { description: ok }, '401': { description: invalid }, '403': { description: admin only } }
  /auth/login-id:
    post:
      requestBody:
        required: true
        content: { application/json: { schema:
          { type: object, properties: { loginId: {type: string}, secret: {type: string} }, required: [loginId, secret] } } }
      responses: { '200': { description: ok }, '401': { description: invalid } }
  /auth/logout:
    post: { responses: { '200': { description: ok }, '401': { description: not signed in } } }
  /me:
    get: { responses: { '200': { description: ok }, '401': { description: not signed in } } }
  /admin/users:
    get:  { responses: { '200': { description: list }, '403': { description: admin only } } }
    post:
      requestBody:
        required: true
        content: { application/json: { schema:
          { type: object, properties:
            { role: { enum: [ADMIN,STAFF,TEACHER,STUDENT,GUARDIAN] },
              email: { type: string, format: email }, password: { type: string, minLength: 8 },
              firstName: { type: string }, lastName: { type: string }, phone: { type: string } },
            required: [role, firstName, lastName] } } }
      responses: { '201': { description: created }, '403': { description: admin only } }
  /admin/users/{id}:
    get:
      parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
      responses: { '200': { description: ok }, '404': { description: not found }, '403': { description: admin only } }
  /admin/users/{id}/status:
    patch:
      parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
      requestBody:
        required: true
        content: { application/json: { schema: { type: object, properties: { isActive: { type: boolean } }, required: [isActive] } } }
      responses: { '200': { description: ok }, '403': { description: admin only } }
  /admin/users/{id}/lock:
    post: { parameters: [ { in: path, name: id, required: true, schema: { type: string } } ], responses: { '200': { description: ok }, '403': { description: admin only } } }
  /admin/users/{id}/unlock:
    post: { parameters: [ { in: path, name: id, required: true, schema: { type: string } } ], responses: { '200': { description: ok }, '403': { description: admin only } } }
  /admin/users/{id}/reset-secret:
    post: { parameters: [ { in: path, name: id, required: true, schema: { type: string } } ], responses: { '200': { description: shows newSecret once }, '403': { description: admin only } } }
  /admin/users/{id}/rotate-login-id:
    post: { parameters: [ { in: path, name: id, required: true, schema: { type: string } } ], responses: { '200': { description: shows newLoginId }, '403': { description: admin only } } }
  /admin/profiles/{id}:
    patch:
      parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
      requestBody:
        required: true
        content: { application/json: { schema:
          { type: object, additionalProperties: true } } }
      responses: { '200': { description: ok }, '403': { description: admin only } }
12) Definition of Done
 Drizzle schema & migrations applied

 Session cookies + RBAC middleware working

 /auth/login-email, /auth/login-id, /auth/logout, /me implemented

 Admin user CRUD (create/list/get) + reset secret / rotate login_id / lock & unlock / activate & deactivate

 profiles supports single address, city, region, country ('TD')

 First admin seeded and able to create users

 Auth routes rate-limited; consistent error JSON