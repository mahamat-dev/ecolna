import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/client';
import {
  disciplineCategory, disciplineCategoryTranslation, disciplineIncident, disciplineIncidentParticipant,
  disciplineIncidentAttachment, disciplineAction, detentionSession, detentionSessionEnrollment, detentionSessionAttendance,
  profiles, guardianStudent
} from '../../db/schema';
import { CreateCategoryDto, CreateIncidentDto, UpdateIncidentDto, AddActionDto, CompleteActionDto,
  CreateDetentionDto, EnrollDetentionDto, MarkAttendanceDto, ListIncidentsQuery, PublishDto } from './dto';
import { requireAuth, requireRoles } from '../../middlewares/rbac';
import { writeAudit, actorFromReq } from '../admin-utils/audit.service';
import { and, desc, eq, inArray, lt } from 'drizzle-orm';
import { rolesOf, teacherHasStudent, isPrivileged } from './authz';
import { fileObject } from '../../db/schema/content';

export const disciplineRouter = Router();
disciplineRouter.use(requireAuth);

// Helper to get session info with profile lookup
async function viewer(req: any) {
  const userId = req.session?.user?.id as string | undefined;
  if (!userId) throw Object.assign(new Error('Not authenticated'), { status: 401 });
  const [p] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  if (!p) throw Object.assign(new Error('Profile not found'), { status: 400 });
  return { userId, profileId: p.id as string };
}

/** Categories */
disciplineRouter.post('/discipline/categories', requireRoles(['ADMIN','STAFF']), async (req, res, next) => {
  try {
    const dto = CreateCategoryDto.parse(req.body);
    const [cat] = await db.insert(disciplineCategory).values({ code: dto.code, defaultPoints: dto.defaultPoints }).returning();
    if (dto.translations?.length) {
      await db.insert(disciplineCategoryTranslation).values(dto.translations.map(t => ({
        categoryId: cat.id, locale: t.locale, name: t.name, description: t.description ?? null,
      })));
    }
    const actor = actorFromReq(req);
    await writeAudit(db, { action: 'DISC_CAT_CREATE', entityType: 'DISC_CAT', entityId: cat.id, summary: dto.code, actorUserId: actor.userId, actorRoles: actor.roles, ip: actor.ip });
    res.status(201).json(cat);
  } catch (e) { next(e); }
});

disciplineRouter.get('/discipline/categories', async (_req, res, next) => {
  try {
    const rows = await db.select().from(disciplineCategory).orderBy(desc(disciplineCategory.createdAt));
    res.json({ items: rows });
  } catch (e) { next(e); }
});

/** Incidents */
disciplineRouter.post('/discipline/incidents', async (req: any, res, next) => {
  try {
    const dto = CreateIncidentDto.parse(req.body);
    const { userId, profileId } = await viewer(req);
    const roles: string[] = await rolesOf(userId);
    if (!isPrivileged(roles) && roles.includes('TEACHER')) {
      for (const p of dto.participants) {
        if (p.role !== 'WITNESS') {
          const ok = await teacherHasStudent(profileId, p.profileId);
          if (!ok) return res.status(403).json({ error: { code: 'NOT_ALLOWED', message: 'Student out of scope' } });
        }
      }
    }
    if (!(isPrivileged(roles) || roles.includes('TEACHER'))) {
      return res.status(403).json({ error: { code: 'NOT_ALLOWED', message: 'Forbidden' } });
    }

    const [inc] = await db.insert(disciplineIncident).values({
      categoryId: dto.categoryId ?? null,
      summary: dto.summary,
      details: dto.details ?? null,
      occurredAt: dto.occurredAt,
      location: dto.location ?? null,
      classSectionId: dto.classSectionId ?? null,
      reportedByProfileId: profileId,
    }).returning();

    if (!inc) throw new Error('Failed to create incident');

    if (dto.participants?.length) {
      await db.insert(disciplineIncidentParticipant).values(dto.participants.map(p => ({
        incidentId: inc.id, profileId: p.profileId, role: p.role as any, note: p.note ?? null,
      })));
    }
    if (dto.attachments?.length) {
      // ensure files exist
      const files = await db.select().from(fileObject).where(inArray(fileObject.id, dto.attachments as any));
      if (files.length) await db.insert(disciplineIncidentAttachment).values(files.map(f => ({ incidentId: inc.id, fileId: f.id })));
    }

    const actor = actorFromReq(req);
    await writeAudit(db, { action: 'DISC_INCIDENT_CREATE', entityType: 'DISC_INCIDENT', entityId: inc.id, summary: inc.summary, actorUserId: actor.userId, actorRoles: actor.roles, ip: actor.ip });
    res.status(201).json(inc);
  } catch (e) { next(e); }
});

