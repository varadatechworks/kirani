import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, apiRequest } from '../apps/mobile/src/api.js';

test('native API client fails closed when no API origin is configured', async () => {
  await assert.rejects(
    () => apiRequest('/session/me', { token: 'not-used' }),
    error => error instanceof ApiError && error.code === 'API_NOT_CONFIGURED' && error.status === 0
  );
});

test('native API error type preserves safe status and machine code', () => {
  const error = new ApiError('Forbidden', 403, 'FORBIDDEN');
  assert.equal(error.name, 'ApiError');
  assert.equal(error.status, 403);
  assert.equal(error.code, 'FORBIDDEN');
});
