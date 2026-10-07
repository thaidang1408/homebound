import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  // Single .env at the repo root, shared with the server.
  envDir: fileURLToPath(new URL('../..', import.meta.url)),
  server: { port: 5173 },
});
