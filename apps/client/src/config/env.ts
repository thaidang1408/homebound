import { DEFAULT_SERVER_PORT } from '@homebound/shared';

/**
 * Game server base URL (http/https). Empty VITE_SERVER_URL means "same host as the page",
 * which makes LAN testing work: Machine B opens http://<machine-a-ip>:5173.
 */
export const serverUrl: string =
  import.meta.env.VITE_SERVER_URL ||
  `${window.location.protocol}//${window.location.hostname}:${DEFAULT_SERVER_PORT}`;
