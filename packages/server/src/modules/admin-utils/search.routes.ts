import { Router } from 'express';
import { requireStaffOrAdmin } from '../../middlewares/rbac';
import { SearchQuery } from './dto';
import { db } from '../../db/client';
import { users, userRoles, profiles } from '../../db/schema/identity';
import { classSection } from '../../db/schema/academics';
import { and, eq, ilike, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';

export const searchRouter = Router();
searchRouter.use(requireStaffOrAdmin);

searchRouter.get('/', async (req, res) => {
  try {
    const { q, types, limit } = SearchQuery.parse(req.query);
    const like = `%${q}%`;
    const buckets = new Set(
      (types?.split(',').map(s=>s.trim().toLowerCase()) ?? ['users','students','teachers','sections'])
        .filter(Boolean)
    );

    const out: Record<string, any[]> = {};
    if (buckets.has('users')) {
      out.users = await db.select({
        id: users.id, 
        email: users.email, 
        loginId: users.loginId, 
        isActive: users.isActive,
      }).from(users)
        .where(
          sql`(${users.email} ILIKE ${like} OR ${users.loginId} ILIKE ${like})`
        ).limit(limit);
    }

    if (buckets.has('students')) {
      const stuIds = await db.select({ userId: userRoles.userId })
        .from(userRoles).where(eq(userRoles.role, 'STUDENT')).limit(10000);
      const ids = stuIds.map(r=>r.userId);
      out.students = ids.length ? await db.select({
        profileId: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        userId: profiles.userId,
      }).from(profiles)
        .where(and(
          inArray(profiles.userId, ids),
          sql`(${profiles.firstName} || ' ' || ${profiles.lastName}) ILIKE ${like}`
        )).limit(limit) : [];
    }

    if (buckets.has('teachers')) {
      const teachIds = await db.select({ userId: userRoles.userId })
        .from(userRoles).where(eq(userRoles.role, 'TEACHER')).limit(10000);
      const ids = teachIds.map(r=>r.userId);
      out.teachers = ids.length ? await db.select({
        profileId: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        userId: profiles.userId,
      }).from(profiles)
        .where(and(
          inArray(profiles.userId, ids),
          sql`(${profiles.firstName} || ' ' || ${profiles.lastName}) ILIKE ${like}`
        )).limit(limit) : [];
    }

    if (buckets.has('sections')) {
      out.sections = await db.select({
        id: classSection.id,
        name: classSection.name,
        gradeLevelId: classSection.gradeLevelId,
        academicYearId: classSection.academicYearId,
      }).from(classSection)
        .where(ilike(classSection.name, like) as any)
        .limit(limit);
    }

    // Optional guardians
    if (buckets.has('guardians')) {
      const guardIds = await db.select({ userId: userRoles.userId })
        .from(userRoles).where(eq(userRoles.role, 'GUARDIAN')).limit(10000);
      const ids = guardIds.map(r=>r.userId);
      out.guardians = ids.length ? await db.select({
        profileId: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        userId: profiles.userId,
      }).from(profiles)
        .where(and(
          inArray(profiles.userId, ids),
          sql`(${profiles.firstName} || ' ' || ${profiles.lastName}) ILIKE ${like}`
        )).limit(limit) : [];
    }

    res.json(out);
  } catch (err) {
    console.error('GET /admin/search failed', err);
    
    // Handle validation errors
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid search parameters',
          details: err.errors
        }
      });
    }
    
    return res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to search' 
      } 
    });
  }
});
