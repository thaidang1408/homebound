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
    };
  }
}

/** Jump the world clock (dev servers only accept this). */
function setTime(timeOfDay: number): void {
  getSession().room?.send(ClientMessage.DevSetTime, { timeOfDay });
}

window.__homebound = { getSession, getUi, walkTo, setTime };
