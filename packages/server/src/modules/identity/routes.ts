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
import { writeAudit, actorFromReq } from '../../utils/audit';

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
  const actor = actorFromReq(req);
  if (role === 'ADMIN') {
    if (!email || !password) return res.status(400).json({ error: { message: 'Admin requires email & password' } });
    const out = await svc.createAdmin(email, password, firstName, lastName, phone);
    await writeAudit(db, {
      action: 'IDENTITY_USER_CREATE',
      entityType: 'user',
      entityId: out.userId,
      summary: `Created ADMIN user ${out.userId}`,
      meta: { role: 'ADMIN', profileId: out.profileId, email },
      actorUserId: actor.userId ?? null,
      actorRoles: actor.roles ?? null,
      ip: actor.ip ?? null,
      at: new Date(),
    });
    return res.status(201).json({ ...out, email });
  } else {
    const out = await svc.createNonAdmin(role, firstName, lastName, phone, password);
    await writeAudit(db, {
      action: 'IDENTITY_USER_CREATE',
      entityType: 'user',
      entityId: out.userId,
      summary: `Created ${role} user ${out.userId}`,
      meta: { role, profileId: out.profileId },
      actorUserId: actor.userId ?? null,
      actorRoles: actor.roles ?? null,
      ip: actor.ip ?? null,
      at: new Date(),
    });
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
  // Audit: user status update
  const actor = actorFromReq(req);
  await writeAudit(db, {
    action: 'IDENTITY_USER_STATUS_UPDATE',
    entityType: 'user',
    entityId: userId,
    summary: `Set isActive=${req.body.isActive} for user ${userId}`,
    meta: { isActive: req.body.isActive },
    actorUserId: actor.userId ?? null,
    actorRoles: actor.roles ?? null,
    ip: actor.ip ?? null,
    at: new Date(),
  });
  res.json({ ok: true });
});

identityRouter.post('/admin/users/:id/lock', requireAdmin, async (req, res) => {
  const userId = req.params.id;
  if (!userId) return res.status(400).json({ error: { message: 'User ID required' } });
  const until = new Date(Date.now() + 15*60*1000);
  await db.update(users).set({ lockedUntil: until }).where(eq(users.id, userId));
  // Audit: user lock
  const actor = actorFromReq(req);
  await writeAudit(db, {
    action: 'IDENTITY_USER_LOCK',
    entityType: 'user',
    entityId: userId,
    summary: `Locked user ${userId} until ${until.toISOString()}`,
    meta: { until: until.toISOString() },
    actorUserId: actor.userId ?? null,
    actorRoles: actor.roles ?? null,
    ip: actor.ip ?? null,
    at: new Date(),
  });
  res.json({ lockedUntil: until.toISOString() });
});

identityRouter.post('/admin/users/:id/unlock', requireAdmin, async (req, res) => {
  const userId = req.params.id;
  if (!userId) return res.status(400).json({ error: { message: 'User ID required' } });
  await db.update(users).set({ lockedUntil: null, failedLogins: 0 }).where(eq(users.id, userId));
  // Audit: user unlock
  const actor = actorFromReq(req);
  await writeAudit(db, {
    action: 'IDENTITY_USER_UNLOCK',
    entityType: 'user',
    entityId: userId,
    summary: `Unlocked user ${userId}`,
    meta: { unlocked: true },
    actorUserId: actor.userId ?? null,
    actorRoles: actor.roles ?? null,
    ip: actor.ip ?? null,
    at: new Date(),
  });
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
  // Audit: reset secret (do not include secret value)
  const actor = actorFromReq(req);
  await writeAudit(db, {
    action: 'IDENTITY_RESET_SECRET',
    entityType: 'user',
    entityId: userId,
    summary: `Reset secret for user ${userId}`,
    meta: { rotated: true },
    actorUserId: actor.userId ?? null,
    actorRoles: actor.roles ?? null,
    ip: actor.ip ?? null,
    at: new Date(),
  });
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
  // Audit: rotate login id (do not include new loginId value)
  const actor = actorFromReq(req);
  await writeAudit(db, {
    action: 'IDENTITY_ROTATE_LOGIN_ID',
    entityType: 'user',
    entityId: userId,
    summary: `Rotated login_id for user ${userId}`,
    meta: { rotated: true },
    actorUserId: actor.userId ?? null,
    actorRoles: actor.roles ?? null,
    ip: actor.ip ?? null,
    at: new Date(),
  });
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
  // Audit: profile update (track updated fields only)
  const actor = actorFromReq(req);
  const updatedKeys = Object.keys(req.body).filter(k => (req.body as any)[k] !== undefined);
  await writeAudit(db, {
    action: 'IDENTITY_PROFILE_UPDATE',
    entityType: 'profile',
    entityId: profileId,
    summary: `Updated profile ${profileId} fields: ${updatedKeys.join(', ') || 'none'}`,
    meta: { updatedFields: updatedKeys },
    actorUserId: actor.userId ?? null,
    actorRoles: actor.roles ?? null,
    ip: actor.ip ?? null,
    at: new Date(),
  });
  res.json({ ok: true });
});

export default identityRouter;