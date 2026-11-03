export const LOW_STOCK_THRESHOLD = 15;

export function formatMoney(cents, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

export function formatDate(isoString) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(isoString));
}

export function stockText(stock) {
  if (stock <= 0) return 'Out of stock';
  if (stock <= LOW_STOCK_THRESHOLD) return `Only ${stock} left`;
  return 'In stock';
}

export function itemCountText(count) {
  return `${count} ${count === 1 ? 'item' : 'items'}`;
}

export function sanitizeNext(next, origin = globalThis.location?.origin ?? 'http://localhost') {
  const fallback = '/account.html';
  if (typeof next !== 'string' || next.length === 0) return fallback;
  if (!next.startsWith('/') || next.startsWith('//')) return fallback;
  if (next.includes('\\') || /%5c/i.test(next)) return fallback;
  if ([...next].some((character) => character.charCodeAt(0) < 32)) return fallback;

  try {
    const url = new URL(next, origin);
    if (url.origin !== origin || url.pathname.startsWith('//')) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
