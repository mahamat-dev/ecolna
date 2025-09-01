import { Router } from 'express';
import { db } from '../../db/client';
import { validate } from '../../middlewares/validate';
import { requireAdmin } from '../../middlewares/rbac';
import { enrollment, guardianStudent } from '../../db/schema/enrollment';
import { classSection, academicYear } from '../../db/schema/academics';
import { profiles, userRoles } from '../../db/schema/identity';
import {
  EnrollDto, TransferDto, WithdrawDto, GraduateDto,
  SetRollNoDto, LinkGuardianDto, UnlinkGuardianDto
} from './dto';
import { and, eq, count } from 'drizzle-orm';
import { writeAudit, actorFromReq } from '../../utils/audit';

const router = Router();
router.use(requireAdmin);

/* Create/transfer */
router.post('/enrollments', validate(EnrollDto), async (req, res) => {
  const { studentProfileId, classSectionId, academicYearId, joinedOn, rollNo } = req.body;
  
  try {
    await db.transaction(async tx => {
      // Check capacity before enrolling
      const [section] = await tx.select({ capacity: classSection.capacity })
        .from(classSection)
        .where(eq(classSection.id, classSectionId));
      
      if (!section) {
        throw new Error('Class section not found');
      }
      
      if (section.capacity) {
         const [currentCount] = await tx.select({ count: count() })
           .from(enrollment)
           .where(and(
             eq(enrollment.classSectionId, classSectionId),
             eq(enrollment.status, 'ACTIVE')
           ));
         
         if (currentCount && currentCount.count >= section.capacity) {
           throw new Error('Class section is at full capacity');
         }
       }
      
      // Mark old active enrollment in same year as TRANSFERRED_OUT (if exists)
      await tx.update(enrollment)
        .set({ status: 'TRANSFERRED_OUT', exitedOn: joinedOn ?? null })
        .where(and(
          eq(enrollment.studentProfileId, studentProfileId),
          eq(enrollment.academicYearId, academicYearId),
          eq(enrollment.status, 'ACTIVE')
        ));
      
      // Create new enrollment
      const [newEnrollment] = await tx.insert(enrollment).values({
        studentProfileId, classSectionId, academicYearId,
        status: 'ACTIVE', joinedOn: joinedOn ?? null, rollNo: rollNo ?? null
      }).returning();
      
      // Audit
      if (newEnrollment) {
        const actor = actorFromReq(req);
        await writeAudit(tx, {
          actorUserId: actor.userId ?? null,
          actorRoles: actor.roles ?? null,
          ip: actor.ip ?? null,
          action: 'ENROLL',
          entityType: 'enrollment',
          entityId: newEnrollment.id,
          summary: 'Student enrolled in class section',
          meta: {
            studentProfileId,
            classSectionId,
            academicYearId,
            rollNo: rollNo ?? null,
          },
        });
      }
    });
    
    res.status(201).json({ ok: true });
  } catch (error: any) {
    if (error.message === 'Class section not found') {
      return res.status(404).json({ error: { message: 'Class section not found' } });
    }
    if (error.message === 'Class section is at full capacity') {
      return res.status(400).json({ error: { message: 'Class section is at full capacity' } });
    }
    throw error;
  }
});

router.post('/enrollments/transfer', validate(TransferDto), async (req, res) => {
  const { studentProfileId, fromClassSectionId, toClassSectionId, academicYearId, effectiveOn, newRollNo } = req.body;
  
  try {
    await db.transaction(async tx => {
      // Check capacity of destination section before transferring
      const [toSection] = await tx.select({ capacity: classSection.capacity })
        .from(classSection)
        .where(eq(classSection.id, toClassSectionId));
      
      if (!toSection) {
        throw new Error('Destination class section not found');
      }
      
      if (toSection.capacity) {
         const [currentCount] = await tx.select({ count: count() })
           .from(enrollment)
           .where(and(
             eq(enrollment.classSectionId, toClassSectionId),
             eq(enrollment.status, 'ACTIVE')
           ));
         
         if (currentCount && currentCount.count >= toSection.capacity) {
           throw new Error('Destination class section is at full capacity');
         }
       }
      
      // Transfer from old section
      await tx.update(enrollment)
        .set({ status: 'TRANSFERRED_OUT', exitedOn: effectiveOn ?? null })
        .where(and(
          eq(enrollment.studentProfileId, studentProfileId),
          eq(enrollment.academicYearId, academicYearId),
          eq(enrollment.classSectionId, fromClassSectionId),
          eq(enrollment.status, 'ACTIVE')
        ));
      
      // Create new enrollment in destination section
       const [newEnrollment] = await tx.insert(enrollment).values({
         studentProfileId, classSectionId: toClassSectionId, academicYearId,
         status: 'ACTIVE', joinedOn: effectiveOn ?? null, rollNo: newRollNo ?? null
       }).returning();
       
       // Audit
       if (newEnrollment) {
         const actor = actorFromReq(req);
         await writeAudit(tx, {
           actorUserId: actor.userId ?? null,
           actorRoles: actor.roles ?? null,
           ip: actor.ip ?? null,
           action: 'TRANSFER',
           entityType: 'enrollment',
           entityId: newEnrollment.id,
           summary: 'Student transferred between class sections',
           meta: {
             studentProfileId,
             fromClassSectionId,
             toClassSectionId,
             academicYearId,
             newRollNo: newRollNo ?? null,
           },
         });
       }
    });
    
    res.json({ ok: true });
  } catch (error: any) {
    if (error.message === 'Destination class section not found') {
      return res.status(404).json({ error: { message: 'Destination class section not found' } });
    }
    if (error.message === 'Destination class section is at full capacity') {
      return res.status(400).json({ error: { message: 'Destination class section is at full capacity' } });
    }
    throw error;
  }
});

