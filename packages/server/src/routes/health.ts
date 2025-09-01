import { Router } from 'express';
import { db } from '../db/client.ts';
import { sql } from 'drizzle-orm';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

router.get('/db', async (_req, res) => {
  try {
    await db.execute(sql`select 1`);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

export default router;