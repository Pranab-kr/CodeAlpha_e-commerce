import 'dotenv/config';
import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    APP_ORIGIN: z.string().url().default('http://localhost:3000'),
    DATABASE_URL: z.string().url(),
    TEST_DATABASE_URL: z.string().url().optional(),
    JWT_SECRET: z.string().min(32),
    JWT_ISSUER: z.string().default('bench-supply'),
    JWT_AUDIENCE: z.string().default('bench-supply-web'),
    JWT_ACCESS_TTL: z.string().default('15m'),
    REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
    SHIPPING_FLAT_CENTS: z.coerce.number().int().nonnegative().default(800),
    FREE_SHIPPING_THRESHOLD_CENTS: z.coerce.number().int().positive().default(10000),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === 'test' && !value.TEST_DATABASE_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['TEST_DATABASE_URL'],
        message: 'TEST_DATABASE_URL is required when NODE_ENV=test.',
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
