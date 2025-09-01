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

identityRouter.post('/auth/login-email', rateLimit, validate(EmailLoginDto), async (req, res) => {
  const u = await svc.verifyEmailLogin(req.body.email, req.body.password);
  if(!u) return res.status(401).json({ error: { message: 'Invalid credentials' } });
  const roles = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, u.id));
  if(!roles.find(r => r.role === 'ADMIN')) return res.status(403).json({ error: { message: 'Admin only' } });
  (req.session as any).user = { id: u.id, email: u.email!, roles: roles.map(r=>r.role as any) };
  res.json({ userId: u.id, roles: roles.map(r=>r.role) });
});

identityRouter.post('/auth/login-id', rateLimit, validate(IdLoginDto), async (req, res) => {
  const u = await svc.verifyIdLogin(req.body.loginId, req.body.secret);
  if(!u) return res.status(401).json({ error: { message: 'Invalid credentials' } });
  const roles = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, u.id));
  (req.session as any).user = { id: u.id, loginId: u.loginId!, roles: roles.map(r=>r.role as any) };
  res.json({ userId: u.id, loginId: u.loginId, roles: roles.map(r=>r.role) });
});

identityRouter.post('/auth/logout', requireAuth, async (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

identityRouter.get('/me', async (req, res) => {
  if(!(req.session as any).user) return res.status(401).json({ error: { message: 'Not signed in' } });
  const [p] = await db.select().from(profiles).where(eq(profiles.userId, (req.session as any).user.id));
  res.json({ user: (req.session as any).user, profile: p ?? null });
});

identityRouter.post('/admin/users', requireAdmin, validate(CreateUserDto), async (req, res) => {
  const { role, email, password, firstName, lastName, phone } = req.body;
  if (role === 'ADMIN') {
    if (!email || !password) return res.status(400).json({ error: { message: 'Admin requires email & password' } });
    const out = await svc.createAdmin(email, password, firstName, lastName, phone);
    return res.status(201).json({ ...out, email });
  } else {
    const out = await svc.createNonAdmin(role, firstName, lastName, phone, password);
    return res.status(201).json(out);
  }
});

identityRouter.get('/admin/users', requireAdmin, async (_req, res) => {
  const data = await db.select().from(users);
  res.json(data);
});

identityRouter.get('/admin/users/:id', requireAdmin, async (req, res) => {
  const userId = req.params.id;
  if (!userId) return res.status(400).json({ error: { message: 'User ID required' } });
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if(!u) return res.status(404).json({ error: { message: 'User not found' } });
  const roles = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, u.id));
  const [p] = await db.select().from(profiles).where(eq(profiles.userId, u.id));
  res.json({ user: u, roles: roles.map(r=>r.role), profile: p ?? null });
});

identityRouter.patch('/admin/users/:id/status', requireAdmin, validate(UpdateStatusDto), async (req, res) => {
  const userId = req.params.id;
  if (!userId) return res.status(400).json({ error: { message: 'User ID required' } });
  await db.update(users).set({ isActive: req.body.isActive }).where(eq(users.id, userId));
  res.json({ ok: true });
});

identityRouter.post('/admin/users/:id/lock', requireAdmin, async (req, res) => {
  const userId = req.params.id;
  if (!userId) return res.status(400).json({ error: { message: 'User ID required' } });
  const until = new Date(Date.now() + 15*60*1000);
  await db.update(users).set({ lockedUntil: until }).where(eq(users.id, userId));
  res.json({ lockedUntil: until.toISOString() });
});

identityRouter.post('/admin/users/:id/unlock', requireAdmin, async (req, res) => {
  const userId = req.params.id;
  if (!userId) return res.status(400).json({ error: { message: 'User ID required' } });
  await db.update(users).set({ lockedUntil: null, failedLogins: 0 }).where(eq(users.id, userId));
  res.json({ ok: true });
});

identityRouter.post('/admin/users/:id/reset-secret', requireAdmin, async (req, res) => {
  const userId = req.params.id;
  if (!userId) return res.status(400).json({ error: { message: 'User ID required' } });
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if(!u) return res.status(404).json({ error: { message: 'User not found' } });
  if(u.authMethod !== 'LOGIN_ID') return res.status(400).json({ error: { message: 'Only non-admin users have secrets' } });
  const newSecret = randomSecret(12);
  const passwordHash = await argon2Hash(newSecret);
  await db.update(users).set({ passwordHash, secretUpdatedAt: new Date() }).where(eq(users.id, u.id));
  res.json({ newSecret });
});

identityRouter.post('/admin/users/:id/rotate-login-id', requireAdmin, async (req, res) => {
  const userId = req.params.id;
  if (!userId) return res.status(400).json({ error: { message: 'User ID required' } });
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if(!u) return res.status(404).json({ error: { message: 'User not found' } });
  if(u.authMethod !== 'LOGIN_ID') return res.status(400).json({ error: { message: 'Only non-admin users have login_id' } });
  const roles = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, u.id));
  const any = roles.find(r => r.role !== 'ADMIN');
  const newLoginId = makeLoginId((any?.role as any) ?? 'STUDENT');
  await db.update(users).set({ loginId: newLoginId }).where(eq(users.id, u.id));
  res.json({ newLoginId });
});

identityRouter.patch('/admin/profiles/:id', requireAdmin, validate(UpdateProfileDto), async (req, res) => {
  const profileId = req.params.id;
  if (!profileId) return res.status(400).json({ error: { message: 'Profile ID required' } });
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
  }).where(eq(profiles.id, profileId));
  res.json({ ok: true });
});

export default identityRouter;