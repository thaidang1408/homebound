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

**Status:** Approved by the user (2026-10-07). Two-machine LAN test: not confirmed by the user yet.

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

## Phase 2 — House + interaction (+ saves, solo start, XP)

**Status:** Done on one machine, awaiting the user's test + approval (2026-10-07)

**What was built**

- House from shared layout data: living room (sofa, rug, shared chest, workbench), kitchen (stove,
  table), bedroom (double bed); walls with doorways, lintels, roof, warm room lamps.
- Collision (circle vs boxes) shared by client (wall sliding) and server (rejects moves into walls).
- Interaction: focus = within reach and facing; floor marker; `[E]` prompts that say what will happen.
- Inventory: 10-slot backpack (5 hotbar), 16-slot shared chest, atomic stack moves; backpack (Tab)
  and storage panels; click food to eat; hotbar 1–5 / wheel, left click eats.
- Cooking: raw → cooked meat in 6 s, visible browning, smoke, progress bar; partner can collect.
- Hunger: server tick drain, eating restores, HUD meter with warning.
- Sleep: both (or a lone player) in bed → fade → new day; getting up cancels; partner sees you lying in bed.
- **Requested mid-phase by the user:**
  - Solo start; partner drops in any time with the code (ADR-011).
  - Saves: homes persist as JSON (ADR-009), players recognised by an anonymous browser id (ADR-010);
    "Continue home" on the landing screen.
  - XP and levels (ADR-012): cooking and sleeping grant XP; HUD level bar, level-up toasts, partner tag shows level.
- Name tags are canvas sprites; drei removed (ADR-013).
- E2E: dev-only autopilot drives the real controller; scenarios `two-players`, `home-loop`,
  `solo-save`; failure screenshots for every player.

**Tests**

- `npm test`: 77 passing — shared (validation, collision + house layout, progression), server units
  (inventory, needs/stove/sleep), save files (round-trip, corrupt file kept aside, tampered values
  clamped), networked integration (lobby/sync/disconnect, chest reach, cooking, walls, sleep/new day,
  solo start, drop-in, identity rules, save + re-open, XP kept across sessions).
- `npm run e2e`: 3 scenarios, all checks passing through the real UI.
- `npm run typecheck` now includes test files.

**Bugs found and fixed during the phase**

- Vite dev server cached a CSS module read mid-write as empty (HUD lost its styles) → transient; touching the file fixed it.
- drei `<Html>` labels triggered a React "synchronous unmount" error → replaced by sprite name tags.
- Several e2e race conditions (pointer re-lock after closing panels, brief toasts) fixed in the scripts.

**Known issues**

- Workbench has no recipes yet (shows "Nothing to craft yet") — crafting arrives with resources (Phase 3–6).
- Levels unlock nothing yet.
- Hunger at 0 has no consequence yet (Phase 5).
- Saves are files on the server disk: fine locally; some free hosts wipe disk on redeploy (ADR-009 → Phase 8).
- Anonymous identity: clearing browser data = new player in the same home.
- Name tags show through walls on purpose (find your partner); they can look odd at the screen edge.
- Headless e2e runs at a low FPS (software rendering); walks take longer there than in real browsers.
- Client bundle 1.33 MB (373 kB gzip). Code-splitting in Phase 7.
- E2E runs create test homes in the dev save folder (git-ignored).

**Next phase:** Phase 3 — outdoor world.
