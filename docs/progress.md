# Progress

## Phase 0 — Foundation

**Status:** Done, approved (2026-10-07)

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
- npm 11 blocked optional install scripts for `esbuild` and `msgpackr-extract`; everything works without them.
- CORS reflects any origin (Colyseus default); restrict to the frontend origin in Phase 8.
- Font token names Nunito but no webfont is loaded yet (falls back to Segoe UI / system-ui).

**Next phase:** Phase 1 — real 2-player multiplayer.

## Phase 1 — Real 2-player multiplayer

**Status:** Done on one machine, awaiting the two-machine test + approval (2026-10-07)

**What was built**

- Server `HomeRoom`: 5-char human room codes as room IDs (presence-reserved), private rooms
  (join by code only), 2-player limit, slots 1/2 with spawn points, lobby ready/start, 30 s
  reconnection grace (`onDrop`/`onReconnect`/`onLeave`), lifecycle logs, flood limit.
- Shared: `HomeState`/`PlayerState` schema, message names + payload types, validation
  (room code, name, move/ready payloads, world clamp, max-speed check).
- Movement: client-predicted, server-validated, teleport correction (ADR-007).
- Client: Landing (name, create, join by code, friendly errors, server status), Lobby (big
  copyable code, player cards, ready, start, leave), first-person controller (pointer lock,
  WASD, Shift sprint), partner body with smoothing + name tag, HUD (room code, partner status,
  reconnect banner, pause/controls menu, crosshair), reload-to-reconnect via `sessionStorage`.
- `npm run e2e`: two headless Chrome players through the real UI (ADR-008).
- Docs: `networking.md`, ADR-007/008, architecture update.

**Tests**

- `npm test`: 23 passing. Shared validation (8) + server integration with real SDK clients (14):
  code format, private room, join, full room, unknown code, name sanitizing, defined initial
  state, lobby start rules, move sync, lobby moves ignored, teleport rejection, malformed
  messages, drop + reconnect, intentional leave.
- `npm run e2e`: 11 checks passing (create, join lower-case code, 3rd player refused, wrong code
  message, start, A↔B movement and turning seen by the other, reload keeps the seat, partner
  disconnect shown, no console errors).
- **Not yet done: the two-machine test** (Machine A + Machine B on the LAN). Required for DoD.

**Bugs found by the browser test and fixed**

- Lobby rendered before the first state patch (`players` undefined) → client now waits for the
  first state before switching screens.
- Schema-builder numbers without `.default()` start `undefined` → `pitch` was sent as
  `undefined` and every move was (correctly) rejected. All fields now have defaults; regression test.
- Held keys were cleared when pointer lock was _gained_ (async) → only cleared on losing it.

**Known issues**

- No collision yet: players walk through the house (Phase 2 adds house + collision).
- Client bundle 1.32 MB (371 kB gzip). Code-splitting in Phase 7.
- Mouse sensitivity / FOV are constants (`apps/client/src/config/controls.ts`), no Settings screen yet.
- Clipboard copy of the room code fails on plain-http LAN URLs in some browsers (secure-context
  rule); the code is shown large to read out.
- Production CORS restriction still pending (Phase 8).

**Next phase:** Phase 2 — house + interaction.
