import { Router } from 'express';
import healthRouter from './health';
import identityRouter from '../modules/identity/routes';

const router = Router();

router.use('/health', healthRouter);
router.use('/', identityRouter);

export default router;