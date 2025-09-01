import 'dotenv/config';
import { db } from '../src/db/client';
import { users, userRoles, profiles } from '../src/db/schema/identity';
import { hash as argon2Hash } from '@node-rs/argon2';

const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
const password = process.env.SEED_ADMIN_PASSWORD ?? 'AdminPass123';

const run = async () => {
  const passwordHash = await argon2Hash(password);
  const [u] = await db.insert(users).values({
    authMethod: 'EMAIL', email, passwordHash, isActive: true
  }).onConflictDoNothing().returning();

  if (!u) { console.log('Admin exists.'); return; }

  await db.insert(userRoles).values({ userId: u.id, role: 'ADMIN' });
  await db.insert(profiles).values({ userId: u.id, firstName: 'System', lastName: 'Admin' });
  console.log(`Seeded admin: ${email} / ${password}`);
};

run().catch(e => { console.error(e); process.exit(1); });