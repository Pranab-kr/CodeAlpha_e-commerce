import { env } from '../config/env.js';

export function shippingFor(subtotalCents) {
  if (subtotalCents === 0 || subtotalCents >= env.FREE_SHIPPING_THRESHOLD_CENTS) return 0;
  return env.SHIPPING_FLAT_CENTS;
}

export function totalsFor(subtotalCents) {
  const shippingCents = shippingFor(subtotalCents);
  return { shippingCents, totalCents: subtotalCents + shippingCents };
}
