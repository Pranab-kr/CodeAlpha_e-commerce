import assert from 'node:assert/strict';
import { test } from 'node:test';
import { api } from './helpers.js';

test('GET /api/health reports the database is up', async () => {
  const response = await api().get('/api/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.data.status, 'ok');
  assert.equal(response.body.data.db, 'up');
  assert.equal(typeof response.body.data.uptimeSeconds, 'number');
  assert.match(response.body.data.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test('unknown API routes return a JSON 404', async () => {
  const response = await api().get('/api/does-not-exist');

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});
