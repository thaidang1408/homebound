# Progress

## Phase 0 — Foundation

**Status:** Done, awaiting approval (2026-10-07)

**What was built**

- Git repo (`main`), npm workspaces monorepo: `packages/shared`, `apps/server`, `apps/client`.
- TypeScript 6.0 strict (`tsconfig.base.json`), ESLint 10 + typescript-eslint (strict) + react-hooks, Prettier.
- Shared: `MAX_PLAYERS = 2`, `ROOM_NAME`, `DEFAULT_SERVER_PORT`, `HEALTH_PATH`, `HealthResponse`.
- Server: Colyseus 0.18 `defineServer`, empty `HomeRoom` (maxClients 2, lifecycle logs), `GET /health`, binds `0.0.0.0`.
- Client: Vite 8 + React 19 + R3F 9 placeholder low-poly scene (ground, house), design tokens,
  server-status pill that calls `/health` (auto-targets the page's host for LAN testing).
- Root `.env` support for both apps; `.env.example`.
- `CLAUDE.md`, project skills (`colyseus`, `game-testing`) and 19 vetted third-party skills (`.claude/skills/SOURCES.md`).
- Docs: architecture, decisions (ADR-001…006), development phases, this log. README.

**Tests**

- `apps/server/src/app.test.ts`: boots the real server, `GET /health` → 200 `ok`.
- Verified manually: `npm run dev` serves client on :5173 and server on :2567; `npm start` runs the production server build.

**Known issues**

- Client bundle ~1.1 MB (310 kB gzip), mostly three.js; Vite warns about chunk size. Code-splitting in Phase 7.
- Rendering of the 3D scene not yet verified by automated browser check (Playwright not installed); verify by opening the page.
- npm 11 blocked optional install scripts for `esbuild` and `msgpackr-extract`; everything works without them.
- CORS reflects any origin (Colyseus default); restrict to the frontend origin in Phase 8.
- Font token names Nunito but no webfont is loaded yet (falls back to Segoe UI / system-ui).

**Next phase:** Phase 1 — real 2-player multiplayer.
