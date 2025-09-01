import { Router } from 'express';
import healthRouter from './health.ts';
import identityRouter from '../modules/identity/routes.ts';
import academicsRouter from '../modules/academics/routes.ts';
import enrollmentRouter from '../modules/enrollment/routes.ts';

const router = Router();

router.use('/health', healthRouter);
router.use('/', identityRouter);
router.use('/academics', academicsRouter);
router.use('/enrollment', enrollmentRouter);

export default router;