// Dev-only hooks for automated browser playtests (scripts/e2e). Loaded only in `vite dev`,
// never included in production builds.
import { ClientMessage } from '@homebound/shared';
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

window.__homebound = { getSession, getUi, walkTo, setTime, hurt, give };
