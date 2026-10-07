# Architecture

_Last updated: Phase 3 (2026-10-07)._

## Overview

```text
Browser (Player A)                          Browser (Player B)
React UI + R3F/Three.js game loop           React UI + R3F/Three.js game loop
        │  WebSocket (Colyseus SDK)                 │
        └──────────────► Game server ◄──────────────┘
                 Node.js + @colyseus/core 0.18
                 authoritative room state (2 players max)
                 HTTP: GET /health
```

- **Server authoritative.** Clients send intent; the server validates and owns all game state.
- **Transport:** WebSocket (`@colyseus/ws-transport`). State sync via `@colyseus/schema` binary patches
  for high-frequency data; Colyseus messages for discrete events.
- **No database.** Live state is in memory; homes are saved as JSON files on the server (ADR-009).

## Packages

| Path              | Role                                                                                                                      | Build                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `packages/shared` | Constants, message names/payloads, schema state (`HomeState`), validation (used by both sides)                            | `tsc -b` → `dist/` (ESM)             |
| `apps/server`     | Colyseus server: `app.ts`, `rooms/` (HomeRoom, codes), `systems/` (needs, stove, sleep, XP), `inventory/`, `persistence/` | `tsc -b` → `dist/`; dev: `tsx watch` |
| `apps/client`     | Vite + React 19 + R3F 9. `src/game/` (3D), `src/ui/` (screens, HUD, design system), `src/config/`                         | `vite build` → `dist/`               |

Client and server both import `@homebound/shared` from its compiled `dist/`. `npm run dev` builds shared once,
then runs `tsc -w` for shared alongside the server and client (`scripts/dev.mjs`).

## Configuration

One `.env` at the repo root (`.env.example`):

- `PORT` — server port (default 2567). Server binds `0.0.0.0` for LAN testing.
- `VITE_SERVER_URL` — game server base URL for the client. Empty ⇒ same host as the page, port 2567.
- `HOMEBOUND_SAVE_DIR` — where homes are saved (default `data/homes` relative to the server cwd,
  i.e. `apps/server/data/homes` in dev). Git-ignored.

## Server

```text
src/
  rooms/HomeRoom.ts       lifecycle, message handlers (validate → system → state), autosave
  rooms/roomCode.ts       home codes; synchronous claim so a home can't run twice
  systems/                pure game rules on state: needs/health, stove, sleep, clock, harvest,
                          creatures (AI state machine, strikes, butchering), progression
  inventory/inventory.ts  slot inventories, atomic add/remove/move (unit-tested)
  persistence/            homeSaves.ts (file I/O + validation), homeState.ts (state ↔ save mapping)
  test/harness.ts         real server + SDK clients for integration tests (temp save dir)
```

## Client

```text
src/
  networking/connection.ts  create/join/continue home, reconnect, friendly errors
  networking/identity.ts    anonymous playerId + last home code (localStorage)
  networking/roomWatcher.ts re-renders UI only when the low-frequency state slice changes; toasts
  state/                    tiny external stores: session (room, screen), ui (panel, focus, hotbar, toasts)
  game/GameCanvas.tsx       R3F canvas: World + LocalPlayer + RemotePlayer(s) + Creatures
  game/creatures/           Boar model + mode animations (trot, alert, wind-up/lunge, flinch, dead), health bar
  game/world/               Terrain, DayNight (sky/sun/moon/fog/stars), Resources (instanced), Decorations,
                            House, Furniture, Stove (state-driven visuals), palette
  game/player/              controller (collision, sleep camera, dev autopilot), partner body, NameTag
  game/interaction/         focus (near + facing; creatures to strike/butcher), prompt text, floor focus marker
  ui/screens/               Landing, Lobby
  ui/hud/                   HUD (health, hunger, level/XP, hurt flash, day, partner, prompt, hotbar, toasts, sleep, pause), keys
  ui/panels/                backpack and shared storage
  ui/components/            Button, TextInput, ItemSlot, Panel styles (tokens only)
  devtools.ts               dev-only window.__homebound hook for e2e
```

- React owns menus/HUD/lobby. The game loop (`useFrame`, refs) owns per-frame state: player poses are
  read from `room.state` inside `useFrame`, never pushed through React.
- The store is bumped only when the UI slice changes (players, ready, hunger, inventory, chest, stove
  status, day, XP); positions never go through React.
- All UI styling via tokens in `src/ui/design-system/tokens.css`.

Shared world data (`packages/shared/src/world/`): `house.ts` (layout), `layout.ts` (seeded outdoor
nodes + zones), `terrain.ts` (height), `time.ts` (day phases), `resources.ts` (node kinds),
`interactables.ts` (furniture + nodes, `WORLD_COLLIDERS`), `collision.ts`. Creature kinds:
`packages/shared/src/creatures.ts` (data, ADR-016).

Networking details (messages, movement model, disconnects): `docs/networking.md`.

## Endpoints

| Path          | Purpose                                                                       |
| ------------- | ----------------------------------------------------------------------------- |
| `GET /health` | `{ status: "ok", uptimeSeconds }` — liveness for hosting + client smoke check |
| WS rooms      | `home` room (`HomeRoom`, `maxClients = 2`)                                    |
