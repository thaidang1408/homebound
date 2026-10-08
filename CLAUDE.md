# HOMEBOUND: WILD WORLD — rules for Claude

Browser 2-player online co-op, first-person, stylized low-poly survival. Goal: the smallest game that
makes two people say "Chơi thêm ngày nữa đi." Phases and MVP scope: `docs/development-phases.md`.

## Workflow (non-negotiable)

- Follow the phases in `docs/development-phases.md`. At the end of each phase: run `npm test`,
  `npm run build`, `npm run lint`, verify the Definition of Done, update `docs/progress.md`, summarize,
  then **STOP and wait for the user's "OK"**. Never start the next phase on your own.
- Problems / major decisions: report as PROBLEM / CAUSE / OPTIONS / RECOMMENDATION / WAITING FOR APPROVAL.
- Record important technical decisions as ADRs in `docs/decisions.md`; keep `docs/architecture.md` current.
- Commits: conventional (`feat(multiplayer): …`, `fix(network): …`). Never overwrite user work.
- Talk to the user in Vietnamese; code, comments and docs in English.
- Player-facing game text (UI, prompts, items, story) is Vietnamese (ADR-028).
- The user may be running `npm run dev` in their own terminal. Check ports 2567/5173 before starting
  servers; never kill processes you did not start. Run `npm run e2e` against their dev server instead.

## Layout

- `packages/shared` — constants, protocol/message types, schemas used by both sides. Built with `tsc` to `dist`.
- `apps/server` — Node + Colyseus 0.18 (`@colyseus/core`), authoritative. `createGameServer()` in `src/app.ts`.
- `apps/client` — Vite + React 19 + R3F 9 + three 0.186 (no drei; see ADR-013).
- One `.env` at the repo root (see `.env.example`); only `VITE_*` vars reach the browser.

## Architecture rules

- Server authoritative: clients send intent; the server validates and owns HP, damage, inventory, loot,
  creatures, crafting, death/revive and world state. Never trust client values.
- No type duplication: shared types/constants live in `packages/shared`.
- Data-driven content (creatures, weapons, items, loot tables) as definitions, not hard-coded branches.
- React = menus/HUD/lobby/inventory. Per-frame state lives in the game loop (`useFrame`, refs), never
  `setState` every frame. No per-frame allocations in hot paths.
- UI uses tokens from `apps/client/src/ui/design-system/tokens.css` only. No ad-hoc colors/spacing.
- No raw technical errors in UI ("Connection lost. Trying to reconnect…").
- Simple over scalable: build for 2 players. No DB, Redis, auth or accounts until a phase needs them.
- Persistence: homes are JSON saves (ADR-009). Anything new that should survive a session must be
  added to `apps/server/src/persistence/` (save shape + validation + mapping) with a test.
- Content is data: items in `items.ts`, XP rewards/levels in `progression.ts`, house layout in `world/house.ts`.
- TypeScript strict, no `any`, no magic numbers (centralize constants), small modules.
- TypeScript is pinned to 6.0.x (typescript-eslint does not support 7 yet; see ADR-002).

## Skills (`.claude/skills`, sources in `.claude/skills/SOURCES.md`)

- 3D/R3F: the `r3f-*` skills match our exact versions. Use them for scene, animation, lighting, instancing, postprocessing.
- Game feel/design: `game-feel`, `camera-systems`, `game-ui-ux`, `audio-design`, `game-ai`,
  `survival-crafting`, `fps-shooter`. Their samples are Godot/Unity — apply the principles, rewrite for R3F.
- `threejs-aaa-graphics-builder`: our target is **stylized low-poly**, readable silhouettes, soft lighting —
  not realism. Procedural/primitive assets only; no paid generation APIs.
- `threejs-game-ui-designer`, `threejs-debug-profiler`, `threejs-qa-release`.
- `colyseus` (always check the official 0.18 docs) and `game-testing` (a two-machine test is required for
  multiplayer DoD).
- Priority: gameplay > multiplayer > fun > performance > UX > visual polish > extras.
  Don't polish visuals ahead of the current phase's goal.
