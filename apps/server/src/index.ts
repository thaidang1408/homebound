import { logger, matchMaker } from '@colyseus/core';
import { createGameServer } from './app.js';
import { env } from './config/env.js';
import { openMirror } from './persistence/mirror.js';

if (env.allowedOrigins.length > 0) {
  const fallback = env.allowedOrigins[0] ?? '';
  // An origin not on the list gets another origin back, so the browser refuses the response.
  matchMaker.controller.getCorsHeaders = (headers) => {
    const origin = headers.get('origin') ?? '';
    return {
      'Access-Control-Allow-Origin': env.allowedOrigins.includes(origin) ? origin : fallback,
      Vary: 'Origin',
    };
  };
} else if (env.production) {
  logger.warn('ALLOWED_ORIGINS is not set: any website can open homes on this server');
}

const mirror = env.databaseUrl
  ? await openMirror(env.databaseUrl).catch((error: unknown) => {
      // Never print the URL: it holds the password.
      logger.error(`Cannot use the save database (check DATABASE_URL): ${String(error)}`);
      process.exit(1);
    })
  : null;
if (!mirror && env.production) {
  logger.warn('DATABASE_URL is not set: saves live on this disk only');
}

const server = createGameServer();
// Rooms save on dispose during a graceful shutdown; wait for those copies to reach the database.
if (mirror) server.onShutdown(mirror.flush);
await server.listen(env.port, env.host);
logger.info(`Homebound server listening on ws://${env.host}:${env.port}`);
