import { afterAll, beforeAll, expect, test } from 'vitest';
import { ErrorCode } from '@colyseus/core';
import {
  HEALTH_PATH,
  fromHttpSafeStatus,
  toHttpSafeStatus,
  type HealthResponse,
} from '@homebound/shared';
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

test('matchmaking errors use 42x, never the 52x a CDN would strip', async () => {
  const res = await fetch(`http://127.0.0.1:${TEST_PORT}/matchmake/joinById/QQQQQ`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  expect(res.status).toBe(toHttpSafeStatus(ErrorCode.MATCHMAKE_INVALID_ROOM_ID));
  expect(res.status).toBe(422);
  expect(fromHttpSafeStatus(res.status)).toBe(ErrorCode.MATCHMAKE_INVALID_ROOM_ID);
  expect(toHttpSafeStatus(404)).toBe(404);
});
