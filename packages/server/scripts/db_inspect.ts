import 'dotenv/config';
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('No DATABASE_URL set');
    process.exit(1);
  }
  console.log('DATABASE_URL =', url);
  const sql = postgres(url, { max: 1 });
  try {
    const tables = await sql<{schemaname: string; tablename: string}[]>`select schemaname, tablename from pg_tables where tablename = ${'audit_log'}`;
    console.log('tables:', tables);
    const cols = await sql<{column_name: string; data_type: string}[]>`select column_name, data_type from information_schema.columns where table_schema = ${'public'} and table_name = ${'audit_log'} order by ordinal_position`;
    console.log('columns:', cols);
  } finally {
    await sql.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });