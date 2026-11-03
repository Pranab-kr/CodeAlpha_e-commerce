import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { env, isProduction, isTest } from '../config/env.js';
import * as schema from './schema.js';

const { Pool } = pg;

const connectionString = isTest ? env.TEST_DATABASE_URL : env.DATABASE_URL;
const usesSsl = isProduction || /neon\.tech|sslmode=require/.test(connectionString);

export const pool = new Pool({
  connectionString,
  ssl: usesSsl ? { rejectUnauthorized: false } : false,
  max: 10,
});

export const db = drizzle(pool, { schema });

export async function closeDb() {
  await pool.end();
}
