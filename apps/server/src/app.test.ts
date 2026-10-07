import { afterAll, beforeAll, expect, test } from 'vitest';
import { HEALTH_PATH, type HealthResponse } from '@homebound/shared';
import { createGameServer } from './app.js';

const TEST_PORT = 2599;
const server = createGameServer();

beforeAll(async () => {
  await server.listen(TEST_PORT, '127.0.0.1');
});

afterAll(async () => {
  await server.gracefullyShutdown(false);
});

test('health endpoint reports ok', async () => {
  const res = await fetch(`http://127.0.0.1:${TEST_PORT}${HEALTH_PATH}`);
  expect(res.status).toBe(200);
  const body = (await res.json()) as HealthResponse;
  expect(body.status).toBe('ok');
});
