import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors.js';

export async function charge({ amountCents, currency, method }) {
  if (method !== 'mock') {
    throw new AppError(422, 'VALIDATION_ERROR', 'Only the demo payment method is available.');
  }

  return {
    reference: `mock_${randomUUID()}`,
    status: 'paid',
    amountCents,
    currency,
  };
}
