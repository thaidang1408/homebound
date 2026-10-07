---
name: colyseus
description: Colyseus 0.18 server/client rules for Homebound. Use when writing or changing rooms, room state schema, client-server messages, matchmaking (create/join by room code), reconnection, server HTTP routes, or the client SDK connection.
---

# Colyseus 0.18 (Homebound)

Installed: `@colyseus/core`, `@colyseus/ws-transport`, `@colyseus/schema@5` (server), `@colyseus/sdk` (client, added in Phase 1). We do NOT use the `colyseus` meta-package (it pulls Redis, auth, monitor, playground).

## Source of truth: official docs, not memory

APIs changed a lot between 0.15 → 0.16 → 0.18. Before using an API, fetch the page as markdown (append `.md`):

| Topic | URL |
|---|---|
| Index of all pages | https://docs.colyseus.io/llms.txt |
| Server / defineServer | https://docs.colyseus.io/server.md |
| Room + lifecycle | https://docs.colyseus.io/room.md, https://docs.colyseus.io/room/lifecycle.md |
| Messages (typed) | https://docs.colyseus.io/room/messages.md |
| Fixed tick / clock | https://docs.colyseus.io/room/timing-events.md |
| Reconnection | https://docs.colyseus.io/room/reconnection.md, https://docs.colyseus.io/sdk/connection.md |
| Schema | https://docs.colyseus.io/state/schema.md |
| State size optimization | https://docs.colyseus.io/state/optimization.md |
| Per-client visibility | https://docs.colyseus.io/state/view.md |
| Private/locked rooms | https://docs.colyseus.io/matchmaker/visibility.md |
| Client SDK | https://docs.colyseus.io/sdk.md |
| HTTP routes / CORS | https://docs.colyseus.io/server/http-routes.md |

Also grep the installed `.d.ts` in `node_modules/@colyseus/*/build` to confirm signatures.

## Project rules

- Server authoritative. Clients send **intent** (`input`, `interact`, `attack`), never results (damage, loot, HP).
- Validate every message: type, ranges, entity IDs exist, cooldowns, distance. Drop and log invalid ones; never crash the room.
- High-frequency data (position/rotation) goes through synced schema state with small numeric types; discrete events go through messages.
- Message names and payload types live in `packages/shared` (one definition for client + server).
- `maxClients = MAX_PLAYERS` (2). Do not add 3–4 player support.
- Disconnect: use an `allowReconnection(client, seconds)` grace period; show "Partner disconnected — waiting…" UI, don't dispose the room immediately.
- Rooms are joined by a short human-readable code, not by public listing.
- Log room lifecycle (create, join, leave, dispose) via `logger` from `@colyseus/core`.
- Never put game state in React state per frame; the client reads schema state in the game loop.
- CORS is `*`-reflecting by default; restrict to the frontend origin in Phase 8.
