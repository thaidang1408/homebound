# Architecture Decision Records

## ADR-001: npm workspaces monorepo (2026-10-07)

**Context:** Client, server and shared types must live together without duplication.
**Decision:** npm workspaces (`packages/shared`, `apps/server`, `apps/client`). No pnpm, Turborepo or Nx.
**Why:** npm is already installed; three packages don't need a task orchestrator.
**Revisit when:** builds get slow enough that caching matters.

## ADR-002: Pin TypeScript to 6.0.x (2026-10-07)

**Context:** TypeScript 7.0 is the latest, but typescript-eslint 8.71 supports `>=4.8.4 <6.1.0`.
**Decision:** Use TypeScript `~6.0.3`, strict mode.
**Revisit when:** typescript-eslint supports TS 7.

## ADR-003: Colyseus core packages instead of the `colyseus` meta-package (2026-10-07)

**Context:** `colyseus@0.18` depends on Redis driver/presence, auth, monitor and playground.
**Decision:** Depend on `@colyseus/core`, `@colyseus/ws-transport`, `@colyseus/schema` only.
**Why:** Single process, 2 players, no accounts; less install weight and attack surface.
**Revisit when:** we need the monitor for debugging (add `@colyseus/monitor` alone).

## ADR-004: No dev-runner dependency (2026-10-07)

**Context:** `concurrently@10` pulled `shell-quote` with a critical advisory (GHSA-pqg4-j6r4-53mv).
**Decision:** `scripts/dev.mjs` (~20 lines, `node:child_process`) runs shared/server/client dev processes.

## ADR-005: Vendored, pinned third-party Claude skills (2026-10-07)

**Context:** The user wanted community game-dev skills used throughout the project.
**Decision:** Copy reviewed skills into `.claude/skills/`, pinned by commit, with provenance in
`.claude/skills/SOURCES.md`. No install scripts, no global install, no paid asset-generation skills.
**Why:** Reproducible, reviewable, scoped to this repo.

## ADR-006: Single root `.env` (2026-10-07)

**Decision:** Vite `envDir` points at the repo root; the server loads it with `process.loadEnvFile`.
Hosting platforms inject env vars directly in production. Only `VITE_*` vars reach the browser.

## ADR-007: Client-predicted, server-validated movement (2026-10-07)

**Context:** Movement must feel instant, but the server must not trust the client blindly.
Full server simulation needs the collision world on the server plus client reconciliation.
**Decision:** Clients integrate movement locally and send their pose at 20 Hz. The server validates
shape, phase, world bounds and maximum speed (sprint × 1.5 + 0.75 m slack); a rejected move is answered
with a `teleport` correction. Combat, damage, loot and inventory stay fully server-authoritative.
**Why:** 2-player co-op: the cheating risk is small, the feel matters most, and this blocks
speed/teleport hacks.
**Revisit when:** wall collision matters for fairness (Phase 2–3: validate against the same collision
data on the server), or if PvP is ever added (switch to input-based server simulation; Colyseus 0.18
ships `Predict`/`Reconciler` helpers).

## ADR-008: Browser e2e with playwright-core and the system Chrome (2026-10-07)

**Context:** Unit/integration tests passed while the real UI was broken (state rendered before the
first patch; `undefined` schema numbers). Only a browser run caught it.
**Decision:** `scripts/e2e/two-players.mjs` drives two headless Chrome players through the real UI
(`npm run e2e`). `playwright-core` only (~9 MB), no bundled browser download. The client exposes a
dev-only `window.__homebound` hook for reading state.
**Revisit when:** CI is added (needs a Chrome install step there).

## ADR-009: Homes are saved as JSON files on the server (2026-10-07)

**Context:** The user wants items and progress to survive between play sessions. No database yet.
**Decision:** One file per home, `data/homes/<CODE>.json` (`HOMEBOUND_SAVE_DIR` overrides the folder),
written on game start, every 30 s, when a player leaves, on each new day and on room dispose.
Writes are atomic (temp file + rename). Everything read back is validated and clamped; a corrupt
file is moved aside (`.corrupt-<time>`) and never overwritten. Homes that never left the lobby are
not saved. Format is versioned (`version: 1`).
**Why:** Zero cost, zero setup, enough for two players. Persistence is isolated in
`apps/server/src/persistence/` (I/O in `homeSaves.ts`, state mapping in `homeState.ts`).
**Revisit when:** deploying to a host whose disk is wiped on redeploy/sleep (Phase 8) → swap
`homeSaves.ts` for PostgreSQL (free tier) with the same save shape.

## ADR-010: Anonymous browser identity (2026-10-07)

**Context:** Saves must know whose backpack is whose, but accounts are out of scope.
**Decision:** The client generates a random 32-hex `playerId` once and keeps it in `localStorage`
(`crypto.getRandomValues`, which also works on plain-http LAN pages). It is sent on join; the
server keys saved players by it and refuses the same id twice in one home.
**Trade-off:** Clearing site data or switching browser = a new player (the shared chest is still
there). Anyone who copies the id could act as that player — acceptable for a private co-op game.
**Revisit when:** accounts or cross-device play are wanted.

## ADR-011: Solo start and drop-in partner (2026-10-07)

**Context:** The user wants to start alone and have the partner join later with the code.
Supersedes the Phase 1 rule "both players must be ready".
**Decision:** Alone, "Start game" works immediately; with two in the lobby, both must be ready. A
running or saved home is joined straight into the game. A lone sleeper advances the day.
"Join by code" first joins a running room and falls back to re-opening the save; "Continue home"
does the reverse. Two players re-opening at once: the server's synchronous code claim refuses the
second, which then joins.

## ADR-012: XP and levels now, data-driven (2026-10-07)

**Decision:** `XP_REWARDS` and the level curve (`xpToNextLevel = 50 + 25 × (level − 1)`, max 50)
live in `packages/shared/src/progression.ts`. Current sources: finishing a meal on the stove (the
cook), sleeping through to a new day. XP is saved per player. Levels unlock nothing yet; Phase 4–6
add hunting/combat XP and unlocks.

## ADR-013: Name tags as canvas sprites, drei removed (2026-10-07)

**Context:** drei's `<Html>` created a React root per label and triggered "synchronously unmount a
root while React was already rendering" when a partner left. It was the only drei usage.
**Decision:** `NameTag` draws the label into a `CanvasTexture` on a sprite (no DOM, no network
font). `@react-three/drei` removed from dependencies.

## ADR-014: Seeded world shared by client and server (2026-10-07)

**Decision:** The outdoor layout (trees, rocks, bushes, zones, road) is generated from a fixed seed
in `packages/shared/src/world/layout.ts` with a tiny PRNG (`random.ts`); terrain height is a pure
function (`terrain.ts`). Client and server compute the identical world, so only live values
(resource charges, time of day) are synced and saved. Cosmetic grass/flowers use a client-only seed.
**Why:** No map files, no world download, collisions and reach checks agree on both sides.
**Revisit when:** hand-authored maps or multiple biomes are needed (data file per biome, same idea).

## ADR-015: Server-owned clock, bedtime rule, dev-only commands (2026-10-07)

**Decision:** The server advances `timeOfDay` (12-minute day); passing midnight increments the day.
Beds work only from evening (0.7) to dawn, so "it gets dark → run home → sleep together" happens.
Sleeping wakes everyone at dawn (the day number only increments if you slept before midnight).
A `dev:set-time` message exists for playtests and is registered only when `NODE_ENV !== 'production'`.
**Action for Phase 8:** set `NODE_ENV=production` on the public server.
