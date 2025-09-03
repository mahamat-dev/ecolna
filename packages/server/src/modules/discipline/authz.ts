import { db } from '../../db/client';
import { userRoles, profiles } from '../../db/schema/identity';
import { enrollment } from '../../db/schema/enrollment';
import { teachingAssignment } from '../../db/schema/teaching';
import { and, eq, inArray } from 'drizzle-orm';

export async function rolesOf(userId: string) {
  const rows = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  return rows.map(r => r.role as string);
}

/** Teacher can act on students they teach (any assigned section). */
export async function teacherHasStudent(teacherProfileId: string, studentProfileId: string) {
  const sts = await db.select().from(enrollment).where(eq(enrollment.studentProfileId, studentProfileId));
  if (!sts.length) return false;
  const assigns = await db.select().from(teachingAssignment).where(inArray(teachingAssignment.classSectionId, sts.map(s => s.classSectionId) as any));
  return assigns.some(a => a.teacherProfileId === teacherProfileId);
}

export function isPrivileged(roles: string[]) {
  return roles.includes('ADMIN') || roles.includes('STAFF');
}