/* Withdraw & graduate */
router.post('/enrollments/withdraw', validate(WithdrawDto), async (req, res) => {
  const { studentProfileId, classSectionId, academicYearId, exitedOn, reason } = req.body;
  const [row] = await db.update(enrollment)
    .set({ status: 'WITHDRAWN', exitedOn, exitReason: reason ?? null })
    .where(and(
      eq(enrollment.studentProfileId, studentProfileId),
      eq(enrollment.academicYearId, academicYearId),
      eq(enrollment.classSectionId, classSectionId),
      eq(enrollment.status, 'ACTIVE')
    )).returning();
  
  if (!row) return res.status(404).json({ error: { message: 'Active enrollment not found' } });
  
  // Audit
  {
    const actor = actorFromReq(req);
    await writeAudit(db, {
      actorUserId: actor.userId ?? null,
      actorRoles: actor.roles ?? null,
      ip: actor.ip ?? null,
      action: 'WITHDRAW',
      entityType: 'enrollment',
      entityId: row.id,
      summary: 'Student withdrawn from class section',
      meta: {
        studentProfileId,
        classSectionId,
        academicYearId,
        reason: reason ?? null,
      },
    });
  }
  
  res.json({ ok: true });
});

router.post('/enrollments/graduate', validate(GraduateDto), async (req, res) => {
  const { studentProfileId, academicYearId, graduatedOn } = req.body;
  const [row] = await db.update(enrollment)
    .set({ status: 'GRADUATED', exitedOn: graduatedOn ?? null })
    .where(and(
      eq(enrollment.studentProfileId, studentProfileId),
      eq(enrollment.academicYearId, academicYearId),
      eq(enrollment.status, 'ACTIVE')
    )).returning();
  
  if (!row) return res.status(404).json({ error: { message: 'Active enrollment not found' } });
  
  // Audit
  {
    const actor = actorFromReq(req);
    await writeAudit(db, {
      actorUserId: actor.userId ?? null,
      actorRoles: actor.roles ?? null,
      ip: actor.ip ?? null,
      action: 'GRADUATE',
      entityType: 'enrollment',
      entityId: row.id,
      summary: 'Student graduated',
      meta: {
        studentProfileId,
        academicYearId,
        graduatedOn: graduatedOn ?? null,
      },
    });
  }
  
  res.json({ ok: true });
});

/* Queries */
router.get('/class-sections/:id/students', async (req, res) => {
  const sectionId = req.params.id;
  const rows = await db
    .select({
      id: enrollment.studentProfileId, // for client compatibility
      studentProfileId: enrollment.studentProfileId,
      enrollmentId: enrollment.id,
      rollNo: enrollment.rollNo,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      userId: profiles.userId,
    })
    .from(enrollment)
    .leftJoin(profiles, eq(profiles.id, enrollment.studentProfileId))
    .where(and(eq(enrollment.classSectionId, sectionId), eq(enrollment.status, 'ACTIVE')));
  res.json(rows);
});

router.get('/students/:profileId/enrollments', async (req, res) => {
  const studentId = req.params.profileId;
  const yearId = req.query.yearId as string | undefined;
  const where = yearId
    ? and(eq(enrollment.studentProfileId, studentId), eq(enrollment.academicYearId, yearId))
    : eq(enrollment.studentProfileId, studentId);
  const rows = await db.select().from(enrollment).where(where);
  res.json(rows);
});

/* Roll numbers */
router.patch('/enrollments/roll-no', validate(SetRollNoDto), async (req, res) => {
  const { classSectionId, studentProfileId, rollNo } = req.body;
  const [row] = await db.update(enrollment)
    .set({ rollNo })
    .where(and(eq(enrollment.classSectionId, classSectionId), eq(enrollment.studentProfileId, studentProfileId)))
    .returning();
  if (!row) return res.status(404).json({ error: { message: 'Enrollment not found' } });
  res.json({ ok: true });
});

