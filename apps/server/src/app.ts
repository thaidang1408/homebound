import { createEndpoint, createRouter, defineRoom, defineServer } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { HEALTH_PATH, ROOM_NAME, type HealthResponse } from '@homebound/shared';
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

export function createGameServer(options: GameServerOptions = {}) {
  if (options.saveDir) setSaveDir(options.saveDir);
  return defineServer({
    transport: new WebSocketTransport(),
    rooms: { [ROOM_NAME]: defineRoom(HomeRoom) },
    routes: createRouter({ health }),
    greet: false,
  });
}
