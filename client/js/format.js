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
