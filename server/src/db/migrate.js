import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { env, isProduction } from '../config/env.js';

const { Pool } = pg;
const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

async function migrateDatabase(connectionString) {
  const pool = new Pool({
    connectionString,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
    max: 1,
  });
  try {
    await migrate(drizzle(pool), { migrationsFolder });
  } finally {
    await pool.end();
  }
}

async function main() {
  await migrateDatabase(env.DATABASE_URL);
  console.log('Applied migrations to the development database.');

  if (!isProduction && env.TEST_DATABASE_URL) {
    await migrateDatabase(env.TEST_DATABASE_URL);
    console.log('Applied migrations to the test database.');
  }
}

main().catch((error) => {
  console.error('Migration failed.');
  console.error(error);
  process.exitCode = 1;
});