disciplineRouter.patch('/discipline/incidents/:id', async (req: any, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const dto = UpdateIncidentDto.parse(req.body);
    const [existing] = await db.select().from(disciplineIncident).where(eq(disciplineIncident.id, id));
    if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Incident not found' } });

    const { userId, profileId } = await viewer(req);
    const roles: string[] = await rolesOf(userId);
    if (!(isPrivileged(roles) || existing.reportedByProfileId === profileId)) {
      return res.status(403).json({ error: { code: 'NOT_ALLOWED', message: 'Forbidden' } });
    }

    const [row] = await db.update(disciplineIncident).set({
      categoryId: dto.categoryId ?? undefined,
      summary: dto.summary ?? undefined,
      details: dto.details ?? undefined,
      occurredAt: dto.occurredAt ?? undefined,
      location: dto.location ?? undefined,
      classSectionId: dto.classSectionId ?? undefined,
      status: dto.status as any ?? undefined,
      visibility: dto.visibility as any ?? undefined,
      updatedAt: new Date(),
      resolvedAt: dto.status === 'RESOLVED' ? new Date() : undefined,
    }).where(eq(disciplineIncident.id, id)).returning();

    const actor = actorFromReq(req);
    await writeAudit(db, { action: 'DISC_INCIDENT_UPDATE', entityType: 'DISC_INCIDENT', entityId: id, summary: '', actorUserId: actor.userId, actorRoles: actor.roles, ip: actor.ip });
    res.json(row);
  } catch (e) { next(e); }
});

