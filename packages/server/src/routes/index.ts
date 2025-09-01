import { Router } from 'express';
import healthRouter from './health';
import identityRouter from '../modules/identity/routes';
import academicsRouter from '../modules/academics/routes.ts';

const router = Router();

router.use('/health', healthRouter);
router.use('/', identityRouter);
router.use('/academics', academicsRouter);

export default router;