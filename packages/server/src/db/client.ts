import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
   throw new Error(
      'DATABASE_URL is not set. Please define it in your environment (e.g., packages/server/.env or project root .env).'
   );
}

export const queryClient = postgres(connectionString, {
   max: 10,
   idle_timeout: 20,
});

export const db = drizzle(queryClient);

export async function closeDb() {
   await queryClient.end({ timeout: 5 });
}
