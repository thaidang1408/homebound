# Architecture

_Last updated: Phase 1 (2026-10-07)._

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
- **No database** in the MVP. Room state lives in memory for the life of the room.

## Packages

| Path              | Role                                                                                              | Build                                |
| ----------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `packages/shared` | Constants, message names/payloads, schema state (`HomeState`), validation (used by both sides)    | `tsc -b` → `dist/` (ESM)             |
| `apps/server`     | Colyseus server: `src/app.ts` (`createGameServer`), `src/rooms/`, `src/config/env.ts`             | `tsc -b` → `dist/`; dev: `tsx watch` |
| `apps/client`     | Vite + React 19 + R3F 9. `src/game/` (3D), `src/ui/` (screens, HUD, design system), `src/config/` | `vite build` → `dist/`               |

Client and server both import `@homebound/shared` from its compiled `dist/`. `npm run dev` builds shared once,
then runs `tsc -w` for shared alongside the server and client (`scripts/dev.mjs`).

## Configuration

One `.env` at the repo root (`.env.example`):

- `PORT` — server port (default 2567). Server binds `0.0.0.0` for LAN testing.
- `VITE_SERVER_URL` — game server base URL for the client. Empty ⇒ same host as the page, port 2567.

## Client

```text
src/
  networking/connection.ts  Colyseus client: create/join/reconnect, friendly errors, binds a room to the store
  state/session.ts          tiny external store (screen, room, connection, error) via useSyncExternalStore
  game/GameCanvas.tsx       R3F canvas: world + LocalPlayer + RemotePlayer(s)
  game/player/              first-person controller, partner body (smoothed), keyboard
  ui/screens/               Landing, Lobby
  ui/hud/                   in-game HUD (room, partner status, reconnect banner, pause)
  ui/components/            Button, TextInput, Panel styles (tokens only)
```

- React owns menus/HUD/lobby. The game loop (`useFrame`, refs) owns per-frame state: player poses are
  read from `room.state` inside `useFrame`, never pushed through React.
- The store is bumped only on low-frequency changes (players join/leave, ready, connected, phase).
- All UI styling via tokens in `src/ui/design-system/tokens.css`.

Networking details (messages, movement model, disconnects): `docs/networking.md`.

## Endpoints

| Path          | Purpose                                                                       |
| ------------- | ----------------------------------------------------------------------------- |
| `GET /health` | `{ status: "ok", uptimeSeconds }` — liveness for hosting + client smoke check |
| WS rooms      | `home` room (`HomeRoom`, `maxClients = 2`)                                    |
