import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatPrice, setCurrency } from '../../client/js/currency.js';
import { formatDate, formatMoney, sanitizeNext, stockText } from '../../client/js/format.js';

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

test('formatPrice defaults to INR and converts the server USD amount', () => {
  assert.equal(formatPrice(12900, 'USD'), '₹10,707');
});

test('formatPrice follows the selected currency', () => {
  setCurrency('USD');
  assert.equal(formatPrice(12900, 'USD'), '$129.00');
  setCurrency('EUR');
  assert.equal(formatPrice(12900, 'USD'), '118,68\xa0€');
  setCurrency('INR');
});

test('sanitizeNext keeps same-origin paths and rejects external targets', () => {
  const origin = 'http://localhost:3000';

  assert.equal(sanitizeNext('/cart.html?x=1', origin), '/cart.html?x=1');
  assert.equal(sanitizeNext('/account.html', origin), '/account.html');
  assert.equal(sanitizeNext('https://evil.example', origin), '/account.html');
  assert.equal(sanitizeNext('http://localhost:3001/account.html', origin), '/account.html');
  assert.equal(sanitizeNext('//evil.example', origin), '/account.html');
  assert.equal(sanitizeNext('javascript:alert(1)', origin), '/account.html');
  assert.equal(sanitizeNext('\\\\evil.example', origin), '/account.html');
  assert.equal(sanitizeNext('/\\evil.example', origin), '/account.html');
  assert.equal(sanitizeNext('/%5cevil.example', origin), '/account.html');
  assert.equal(sanitizeNext('/..//evil.example', origin), '/account.html');
  assert.equal(sanitizeNext('', origin), '/account.html');
  assert.equal(sanitizeNext(undefined, origin), '/account.html');
});
