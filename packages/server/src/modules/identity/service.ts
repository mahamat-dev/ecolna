import { db } from '../../db/client';
import { users, userRoles, profiles } from '../../db/schema/identity';
import { eq } from 'drizzle-orm';
import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';
import { makeLoginId, randomSecret } from './codegen';

export async function createAdmin(email:string, password:string, firstName:string, lastName:string, phone?:string){
  const passwordHash = await argon2Hash(password);
  const result = await db.transaction(async tx => {
    const [u] = await tx.insert(users).values({ authMethod:'EMAIL', email, passwordHash, isActive:true }).returning();
    if (!u) throw new Error('Failed to create user');
    await tx.insert(userRoles).values({ userId: u.id, role: 'ADMIN' });
    const [p] = await tx.insert(profiles).values({ userId: u.id, firstName, lastName, phone: phone ?? null }).returning();
    if (!p) throw new Error('Failed to create profile');
    return { u, p };
  });
  return { userId: result.u.id, profileId: result.p.id };
}

export async function createNonAdmin(role:'STUDENT'|'GUARDIAN'|'STAFF'|'TEACHER', firstName:string, lastName:string, phone?:string, password?:string){
  const loginId = makeLoginId(role);
  const secret = password || randomSecret(12);
  const passwordHash = await argon2Hash(secret);

  const result = await db.transaction(async tx => {
    const [u] = await tx.insert(users).values({ authMethod:'LOGIN_ID', loginId, passwordHash, isActive:true }).returning();
    if (!u) throw new Error('Failed to create user');
    await tx.insert(userRoles).values({ userId: u.id, role });
    const [p] = await tx.insert(profiles).values({ userId: u.id, firstName, lastName, phone: phone ?? null }).returning();
    if (!p) throw new Error('Failed to create profile');
    return { u, p };
  });
  return { userId: result.u.id, profileId: result.p.id, loginId, secret: password ? undefined : secret };
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