import { db } from "../../db/client";
import { userRoles } from "../../db/schema/identity";
import { enrollment, guardianStudent } from "../../db/schema/enrollment";
import { teachingAssignment } from "../../db/schema/teaching";
import { classSectionSubject, classSection } from "../../db/schema/academics";
import { noteAudience } from "../../db/schema/content";
import { and, eq, inArray, sql } from "drizzle-orm";

export async function rolesOfUser(userId: string) {
  const rows = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  return rows.map(r => r.role);
}

export type Viewer = { userId: string; profileId: string; roles: string[] };

export async function canViewNote(viewer: Viewer, noteId: string) {
  // Admin and staff can view all notes
  if (viewer.roles.includes("ADMIN") || viewer.roles.includes("STAFF")) return true;

  // Check if note is targeted to ALL
  const [anyAll] = await db.select().from(noteAudience)
    .where(and(eq(noteAudience.noteId, noteId), eq(noteAudience.scope, "ALL" as any)));
  if (anyAll) return true;

  // Check role-based access
  if (viewer.roles.length) {
    const r = await db.select().from(noteAudience)
      .where(and(
        eq(noteAudience.noteId, noteId),
        eq(noteAudience.scope, "ROLE" as any),
        inArray(noteAudience.role, viewer.roles as any)
      ));
    if (r.length) return true;
  }

  // Check direct student/guardian targeting
  const direct = await db.select().from(noteAudience).where(and(
    eq(noteAudience.noteId, noteId),
    sql`(scope = 'STUDENT' AND student_profile_id = ${viewer.profileId}::uuid)
        OR (scope = 'GUARDIAN' AND guardian_profile_id = ${viewer.profileId}::uuid)`
  ));
  if (direct.length) return true;

  // Get all audience rules for this note
  const a = await db.select().from(noteAudience).where(eq(noteAudience.noteId, noteId));
  if (a.length === 0) return false;

  const isStudent = viewer.roles.includes("STUDENT");
  const isGuardian = viewer.roles.includes("GUARDIAN");
  const isTeacher = viewer.roles.includes("TEACHER");

  // Check student/guardian access through enrollments
  if (isStudent || isGuardian) {
    const studentProfileIds = isStudent 
      ? [viewer.profileId] 
      : (await db.select({ sid: guardianStudent.studentProfileId })
          .from(guardianStudent)
          .where(eq(guardianStudent.guardianProfileId, viewer.profileId))
        ).map(x => x.sid);

    if (studentProfileIds.length) {
      const enrs = await db.select({
        classSectionId: enrollment.classSectionId,
        gradeLevelId: classSection.gradeLevelId
      })
        .from(enrollment)
        .leftJoin(classSection, eq(enrollment.classSectionId, classSection.id))
        .where(inArray(enrollment.studentProfileId, studentProfileIds as any));
      const sectionIds = new Set(enrs.map(e => e.classSectionId));
      const gradeLevelIds = new Set(enrs.map(e => e.gradeLevelId).filter(Boolean));

      // Check class section targeting
      if (a.some(x => x.scope === "CLASS_SECTION" && x.classSectionId && sectionIds.has(x.classSectionId))) {
        return true;
      }

      // Check grade level targeting
      if (a.some(x => x.scope === "GRADE_LEVEL" && x.gradeLevelId && gradeLevelIds.has(x.gradeLevelId))) {
        return true;
      }

      // Check subject targeting through class sections
      const subjectTargets = new Set(a.filter(x => x.scope === "SUBJECT").map(x => x.subjectId!).filter(Boolean));
      if (subjectTargets.size && sectionIds.size) {
        const links = await db.select().from(classSectionSubject)
          .where(inArray(classSectionSubject.classSectionId, [...sectionIds] as any));
        if (links.some(l => subjectTargets.has(l.subjectId))) return true;
      }
    }
  }

  // Check teacher access through teaching assignments
  if (isTeacher) {
    const assigns = await db.select().from(teachingAssignment)
      .where(eq(teachingAssignment.teacherProfileId, viewer.profileId));
    const secIds = new Set(assigns.map(a => a.classSectionId));
    const subjIds = new Set(assigns.map(a => a.subjectId).filter(Boolean) as string[]);

    // Check class section targeting
    if (a.some(x => x.scope === "CLASS_SECTION" && x.classSectionId && secIds.has(x.classSectionId))) {
      return true;
    }

    // Check subject targeting
    if (a.some(x => x.scope === "SUBJECT" && x.subjectId && subjIds.has(x.subjectId))) {
      return true;
    }
  }

  return false;
}