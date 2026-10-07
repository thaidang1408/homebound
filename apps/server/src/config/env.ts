import { DEFAULT_SERVER_PORT } from '@homebound/shared';

// Load the repo-root .env if present (Node >= 21.7). Hosting platforms inject env vars directly.
try {
  process.loadEnvFile(new URL('../../../../.env', import.meta.url));
} catch {
  // No .env file: rely on process environment.
}

const port = Number(process.env.PORT ?? DEFAULT_SERVER_PORT);
if (!Number.isInteger(port) || port <= 0) {
  throw new Error(`Invalid PORT: ${process.env.PORT}`);
}

export const env = {
  port,
  /**
   * Dev-only cheats for playtests (jump the clock). Off when NODE_ENV=production — set that on any
   * public server (Phase 8 checklist).
   */
  devCommands: process.env.NODE_ENV !== 'production',
  /** Bind all interfaces so other machines on the LAN can connect in dev. */
  host: '0.0.0.0',
};
