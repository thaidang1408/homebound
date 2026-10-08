# Networking

_Last updated: Phase 3 (2026-10-07). Colyseus 0.18._

## Home flow (ADR-009/010/011)

```text
Build a new home ─► client.create("home", { name, playerId })
                     onCreate: claim a fresh 5-char code (not running, not saved) = roomId
                     setPrivate(true) → never matchmade, joinable only by code
Lobby: alone → Start right away; two players → both Ready, then either Start
Start ─► phase "playing", home saved to data/homes/<CODE>.json

Join with code  ─► joinById(code)  ──522 "not found"──► create({ restoreCode: code })
Continue home   ─► create({ restoreCode })  ──"home-already-open"──► joinById(code)
                    restore: claim code (sync; refuses a 2nd open), load + validate save,
                    phase "playing" (walk straight in)
onAuth: playerId must be valid and not already in this home (two tabs)
onJoin: returning playerId → their items, hunger, XP and position; new playerId → fresh
```

`maxClients = 2`; a full room fails with `522 … is locked` (sent over HTTP as 422: Cloudflare in
front of Render strips 52x responses; `toHttpSafeStatus` / `fromHttpSafeStatus` in `protocol.ts`) → "This home already has two players."
Refusals carry a `JoinError` message (`home-not-found`, `home-already-open`, `already-in-home`,
`invalid-player`) that the client maps to friendly text.

## State (schema, `packages/shared/src/schema.ts`)

| Field                                                        | Type                              | Notes                                               |
| ------------------------------------------------------------ | --------------------------------- | --------------------------------------------------- |
| `HomeState.phase`                                            | string                            | `lobby`                                             | `playing` |
| `HomeState.day`                                              | uint16                            | starts at 1                                         |
| `HomeState.timeOfDay`                                        | quantized 0–1 (wrap, 16-bit)      | server clock; dusk/night drive lighting             |
| `HomeState.resources`                                        | map&lt;nodeId, ResourceState&gt;  | `charges` only; positions come from the shared seed |
| `HomeState.players`                                          | map&lt;sessionId, PlayerState&gt; |                                                     |
| `HomeState.projectiles`                                      | map&lt;id, ProjectileState&gt;    | arrows in flight: x/y/z only (velocity server-only) |
| `HomeState.creatures`                                        | map&lt;id, CreatureState&gt;      | kind, mode, x/z/yaw, health, present (ADR-016)      |
| `HomeState.goals` / `today`                                  | array&lt;GoalState&gt; / DayStats | today's shared goals and counters (ADR-018)         |
| `HomeState.chest`                                            | array&lt;ItemStack&gt; (16)       | shared storage                                      |
| `HomeState.stove`                                            | StoveState                        | status, itemId, progress (8-bit)                    |
| `PlayerState.name`, `slot`, `ready`, `connected`, `sleeping` |                                   |                                                     |
| `PlayerState.x`, `z` / `yaw` / `pitch`                       | float32 / angle / quantized       |                                                     |
| `PlayerState.hunger`                                         | uint8                             | rounded up from server-only `hungerExact`           |
| `PlayerState.downed` / `bleedOut` / `revive`                 | boolean / 8-bit 0–1 / 8-bit 0–1   | downed state, bleed-out and revive bars             |
| `PlayerState.health`                                         | uint8                             | rounded up from server-only `healthExact`           |
| `PlayerState.selectedSlot`                                   | uint8                             | held hotbar slot (cosmetic)                         |
| `PlayerState.xp` / `level`                                   | uint32 / uint8                    | level derived from xp                               |
| `PlayerState.inventory`                                      | array&lt;ItemStack&gt; (10)       | first 5 = hotbar                                    |

`.noSync()` fields (`hungerExact`, `healthExact`, `stove.elapsedMs`, `stove.cookedBy`, creature
AI timers/targets/patrol goals) stay on the server.
Every primitive has an explicit `.default()`: schema-builder numbers otherwise start `undefined`
on the client (regression test in `HomeRoom.test.ts`).

## Messages (`packages/shared/src/protocol.ts`)

| Direction | Name                    | Payload                          | Server checks                                                                                                                               |
| --------- | ----------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| C→S       | `ready`                 | `{ ready }`                      | shape, lobby phase                                                                                                                          |
| C→S       | `start`                 | —                                | lobby phase; alone, or both ready + connected                                                                                               |
| C→S       | `move`                  | `{ x, z, yaw, pitch }`           | shape, playing, not asleep, world bounds, walls/furniture, max speed                                                                        |
| C→S       | `interact`              | `{ targetId }`                   | known furniture, within reach, asleep → only the bed                                                                                        |
| C→S       | `transfer`              | `{ from: player                  | chest, slot }`                                                                                                                              | next to the chest, not asleep; moves what fits |
| C→S       | `move-slot`             | `{ container, from, to }`        | slot indices in range; chest only while at it; move / swap / merge                                                                          |
| C→S       | `select-slot`           | `{ slot }`                       | hotbar index; cosmetic (partner sees what you hold)                                                                                         |
| C→S       | `use-item`              | `{ slot }`                       | slot holds food, not asleep                                                                                                                 |
| C→S       | `interact` on a node    | `{ targetId: "tree-12" }`        | within reach, charges > 0, 0.6 s cooldown, backpack space                                                                                   |
| C→S       | `attack`                | `{ slot, targetId, yaw, pitch }` | weapon from the server's copy of that hotbar slot, cooldown, not downed/asleep; melee: body in reach; bow: one arrow used, flight simulated |
| C→S       | `craft`                 | `{ recipeId }`                   | known recipe, next to the workbench, has the materials, room for the output                                                                 |
| C→S       | `interact` on a player  | `{ targetId: sessionId }`        | held [E] on a downed partner in reach; pings at least every 0.9 s (a gap pauses the revive)                                                 |
| C→S       | `interact` on a carcass | `{ targetId: "boar-2" }`         | dead + present, within reach, backpack fits all the loot                                                                                    |
| C→S       | `dev:hurt` / `dev:give` | `{ amount }` / `{ itemId, qty }` | **dev servers only**                                                                                                                        |
| C→S       | `dev:set-time`          | `{ timeOfDay }`                  | **dev servers only** (`NODE_ENV !== production`)                                                                                            |
| S→C       | `teleport`              | `{ x, z }`                       | rejected move, getting into / out of bed, new day, death                                                                                    |
| S→C       | `hit-confirm`           | `{ killed }`                     | your strike or arrow landed (hitmarker)                                                                                                     |
| S→C       | `died`                  | —                                | you bled out / went down alone and woke up at home                                                                                          |
| S→C       | `day-summary`           | `{ day, hunted, meals, … }`      | morning after a new day number (waking up, or sunrise): yesterday's stats and goals                                                         |

In production, matchmaking and `/health` answer CORS only for `ALLOWED_ORIGINS` (the Pages URL).

Invalid messages are dropped (and too-fast moves logged); they never crash the room or kick
the client. `maxMessagesPerSecond = 60` disconnects floods.

## Movement model (ADR-007)

Client-predicted, server-validated:

1. The client integrates WASD locally every frame (instant response, no input lag).
2. Every 50 ms, if the pose changed, it sends `move`.
3. The server accepts it if the step fits `sprint speed × 1.5 × elapsed + 0.75 m`, is clamped to
   the world circle and does not overlap a wall or furniture (`HOUSE_COLLIDERS`, the same data the
   client collides with); otherwise it replies `teleport` with the authoritative position.
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
