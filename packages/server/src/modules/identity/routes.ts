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
  (req.session as any).user = { id: u.id, email: u.email!, roles: roles.map(r=>r.role as any) };
  // Attach profileId to session for downstream modules
  const [p] = await db.select().from(profiles).where(eq(profiles.userId, u.id));
  (req.session as any).profileId = p?.id ?? null;
  res.json({ userId: u.id, roles: roles.map(r=>r.role) });
});

identityRouter.post('/auth/login-id', rateLimit, validate(IdLoginDto), async (req, res) => {
  const u = await svc.verifyIdLogin(req.body.loginId, req.body.secret);
  if(!u) return res.status(401).json({ error: { message: 'Invalid credentials' } });
  const roles = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, u.id));
  (req.session as any).user = { id: u.id, loginId: u.loginId!, roles: roles.map(r=>r.role as any) };
  // Attach profileId to session for downstream modules
  const [p] = await db.select().from(profiles).where(eq(profiles.userId, u.id));
  (req.session as any).profileId = p?.id ?? null;
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
      summary: `Created ${role} ${out.userId}`,
      meta: { role, email },
      actorUserId: actor.userId ?? null,
      actorRoles: actor.roles ?? null,
      ip: actor.ip ?? null,
      at: new Date(),
    });
    return res.json(out);
  }
  if (!firstName || !lastName) return res.status(400).json({ error: { message: 'firstName & lastName required' } });
  const out = await svc.createNonAdmin(role as 'STUDENT'|'GUARDIAN'|'STAFF'|'TEACHER', firstName, lastName, phone, password);
  await writeAudit(db, {
    action: 'IDENTITY_USER_CREATE',
    entityType: 'user',
    entityId: out.userId,
    summary: `Created ${role} ${out.userId}`,
    meta: { role },
    actorUserId: actor.userId ?? null,
    actorRoles: actor.roles ?? null,
    ip: actor.ip ?? null,
    at: new Date(),
  });
  res.json(out);
});

identityRouter.patch('/admin/users/:id/status', requireAdmin, validate(UpdateStatusDto), async (req, res) => {
  const userId = req.params.id;
  if (!userId) return res.status(400).json({ error: { message: 'User ID required' } });
  const { isActive } = req.body;
  await db.update(users).set({ isActive }).where(eq(users.id, userId));
  const actor = actorFromReq(req);
  await writeAudit(db, {
    action: 'IDENTITY_USER_UPDATE_STATUS',
    entityType: 'user',
    entityId: userId,
    summary: `Updated isActive of user ${userId} to ${isActive}`,
    meta: { isActive },
    actorUserId: actor.userId ?? null,
    actorRoles: actor.roles ?? null,
    ip: actor.ip ?? null,
    at: new Date(),
  });
  res.json({ ok: true });
});

identityRouter.post('/admin/users/:id/rotate-login-id', requireAdmin, async (req, res) => {
  const userId = req.params.id;
  if (!userId) return res.status(400).json({ error: { message: 'User ID required' } });
  const newLoginId = makeLoginId('STUDENT');
  const newSecret = randomSecret(12);
  const hash = await argon2Hash(newSecret);
  await db.update(users).set({ loginId: newLoginId, passwordHash: hash, secretUpdatedAt: new Date() }).where(eq(users.id, userId));

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

// Get all users (admin only)
identityRouter.get('/admin/users', requireAdmin, async (req, res) => {
  try {
    const usersWithProfiles = await db.select({
      id: users.id,
      email: users.email,
      loginId: users.loginId,
      authMethod: users.authMethod,
      isActive: users.isActive,
      failedLogins: users.failedLogins,
      lockedUntil: users.lockedUntil,
      lastLoginAt: users.lastLoginAt,
      secretUpdatedAt: users.secretUpdatedAt,
      createdAt: users.createdAt,
      profile: {
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        phone: profiles.phone,
        photoUrl: profiles.photoUrl,
      }
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id));

    // Get roles for each user
    const usersWithRoles = await Promise.all(
      usersWithProfiles.map(async (user) => {
        const roles = await db.select({ role: userRoles.role })
          .from(userRoles)
          .where(eq(userRoles.userId, user.id));
        return {
          ...user,
          roles: roles.map(r => r.role)
        };
      })
    );

    res.json(usersWithRoles);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: { message: 'Failed to fetch users' } });
  }
});

// Lock user account
identityRouter.post('/admin/users/:id/lock', requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    if (!userId) return res.status(400).json({ error: { message: 'User ID required' } });
    
    // Lock for 24 hours
    const lockUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.update(users).set({ lockedUntil: lockUntil }).where(eq(users.id, userId));
    
    const actor = actorFromReq(req);
    await writeAudit(db, {
      action: 'IDENTITY_USER_LOCK',
      entityType: 'user',
      entityId: userId,
      summary: `Locked user ${userId} until ${lockUntil.toISOString()}`,
      meta: { lockedUntil: lockUntil },
      actorUserId: actor.userId ?? null,
      actorRoles: actor.roles ?? null,
      ip: actor.ip ?? null,
      at: new Date(),
    });
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Error locking user:', error);
    res.status(500).json({ error: { message: 'Failed to lock user' } });
  }
});

// Unlock user account
identityRouter.post('/admin/users/:id/unlock', requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    if (!userId) return res.status(400).json({ error: { message: 'User ID required' } });
    
    await db.update(users).set({ lockedUntil: null }).where(eq(users.id, userId));
    
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
  } catch (error) {
    console.error('Error unlocking user:', error);
    res.status(500).json({ error: { message: 'Failed to unlock user' } });
  }
});

export default identityRouter;