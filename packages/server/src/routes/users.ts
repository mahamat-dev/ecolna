import { Router } from 'express';
import { db } from '../db/client.ts';
import { users } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

const router = Router();

// List users
router.get('/', async (_req, res) => {
  const data = await db.select().from(users).limit(50);
  res.json(data);
});

// Create user
router.post('/', async (req, res) => {
  const { email, name } = req.body ?? {};
  if (!email) return res.status(400).json({ error: 'email is required' });
  const [row] = await db.insert(users).values({ email, name }).returning();
  res.status(201).json(row);
});

// Get user by id
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' });
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(row);
});

export default router;