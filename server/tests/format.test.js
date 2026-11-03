import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatDate, formatMoney, stockText } from '../../client/js/format.js';

test('formatMoney renders integer cents as USD', () => {
  assert.equal(formatMoney(12900), '$129.00');
  assert.equal(formatMoney(0), '$0.00');
  assert.equal(formatMoney(900), '$9.00');
});

test('formatDate renders an ISO timestamp as a short date', () => {
  assert.equal(formatDate('2026-11-03T10:00:00.000Z'), 'Nov 3, 2026');
});

test('stockText describes stock states honestly', () => {
  assert.equal(stockText(0), 'Out of stock');
  assert.equal(stockText(12), 'Only 12 left');
  assert.equal(stockText(24), 'In stock');
});
