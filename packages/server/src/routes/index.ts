import { Router } from 'express';
import healthRouter from './health.ts';
import identityRouter from '../modules/identity/routes.ts';
import academicsRouter from '../modules/academics/routes.ts';
import enrollmentRouter from '../modules/enrollment/routes.ts';
import teachingRouter from '../modules/teaching/routes.ts';
import attendanceRouter from '../modules/attendance/routes.ts';
import { auditRouter } from '../modules/admin-utils/audit.routes';
import { searchRouter } from '../modules/admin-utils/search.routes';
import { filesRouter } from '../modules/content/files.routes';
import { notesRouter } from '../modules/content/notes.routes';
import assessmentsRouter from '../modules/assessments/routes.ts';
import { messagesRouter } from '../modules/messages/routes.ts';
import { disciplineRouter } from '../modules/discipline/routes.ts';
import { financeRouter } from '../modules/finance/routes.ts';

const router = Router();

router.use('/health', healthRouter);
router.use('/', identityRouter);
router.use('/academics', academicsRouter);
router.use('/enrollment', enrollmentRouter);
router.use('/teaching', teachingRouter);
router.use('/attendance', attendanceRouter);
router.use('/admin/audit', auditRouter);
router.use('/admin/search', searchRouter);
router.use('/content', filesRouter);
router.use('/content', notesRouter);
router.use('/assessments', assessmentsRouter);
router.use('/messages', messagesRouter);
router.use('/', disciplineRouter);
router.use('/', financeRouter);

export default router;