/* Guardian links */
router.post('/links/guardian-student', validate(LinkGuardianDto), async (req, res) => {
  const { guardianProfileId, studentProfileId, linkType, isPrimary } = req.body;
  
  await db.transaction(async tx => {
    // If setting this guardian as primary, set all other guardians for this student to non-primary
    if (isPrimary) {
      await tx.update(guardianStudent)
        .set({ isPrimary: false })
        .where(and(
          eq(guardianStudent.studentProfileId, studentProfileId),
          eq(guardianStudent.isPrimary, true)
        ));
    }
    
    // Remove existing link if it exists (upsert behavior)
    await tx.delete(guardianStudent)
      .where(and(
        eq(guardianStudent.guardianProfileId, guardianProfileId),
        eq(guardianStudent.studentProfileId, studentProfileId)
      ));
    
    // Create new link
     await tx.insert(guardianStudent).values({
       guardianProfileId, studentProfileId, linkType: linkType ?? null, isPrimary: !!isPrimary,
     });
     
     // Audit
     {
       const actor = actorFromReq(req);
       await writeAudit(tx, {
         actorUserId: actor.userId ?? null,
         actorRoles: actor.roles ?? null,
         ip: actor.ip ?? null,
         action: 'LINK_GUARDIAN',
         entityType: 'guardian_student',
         entityId: null,
         summary: 'Guardian linked to student',
         meta: {
           guardianProfileId,
           studentProfileId,
           linkType: linkType ?? null,
           isPrimary: !!isPrimary,
         },
       });
     }
  });
  
  res.status(201).json({ ok: true });
});

router.delete('/links/guardian-student', validate(UnlinkGuardianDto), async (req, res) => {
  const { guardianProfileId, studentProfileId } = req.body;
  const [row] = await db.delete(guardianStudent)
    .where(and(eq(guardianStudent.guardianProfileId, guardianProfileId), eq(guardianStudent.studentProfileId, studentProfileId)))
    .returning();
  
  if (!row) return res.status(404).json({ error: { message: 'Link not found' } });
  
  // Audit
  {
    const actor = actorFromReq(req);
    await writeAudit(db, {
      actorUserId: actor.userId ?? null,
      actorRoles: actor.roles ?? null,
      ip: actor.ip ?? null,
      action: 'UNLINK_GUARDIAN',
      entityType: 'guardian_student',
      entityId: null,
      summary: 'Guardian unlinked from student',
      meta: {
        guardianProfileId,
        studentProfileId,
      },
    });
  }
  
  res.json({ ok: true });
});

router.get('/students/:profileId/guardians', async (req, res) => {
  const studentId = req.params.profileId;
  const rows = await db.select().from(guardianStudent)
    .where(eq(guardianStudent.studentProfileId, studentId));
  res.json(rows);
});

router.get('/guardians/:profileId/students', async (req, res) => {
  const guardianId = req.params.profileId;
  const rows = await db.select().from(guardianStudent)
    .where(eq(guardianStudent.guardianProfileId, guardianId));
  res.json(rows);
});

// Get all students (profiles with STUDENT role)
router.get('/students', async (req, res) => {
  const students = await db.select({
    id: profiles.id,
    firstName: profiles.firstName,
    lastName: profiles.lastName,
    phone: profiles.phone,
    userId: profiles.userId,
    rollNo: enrollment.rollNo
  })
  .from(profiles)
  .innerJoin(userRoles, eq(userRoles.userId, profiles.userId))
  .leftJoin(enrollment, and(
    eq(enrollment.studentProfileId, profiles.id),
    eq(enrollment.status, 'ACTIVE')
  ))
  .where(eq(userRoles.role, 'STUDENT'));
  
  res.json(students);
});

// Get all guardians (profiles with GUARDIAN role)
router.get('/guardians', async (req, res) => {
  const guardians = await db.select({
    id: profiles.id,
    firstName: profiles.firstName,
    lastName: profiles.lastName,
    phone: profiles.phone,
    userId: profiles.userId
  })
  .from(profiles)
  .innerJoin(userRoles, eq(userRoles.userId, profiles.userId))
  .where(eq(userRoles.role, 'GUARDIAN'));
  
  res.json(guardians);
});

// Get all guardian-student links
router.get('/links/guardian-student', async (req, res) => {
  const links = await db.select({
    guardianProfileId: guardianStudent.guardianProfileId,
    studentProfileId: guardianStudent.studentProfileId,
    linkType: guardianStudent.linkType,
    isPrimary: guardianStudent.isPrimary
  })
  .from(guardianStudent);
  
  res.json(links);
});

// Get all enrollments
router.get('/enrollments', async (req, res) => {
  const enrollments = await db.select({
    id: enrollment.id,
    studentProfileId: enrollment.studentProfileId,
    classSectionId: enrollment.classSectionId,
    academicYearId: enrollment.academicYearId,
    status: enrollment.status,
    joinedOn: enrollment.joinedOn,
    exitedOn: enrollment.exitedOn,
    exitReason: enrollment.exitReason,
    rollNo: enrollment.rollNo
  })
  .from(enrollment);
  
  res.json(enrollments);
});

export default router;