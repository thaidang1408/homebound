# Networking

_Last updated: Phase 1 (2026-10-07). Colyseus 0.18._

## Room flow

```text
A: Create room ──► server: HomeRoom.onCreate
                     roomId = 5-char code (presence-reserved, no 0/O/1/I/L)
                     setPrivate(true)  → never matchmade, joinable only by code
A: lobby shows code ──(says it out loud)──► B: Join (code normalized: case/spaces/dashes)
B: client.joinById(code) ──► onJoin: slot 2, spawn point 2
Both: Ready ──► either: Start (server checks: 2 players, both ready + connected)
state.phase = "playing" ──► clients switch to the game screen
```

`maxClients = 2`; Colyseus auto-locks the room when full, so a third join fails with
`MATCHMAKE_INVALID_ROOM_ID (522) … is locked` → "This room is already full."

## State (schema, `packages/shared/src/schema.ts`)

| Field                            | Type                              | Notes                                    |
| -------------------------------- | --------------------------------- | ---------------------------------------- |
| `HomeState.phase`                | string                            | `lobby` \| `playing`                     |
| `HomeState.players`              | map&lt;sessionId, PlayerState&gt; |                                          |
| `PlayerState.name`               | string                            | sanitized, ≤ 16 chars                    |
| `PlayerState.slot`               | uint8                             | 1 or 2: display order, spawn, body color |
| `PlayerState.ready`, `connected` | boolean                           |                                          |
| `PlayerState.x`, `z`             | float32                           | 4 B each                                 |
| `PlayerState.yaw`                | `t.angle()`                       | 2 B, wraps                               |
| `PlayerState.pitch`              | `t.quantized(±π/2)`               | 2 B, clamps                              |

Every primitive has an explicit `.default()`: schema-builder numbers otherwise start `undefined`
on the client (found by the browser e2e test; regression test in `HomeRoom.test.ts`).

## Messages (`packages/shared/src/protocol.ts`)

| Direction | Name       | Payload                | Server checks                                                  |
| --------- | ---------- | ---------------------- | -------------------------------------------------------------- |
| C→S       | `ready`    | `{ ready: boolean }`   | shape, lobby phase                                             |
| C→S       | `start`    | —                      | lobby phase, 2 players, all ready + connected                  |
| C→S       | `move`     | `{ x, z, yaw, pitch }` | shape (finite numbers), playing phase, world bounds, max speed |
| S→C       | `teleport` | `{ x, z }`             | sent when a move is rejected; client snaps back                |

Invalid messages are dropped (and too-fast moves logged); they never crash the room or kick
the client. `maxMessagesPerSecond = 60` disconnects floods.

## Movement model (ADR-007)

Client-predicted, server-validated:

1. The client integrates WASD locally every frame (instant response, no input lag).
2. Every 50 ms, if the pose changed, it sends `move`.
3. The server accepts it if the step fits `sprint speed × 1.5 × elapsed + 0.75 m` and clamps it to
   the world circle; otherwise it replies `teleport` with the authoritative position.
4. The partner renders the synced state with exponential smoothing (`REMOTE_SMOOTHING`), yaw via
   the shortest arc.

Bandwidth: one player moving ≈ 20 patches/s × ~12 B ≈ 0.25 KB/s.

## Disconnects

| Event                              | Server                                                     | Client                                                               |
| ---------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- |
| Network drop (1001/1005/1006/4010) | `onDrop`: `connected = false`, `allowReconnection(30 s)`   | SDK auto-retries; HUD banner "Connection lost. Trying to reconnect…" |
| Reconnected                        | `onReconnect`: `connected = true`, reset speed-check clock | banner clears                                                        |
| Page reload                        | same seat held                                             | `sessionStorage` reconnection token → `client.reconnect()`           |
| Grace expires / leaves on purpose  | `onLeave`: player removed                                  | partner HUD: "Partner left the house"                                |
| Partner offline                    | —                                                          | partner HUD: "Name disconnected — waiting…", body turns translucent  |

## Testing

- `npm test`: real server + real SDK clients (`apps/server/src/rooms/HomeRoom.test.ts`).
- `npm run e2e` (with `npm run dev` running): two headless Chrome players through the real UI
  (`scripts/e2e/two-players.mjs`).
- Two machines: see `README.md` → "Playing on two machines".
