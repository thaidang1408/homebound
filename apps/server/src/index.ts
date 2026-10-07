import { logger } from '@colyseus/core';
import { createGameServer } from './app.js';
import { env } from './config/env.js';

const server = createGameServer();
await server.listen(env.port, env.host);
logger.info(`Homebound server listening on ws://${env.host}:${env.port}`);
