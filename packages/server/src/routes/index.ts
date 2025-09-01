import { Router } from 'express';
import healthRouter from './health.ts';
import identityRouter from '../modules/identity/routes.ts';
import academicsRouter from '../modules/academics/routes.ts';
import enrollmentRouter from '../modules/enrollment/routes.ts';
import teachingRouter from '../modules/teaching/routes.ts';
import attendanceRouter from '../modules/attendance/routes.ts';

const router = Router();

router.use('/health', healthRouter);
router.use('/', identityRouter);
router.use('/academics', academicsRouter);
router.use('/enrollment', enrollmentRouter);
router.use('/teaching', teachingRouter);
router.use('/attendance', attendanceRouter);

export default router;