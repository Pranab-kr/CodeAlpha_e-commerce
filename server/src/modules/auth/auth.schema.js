import { z } from 'zod';

const email = z.string().trim().toLowerCase().pipe(z.string().email('Enter a valid email.'));

const password = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Use 72 characters or fewer.')
  .regex(/[A-Za-z]/, 'Use at least one letter.')
  .regex(/\d/, 'Use at least one number.');

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Enter at least 2 characters.')
    .max(80, 'Use 80 characters or fewer.'),
  email,
  password,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.').max(72, 'Use 72 characters or fewer.'),
});
