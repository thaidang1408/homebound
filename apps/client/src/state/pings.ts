import { PING_MS, type PingBroadcast } from '@homebound/shared';
import { createStore } from './createStore';

export interface Ping extends PingBroadcast {
  id: number;
  mine: boolean;
  /** performance.now() when it arrived. */
  at: number;
}

const store = createStore<{ pings: Ping[] }>({ pings: [] });
export const usePings = store.use;
export const getPings = () => store.get().pings;

let nextId = 1;
/** One live mark per player: a new ping replaces your previous one. */
export function addPing(ping: PingBroadcast, mine: boolean): void {
  const entry = { ...ping, id: nextId++, mine, at: performance.now() };
  store.update({ pings: [...getPings().filter((p) => p.from !== ping.from), entry] });
  setTimeout(() => store.update({ pings: getPings().filter((p) => p.id !== entry.id) }), PING_MS);
}
