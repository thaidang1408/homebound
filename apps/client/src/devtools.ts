// Dev-only hooks for automated browser playtests (scripts/e2e). Loaded only in `vite dev`,
// never included in production builds.
import { ClientMessage } from '@homebound/shared';
import { devRenderer } from './game/devRenderer';
import { walkTo } from './game/player/autopilot';
import { getSession } from './state/session';
import { getUi } from './state/ui';

declare global {
  interface Window {
    __homebound?: {
      getSession: typeof getSession;
      getUi: typeof getUi;
      walkTo: typeof walkTo;
      setTime: typeof setTime;
      hurt: typeof hurt;
      give: typeof give;
      summon: typeof summon;
      pet: typeof pet;
      teleport: typeof teleport;
      perf: typeof perf;
    };
  }
}

/** Jump the world clock (dev servers only accept this). */
function setTime(timeOfDay: number): void {
  getSession().room?.send(ClientMessage.DevSetTime, { timeOfDay });
}

/** Lose health (dev servers only): test downed/revive. */
function hurt(amount: number): void {
  getSession().room?.send(ClientMessage.DevHurt, { amount });
}

/** Get items (dev servers only): test weapons and crafting. */
function give(itemId: string, qty: number): void {
  getSession().room?.send(ClientMessage.DevGive, { itemId, qty });
}

/** Bring the nearest creature of a kind close (dev servers only): makes AI tests deterministic. */
function summon(kind: string, at?: { x: number; z: number }): void {
  getSession().room?.send(ClientMessage.DevSummon, { kind, ...at });
}

/** A hatched pet of a kind, right next to you (dev servers only). */
function pet(kind: string): void {
  getSession().room?.send(ClientMessage.DevPet, { kind });
}

/** Jump anywhere (dev servers only): the wilds are a long walk for a headless browser. */
function teleport(x: number, z: number): void {
  getSession().room?.send(ClientMessage.DevTeleport, { x, z });
}

/** Draw calls, triangles and frames per second over one second (for profiling). */
async function perf(): Promise<{
  calls: number;
  triangles: number;
  geometries: number;
  fps: number;
}> {
  let frames = 0;
  const start = performance.now();
  await new Promise<void>((done) => {
    const tick = () => {
      frames++;
      if (performance.now() - start < 1000) requestAnimationFrame(tick);
      else done();
    };
    requestAnimationFrame(tick);
  });
  const info = devRenderer.gl?.info;
  return {
    calls: info?.render.calls ?? 0,
    triangles: info?.render.triangles ?? 0,
    geometries: info?.memory.geometries ?? 0,
    fps: Math.round((frames * 1000) / (performance.now() - start)),
  };
}

window.__homebound = {
  getSession,
  getUi,
  walkTo,
  setTime,
  hurt,
  give,
  summon,
  pet,
  teleport,
  perf,
};
