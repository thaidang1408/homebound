import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import {
  CREATURES,
  ClientMessage,
  CreatureMode,
  GamePhase,
  HEALTH_MAX,
  ROOM_NAME,
  WEAPONS,
  ZONES,
  type HomeState,
} from '@homebound/shared';
import {
  createHarness,
  newPlayerId,
  self,
  setTime,
  sleep,
  waitFor,
  walk,
} from '../test/harness.js';

const h = createHarness(2597);
beforeAll(() => h.start());
afterEach(() => h.leaveAll());
afterAll(() => h.stop());

/** Out of the front door, then a clear straight line east into the meadow. */
const TO_MEADOW = [
  { x: 0, z: 3 },
  { x: 0, z: 6 },
  { x: 0, z: 8 },
  { x: 30, z: -2 },
];
/** Midday: boars see 8 m, so usually one comes at a time (at night the herd does). */
const NOON = 0.5;
const HOSTILE: string[] = [CreatureMode.Alert, CreatureMode.Chase, CreatureMode.Attack];

async function soloGame() {
  const room = await h.track(
    h.sdk.create<HomeState>(ROOM_NAME, { name: 'Hunter', playerId: newPlayerId() }),
  );
  room.send(ClientMessage.Start);
  await waitFor(() => room.state.phase === GamePhase.Playing);
  return room;
}

describe('creatures', () => {
  test('boars roam the meadow (wolves wait for night); players start at full health', async () => {
    const room = await soloGame();
    const boars = [...room.state.creatures.values()].filter((c) => c.kind === 'boar');
    expect(boars).toHaveLength(CREATURES.boar.count);
    for (const c of boars) {
      expect(c.health).toBe(CREATURES.boar.maxHealth);
      expect(c.present).toBe(true);
    }
    expect(self(room).health).toBe(HEALTH_MAX);
  });

  test('you cannot hit a boar from the house', async () => {
    const room = await soloGame();
    room.send(ClientMessage.Attack, { slot: 0, targetId: 'boar-0', yaw: 0, pitch: 0 });
    room.send(ClientMessage.Attack, { slot: 0, targetId: 'not-a-boar', yaw: 0, pitch: 0 });
    await sleep(300);
    expect(room.state.creatures.get('boar-0')?.health).toBe(CREATURES.boar.maxHealth);
  });

  test(
    'a hunt: a boar charges, you fight it off and butcher it for meat',
    { timeout: 45_000 },
    async () => {
      const room = await soloGame();
      await setTime(room, NOON);
      await walk(room, TO_MEADOW);

      let id = '';
      await waitFor(() => {
        id =
          [...room.state.creatures.entries()].find(([, c]) => HOSTILE.includes(c.mode))?.[0] ?? '';
        return id !== '';
      }, 25_000);
      const boar = () => room.state.creatures.get(id);

      const xpBefore = self(room).xp;
      while (boar()?.mode !== CreatureMode.Dead) {
        room.send(ClientMessage.Attack, { slot: 0, targetId: id, yaw: 0, pitch: 0 });
        await sleep(WEAPONS.fists.cooldownMs + 50);
        // A blackout sends you home: the hunt failed.
        if (Math.hypot(self(room).x, self(room).z) < ZONES.yard.radius)
          throw new Error('blacked out');
      }
      await waitFor(() => self(room).xp >= xpBefore + CREATURES.boar.xp);

      room.send(ClientMessage.Interact, { targetId: id });
      await waitFor(() => boar()?.present === false);
      const meat = [...self(room).inventory]
        .filter((s) => s.itemId === 'raw_meat')
        .reduce((n, s) => n + s.qty, 0);
      expect(meat).toBeGreaterThanOrEqual(2);
    },
  );
});