// Add participants to an incident (Admin/Staff or reporter; Teacher limited to their students)
disciplineRouter.post('/discipline/incidents/:id/participants', async (req: any, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const items = z.array(z.object({ profileId: z.string().uuid(), role: z.enum(['PERPETRATOR','VICTIM','WITNESS']), note: z.string().max(1000).optional() })).parse(req.body?.participants ?? req.body);
    const [inc] = await db.select().from(disciplineIncident).where(eq(disciplineIncident.id, id));
    if (!inc) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Incident not found' } });
    const { userId, profileId } = await viewer(req);
    const roles: string[] = await rolesOf(userId);
    if (!(isPrivileged(roles) || inc.reportedByProfileId === profileId || roles.includes('TEACHER'))) {
      return res.status(403).json({ error: { code: 'NOT_ALLOWED', message: 'Forbidden' } });
    }
    if (!isPrivileged(roles) && roles.includes('TEACHER')) {
      for (const p of items) {
        if (p.role !== 'WITNESS') {
          const ok = await teacherHasStudent(profileId, p.profileId);
          if (!ok) return res.status(403).json({ error: { code: 'NOT_ALLOWED', message: 'Student out of scope' } });
        }
      }
    }
    await db.insert(disciplineIncidentParticipant).values(items.map(p => ({ incidentId: id, profileId: p.profileId, role: p.role as any, note: p.note ?? null }))).onConflictDoNothing();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Add attachments to an incident (Admin/Staff or reporter)
disciplineRouter.post('/discipline/incidents/:id/attachments', async (req: any, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const fileIds = z.array(z.string().uuid()).parse(req.body?.fileIds ?? req.body);
    const [inc] = await db.select().from(disciplineIncident).where(eq(disciplineIncident.id, id));
    if (!inc) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Incident not found' } });
    const { userId, profileId } = await viewer(req);
    const roles: string[] = await rolesOf(userId);
    if (!(isPrivileged(roles) || inc.reportedByProfileId === profileId)) return res.status(403).json({ error: { code: 'NOT_ALLOWED', message: 'Forbidden' } });
    const files = await db.select().from(fileObject).where(inArray(fileObject.id, fileIds as any));
    if (!files.length) return res.status(400).json({ error: { code: 'NO_FILES', message: 'No valid files' } });
    await db.insert(disciplineIncidentAttachment).values(files.map(f => ({ incidentId: id, fileId: f.id }))).onConflictDoNothing();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

disciplineRouter.post('/discipline/incidents/:id/actions', async (req: any, res, next) => {
  try {
    const incidentId = z.string().uuid().parse(req.params.id);
    const dto = AddActionDto.parse(req.body);
    const { userId, profileId } = await viewer(req);
    const roles: string[] = await rolesOf(userId);
    if (!isPrivileged(roles) && roles.includes('TEACHER')) {
      const ok = await teacherHasStudent(profileId, dto.profileId);
      if (!ok) return res.status(403).json({ error: { code: 'NOT_ALLOWED', message: 'Student out of scope' } });
    }
    if (!(isPrivileged(roles) || roles.includes('TEACHER'))) return res.status(403).json({ error: { code: 'NOT_ALLOWED', message: 'Forbidden' } });

    const [act] = await db.insert(disciplineAction).values({
      incidentId, profileId: dto.profileId, type: dto.type as any, points: dto.points ?? 0,
      dueAt: dto.dueAt ?? null, comment: dto.comment ?? null,
    }).returning();

    const actor = actorFromReq(req);
    await writeAudit(db, { action: 'DISC_ACTION_ASSIGN', entityType: 'DISC_ACTION', entityId: act.id, summary: `${dto.type} +${dto.points}`, actorUserId: actor.userId, actorRoles: actor.roles, ip: actor.ip });
    res.status(201).json(act);
  } catch (e) { next(e); }
});

disciplineRouter.post('/discipline/actions/:actionId/complete', async (req, res, next) => {
  try {
    const actionId = z.string().uuid().parse(req.params.actionId);
    const { completed, comment } = CompleteActionDto.parse(req.body);
    const [act] = await db.update(disciplineAction).set({ completedAt: completed ? new Date() : null, comment: comment ?? undefined })
      .where(eq(disciplineAction.id, actionId)).returning();
    if (!act) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Action not found' } });
    const actor = actorFromReq(req);
    await writeAudit(db, { action: completed ? 'DISC_ACTION_COMPLETE' : 'DISC_ACTION_REOPEN', entityType: 'DISC_ACTION', entityId: actionId, summary: '', actorUserId: actor.userId, actorRoles: actor.roles, ip: actor.ip });
    res.json(act);
  } catch (e) { next(e); }
});

disciplineRouter.post('/discipline/incidents/:id/publish', requireRoles(['ADMIN','STAFF']), async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const { visibility } = PublishDto.parse(req.body);
    const [row] = await db.update(disciplineIncident).set({ visibility: visibility as any, updatedAt: new Date() })
      .where(eq(disciplineIncident.id, id)).returning();
    const actor = actorFromReq(req);
    await writeAudit(db, { action: 'DISC_INCIDENT_PUBLISH', entityType: 'DISC_INCIDENT', entityId: id, summary: `visibility=${visibility}`, actorUserId: actor.userId, actorRoles: actor.roles, ip: actor.ip });
    res.json(row);
  } catch (e) { next(e); }
});

disciplineRouter.get('/discipline/incidents/:id', async (req: any, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const [inc] = await db.select().from(disciplineIncident).where(eq(disciplineIncident.id, id));
    if (!inc) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Incident not found' } });
    const { userId, profileId } = await viewer(req);
    const roles: string[] = await rolesOf(userId);
    const isOwner = inc.reportedByProfileId === profileId;
    const parts = await db.select().from(disciplineIncidentParticipant).where(eq(disciplineIncidentParticipant.incidentId, id));
    const acts = await db.select().from(disciplineAction).where(eq(disciplineAction.incidentId, id));
    const atts = await db.select().from(disciplineIncidentAttachment).where(eq(disciplineIncidentAttachment.incidentId, id));

    const myPid = profileId;
    const isStudentSelf = parts.some(p => p.profileId === myPid && p.role === 'PERPETRATOR');
    if (!isPrivileged(roles) && !isOwner && !roles.includes('TEACHER')) {
      if (inc.visibility === 'PRIVATE') return res.status(403).json({ error: { code: 'NOT_ALLOWED', message: 'Private incident' } });
      if (inc.visibility === 'STUDENT' && !isStudentSelf) return res.status(403).json({ error: { code: 'NOT_ALLOWED', message: 'Student-only' } });
    }
    res.json({ incident: inc, participants: parts, actions: acts, attachments: atts });
  } catch (e) { next(e); }
});

disciplineRouter.get('/discipline/incidents', async (req: any, res, next) => {
  try {
    const q = ListIncidentsQuery.parse(req.query);
    const { userId, profileId } = await viewer(req);
    const roles: string[] = await rolesOf(userId);

    const conds: any[] = [];
    if (q.status) conds.push(eq(disciplineIncident.status, q.status as any));
    if (q.myReported === 'true') conds.push(eq(disciplineIncident.reportedByProfileId, profileId));
    let idsFilter: string[] | null = null;
    if (q.studentProfileId) {
      const rows = await db.select().from(disciplineIncidentParticipant)
        .where(and(eq(disciplineIncidentParticipant.profileId, q.studentProfileId), inArray(disciplineIncidentParticipant.role, ['PERPETRATOR','VICTIM'] as any)));
      idsFilter = rows.map(r => r.incidentId);
      if (!idsFilter.length) return res.json({ items: [], nextCursor: null });
    }
    let base = db.select().from(disciplineIncident);
    if (conds.length) base = base.where((and as any)(...conds));
    let rows = await base.orderBy(desc(disciplineIncident.createdAt)).limit(q.limit);
    if (idsFilter) rows = rows.filter(r => idsFilter!.includes(r.id));
    if (!isPrivileged(roles)) rows = rows.filter(r => r.visibility !== 'PRIVATE' || r.reportedByProfileId === profileId);
    const nextCursor = rows.length ? rows[rows.length - 1].createdAt?.toISOString() : null;
    res.json({ items: rows, nextCursor });
  } catch (e) { next(e); }
});

disciplineRouter.delete('/discipline/incidents/:id', async (req: any, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const [inc] = await db.select().from(disciplineIncident).where(eq(disciplineIncident.id, id));
    if (!inc) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Incident not found' } });
    const { userId, profileId } = viewer(req);
    const roles: string[] = await rolesOf(userId);
    if (!(isPrivileged(roles) || inc.reportedByProfileId === profileId)) return res.status(403).json({ error: { code: 'NOT_ALLOWED', message: 'Not allowed' } });
    await db.delete(disciplineIncident).where(eq(disciplineIncident.id, id));
    const actor = actorFromReq(req);
    await writeAudit(db, { action: 'DISC_INCIDENT_DELETE', entityType: 'DISC_INCIDENT', entityId: id, summary: '', actorUserId: actor.userId, actorRoles: actor.roles, ip: actor.ip });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/** Detention sessions */
disciplineRouter.post('/discipline/detention-sessions', requireRoles(['ADMIN','STAFF']), async (req: any, res, next) => {
  try {
    const dto = CreateDetentionDto.parse(req.body);
    const { profileId } = viewer(req);
    const [row] = await db.insert(detentionSession).values({
      title: dto.title,
      dateTime: dto.dateTime,
      durationMinutes: dto.durationMinutes,
      room: dto.room ?? null,
      capacity: dto.capacity,
      createdByProfileId: profileId,
    }).returning();
    const actor = actorFromReq(req);
    await writeAudit(db, { action: 'DISC_DETENTION_CREATE', entityType: 'DISC_DETENTION', entityId: row.id, summary: row.title, actorUserId: actor.userId, actorRoles: actor.roles, ip: actor.ip });
    res.status(201).json(row);
  } catch (e) { next(e); }
});

disciplineRouter.get('/discipline/detention-sessions', requireRoles(['ADMIN','STAFF']), async (_req, res, next) => {
  try {
    const rows = await db.select().from(detentionSession).orderBy(desc(detentionSession.dateTime));
    res.json({ items: rows });
  } catch (e) { next(e); }
});

// List enrollments for a session with attendance and student names
disciplineRouter.get('/discipline/detention-sessions/:id/enrollments', requireRoles(['ADMIN','STAFF']), async (req, res, next) => {
  try {
    const sessionId = z.string().uuid().parse(req.params.id);
    const enrolls = await db.select({
      sessionId: detentionSessionEnrollment.sessionId,
      actionId: detentionSessionEnrollment.actionId,
      studentProfileId: detentionSessionEnrollment.studentProfileId,
    }).from(detentionSessionEnrollment).where(eq(detentionSessionEnrollment.sessionId, sessionId));
    const pids = Array.from(new Set(enrolls.map(e => e.studentProfileId)));
    const names = pids.length ? await db.select({ id: profiles.id, firstName: profiles.firstName, lastName: profiles.lastName })
      .from(profiles).where(inArray(profiles.id, pids as any)) : [];
    const nameMap = new Map(names.map(n => [n.id, `${n.firstName ?? ''} ${n.lastName ?? ''}`.trim()] as const));
    const att = await db.select().from(detentionSessionAttendance).where(eq(detentionSessionAttendance.sessionId, sessionId));
    const attMap = new Map(att.map(a => [a.studentProfileId as string, !!a.present] as const));
    const items = enrolls.map(e => ({
      actionId: e.actionId,
      studentProfileId: e.studentProfileId,
      studentName: nameMap.get(e.studentProfileId) ?? '',
      present: attMap.get(e.studentProfileId) ?? false,
    }));
    res.json({ items });
  } catch (e) { next(e); }
});

disciplineRouter.post('/discipline/detention-sessions/:id/enroll', requireRoles(['ADMIN','STAFF']), async (req, res, next) => {
  try {
    const sessionId = z.string().uuid().parse(req.params.id);
    const dto = EnrollDetentionDto.parse({ ...req.body, sessionId });
    const [s] = await db.select().from(detentionSession).where(eq(detentionSession.id, sessionId));
    if (!s) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
    const [act] = await db.select().from(disciplineAction).where(eq(disciplineAction.id, dto.actionId));
    if (!act || act.type !== 'DETENTION' || act.profileId !== dto.studentProfileId) {
      return res.status(400).json({ error: { code: 'INVALID_ACTION', message: 'Action not detention for this student' } });
    }
    const current = await db.select().from(detentionSessionEnrollment).where(eq(detentionSessionEnrollment.sessionId, sessionId));
    if (current.length >= (s.capacity ?? 0)) return res.status(409).json({ error: { code: 'FULL', message: 'Session full' } });
    await db.insert(detentionSessionEnrollment).values({ sessionId, actionId: dto.actionId, studentProfileId: dto.studentProfileId }).onConflictDoNothing();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

disciplineRouter.post('/discipline/detention-sessions/:id/attendance/:studentProfileId', requireRoles(['ADMIN','STAFF']), async (req, res, next) => {
  try {
    const sessionId = z.string().uuid().parse(req.params.id);
    const studentProfileId = z.string().uuid().parse(req.params.studentProfileId);
    const { present } = MarkAttendanceDto.parse(req.body);
    await db.insert(detentionSessionAttendance).values({ sessionId, studentProfileId, present })
      .onConflictDoUpdate({ target: [detentionSessionAttendance.sessionId, detentionSessionAttendance.studentProfileId], set: { present, recordedAt: new Date() } });
    if (present) {
      const links = await db.select().from(detentionSessionEnrollment)
        .where(and(eq(detentionSessionEnrollment.sessionId, sessionId), eq(detentionSessionEnrollment.studentProfileId, studentProfileId)));
      for (const l of links) {
        await db.update(disciplineAction).set({ completedAt: new Date() }).where(eq(disciplineAction.id, l.actionId));
      }
    }
    const actor = actorFromReq(req);
    await writeAudit(db, { action: 'DISC_DETENTION_ATTEND', entityType: 'DISC_DETENTION', entityId: sessionId, summary: `present=${present}`, actorUserId: actor.userId, actorRoles: actor.roles, ip: actor.ip });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/** Student/Guardian views */
disciplineRouter.get('/discipline/my-record', async (req: any, res, next) => {
  try {
    const pid = req.session.profileId as string;
    const parts = await db.select().from(disciplineIncidentParticipant).where(eq(disciplineIncidentParticipant.profileId, pid));
    if (!parts.length) return res.json({ items: [], points: 0 });
    const ids = parts.map(p => p.incidentId);
    const incs = await db.select().from(disciplineIncident).where(inArray(disciplineIncident.id, ids as any));
    const visible = incs.filter(i => i.visibility !== 'PRIVATE');
    const acts = await db.select().from(disciplineAction).where(and(inArray(disciplineAction.incidentId, visible.map(v => v.id) as any), eq(disciplineAction.profileId, pid)));
    const points = acts.reduce((acc, a) => acc + (a.points || 0), 0);
    res.json({ items: visible, points });
  } catch (e) { next(e); }
});

disciplineRouter.get('/discipline/students/:studentProfileId/record', async (req: any, res, next) => {
  try {
    const studentProfileId = z.string().uuid().parse(req.params.studentProfileId);
    // verify guardian link
    const gid = req.session.profileId as string;
    const link = await db.select().from(guardianStudent).where(and(eq(guardianStudent.guardianProfileId, gid), eq(guardianStudent.studentProfileId, studentProfileId)));
    if (!link.length) return res.status(403).json({ error: { code: 'NOT_ALLOWED', message: 'Not a guardian of this student' } });
    const parts = await db.select().from(disciplineIncidentParticipant).where(eq(disciplineIncidentParticipant.profileId, studentProfileId));
    const ids = parts.map(p => p.incidentId);
    const incs = await db.select().from(disciplineIncident).where(inArray(disciplineIncident.id, ids as any));
    const visible = incs.filter(i => i.visibility === 'GUARDIAN');
    const acts = await db.select().from(disciplineAction).where(and(inArray(disciplineAction.incidentId, visible.map(v => v.id) as any), eq(disciplineAction.profileId, studentProfileId)));
    const points = acts.reduce((acc, a) => acc + (a.points || 0), 0);
    res.json({ items: visible, points });
  } catch (e) { next(e); }
});
