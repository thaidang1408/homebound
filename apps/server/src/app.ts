import {
  ServerError,
  createEndpoint,
  createRouter,
  defineRoom,
  defineServer,
  matchMaker,
} from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { HEALTH_PATH, ROOM_NAME, toHttpSafeStatus, type HealthResponse } from '@homebound/shared';
import { setSaveDir } from './persistence/homeSaves.js';
import { HomeRoom } from './rooms/HomeRoom.js';

const health = createEndpoint(
  HEALTH_PATH,
  { method: 'GET' },
  async (): Promise<HealthResponse> => ({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
  }),
);

export interface GameServerOptions {
  /** Where saved homes are written (default: $HOMEBOUND_SAVE_DIR or ./data/homes). */
  saveDir?: string;
}

// Matchmaking errors leave as HTTP 42x, never 52x (see toHttpSafeStatus). Patched once per process.
const invokeMethod = matchMaker.controller.invokeMethod.bind(matchMaker.controller);
matchMaker.controller.invokeMethod = async (...args) => {
  try {
    return await invokeMethod(...args);
  } catch (error) {
    if (error instanceof ServerError)
      throw new ServerError(toHttpSafeStatus(error.code), error.message);
    throw error;
  }
};

export function createGameServer(options: GameServerOptions = {}) {
  if (options.saveDir) setSaveDir(options.saveDir);
  return defineServer({
    transport: new WebSocketTransport(),
    rooms: { [ROOM_NAME]: defineRoom(HomeRoom) },
    routes: createRouter({ health }),
    greet: false,
  });
}
