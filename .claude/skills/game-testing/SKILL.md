---
name: game-testing
description: Homebound test checklist. Use before declaring any phase or multiplayer feature done, when writing tests for rooms/inventory/combat/loot, or when the user asks how to test with two machines.
---

# Game testing (Homebound)

## Automated (Vitest, `npm test`)

- Unit: pure game rules in `packages/shared` or server systems (inventory, damage, loot rolls with a seeded RNG, cooldowns, validation).
- Integration: boot the real server via `createGameServer()` on a test port (see `apps/server/src/app.test.ts`), connect real SDK clients, assert state. Cover: create room, join by code, 3rd player rejected, disconnect + reconnect within grace, reconnect after grace fails cleanly.
- Invalid-action tests for every client message: wrong types, out-of-range values, unknown IDs, spam beyond the rate limit. Expect: ignored, room still alive.

## Manual two-machine test (required for multiplayer Definition of Done)

Two browser tabs on one machine are NOT enough.

1. Machine A: `npm run dev`. Note the Wi-Fi "Network" URL Vite prints (e.g. `http://192.168.1.88:5173`).
2. Windows Firewall: allow Node.js on **Private** networks (prompt on first run). Both machines on the same Wi-Fi, network profile = Private.
3. Machine B: open the Network URL. The client auto-targets `<same host>:2567`.
4. Run the phase's DoD script step by step on both screens; note latency/jitter.
5. Disable Wi-Fi on B for ~5 s → expect reconnect UI, then recovery. For ~60 s → expect a clean "partner left" state on A.

## Production (Phase 8)

Repeat the manual test with Laptop A and Laptop B on different networks (e.g. one on a phone hotspot) against the public URL over HTTPS/WSS.

## Report

State what was run, what passed, and what was not tested. Never claim multiplayer done from single-machine tests.
