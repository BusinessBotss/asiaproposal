import { Pool } from 'pg';
import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = readFileSync(resolve(__dirname, './db.sql'), 'utf8');
  await pool.query(sql);
  await pool.end();
}

run().then(() => {
  // eslint-disable-next-line no-console
  console.log('Migration complete');
  process.exit(0);
}).catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});