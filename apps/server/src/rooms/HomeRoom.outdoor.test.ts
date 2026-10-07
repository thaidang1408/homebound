import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import {
  ClientMessage,
  GamePhase,
  HARVEST_COOLDOWN_MS,
  PLAYER_RADIUS,
  RESOURCE_KINDS,
  RESOURCE_NODES,
  ROAD,
  ROOM_NAME,
  WORLD_COLLIDERS,
  XP_REWARDS,
  collides,
  type HomeState,
  type Point,
  type ResourceKind,
} from '@homebound/shared';
import { createHarness, newPlayerId, self, sleep, waitFor, walk } from '../test/harness.js';

const h = createHarness(2594);
beforeAll(() => h.start());
afterEach(() => h.leaveAll());
afterAll(() => h.stop());

const clearLine = (a: Point, b: Point) => {
  for (let t = 0; t <= 1; t += 0.05) {
    const p = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    if (collides(p, PLAYER_RADIUS + 0.05, WORLD_COLLIDERS)) return false;
  }
  return true;
};

/** A node of `kind` reachable by walking down the road, then straight across to it. */
function reachable(kind: ResourceKind) {
  const candidates = RESOURCE_NODES.filter(
    (n) => n.kind === kind && n.z > ROAD.fromZ + 2 && n.z < ROAD.toZ,
  )
    .map((n) => {
      const side = Math.sign(n.x) || 1;
      const stand = { x: n.x - side * (RESOURCE_KINDS[kind].reachHalf * n.scale + 0.6), z: n.z };
      return { node: n, stand, roadPoint: { x: 0, z: n.z } };
    })
    .filter((c) => clearLine(c.roadPoint, c.stand) && clearLine({ x: 0, z: 6 }, c.roadPoint))
    .sort((a, b) => Math.abs(a.node.x) - Math.abs(b.node.x));
  const best = candidates[0];
  if (!best) throw new Error(`no reachable ${kind} near the road`);
  return { ...best, path: [{ x: 0, z: 3 }, { x: 0, z: 6 }, best.roadPoint, best.stand] };
}

const countIn = (slots: Iterable<{ itemId: string; qty: number }>, id: string) =>
  [...slots].filter((s) => s.itemId === id).reduce((n, s) => n + s.qty, 0);

async function soloGame() {
  const room = await h.track(
    h.sdk.create<HomeState>(ROOM_NAME, { name: 'Out', playerId: newPlayerId() }),
  );
  room.send(ClientMessage.Start);
  await waitFor(() => room.state.phase === GamePhase.Playing);
  return room;
}

describe('the outdoor world', () => {
  test('starts in the morning with every resource node full', async () => {
    const room = await soloGame();
    expect(room.state.timeOfDay).toBeGreaterThan(0.25);
    expect(room.state.timeOfDay).toBeLessThan(0.5);
    expect(room.state.resources.size).toBe(RESOURCE_NODES.length);
  });

  test('the clock moves forward', async () => {
    const room = await soloGame();
    const t0 = room.state.timeOfDay;
    await waitFor(() => room.state.timeOfDay > t0, 3000);
  });

  test('you can walk out of the front door and down the road to the trees', async () => {
    const room = await soloGame();
    const { node, path } = reachable('tree');
    await walk(room, path);
    expect(self(room).z).toBeCloseTo(node.z, 1);
  });
});

describe('harvesting', () => {
  test('chopping a tree gives wood and XP, with a cooldown between chops', async () => {
    const room = await soloGame();
    const { node, path } = reachable('tree');
    await walk(room, path);

    room.send(ClientMessage.Interact, { targetId: node.id });
    await waitFor(() => countIn(self(room).inventory, 'wood') === 1);
    expect(self(room).xp).toBe(XP_REWARDS.gather);

    room.send(ClientMessage.Interact, { targetId: node.id }); // too soon
    await sleep(100);
    expect(countIn(self(room).inventory, 'wood')).toBe(1);

    await sleep(HARVEST_COOLDOWN_MS);
    room.send(ClientMessage.Interact, { targetId: node.id });
    await waitFor(() => countIn(self(room).inventory, 'wood') === 2);
    expect(room.state.resources.get(node.id)?.charges).toBe(RESOURCE_KINDS.tree.charges - 2);
  });

  test('nodes out of reach cannot be harvested', async () => {
    const room = await soloGame();
    const { node } = reachable('tree');
    room.send(ClientMessage.Interact, { targetId: node.id });
    await sleep(200);
    expect(countIn(self(room).inventory, 'wood')).toBe(0);
  });
});
