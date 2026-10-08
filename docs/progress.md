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

**Status:** Approved by the user (2026-10-07).

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

## Phase 3 — Outdoor world

**Status:** Done on one machine, awaiting the user's test + approval (2026-10-07)

**What was built**

- Seeded outdoor world shared by client and server (ADR-014): 110 trees, 26 rocks, 24 berry bushes;
  flat yard, dirt road from the front door to a forest clearing, west grove (rocks/berries), east
  meadow kept open for Phase 4 hunting; world radius 58 m.
- Low-poly terrain (one vertex-colored mesh): flat yard, rolling hills, rising rim; road and grove
  tinted; players and props follow the ground height.
- Resources: chop / mine / pick with `[E]`, hold to repeat; server checks reach, cooldown, charges,
  backpack space; depleted nodes show stump/rubble/bare bush, regrow after 3–6 min; hit wobble;
  +2 XP per harvest; berries are food. Charges are saved.
- Collision with trees and rocks on client (sliding) and server (rejection).
- Day/night (ADR-015): server clock (12 min day), dawn/dusk sky, moonlit night with fog and stars;
  HUD clock with phase icon; dusk and night toasts; beds only from evening to dawn; sleeping skips
  to dawn. Time of day is saved.
- Navigation: compass bar (N/E/S/W, home, partner pinned at the edge); the road leads out and back.
- Atmosphere: instanced grass tufts and flowers, warm house lamps at night.
- Item pickup toasts ("+1 🪵 Wood") for any backpack gain.
- Dev-only `dev:set-time` command for playtests (off when `NODE_ENV=production`).

**Tests**

- `npm test`: 99 passing. New: PRNG determinism; world layout invariants (yard/road/clearing free,
  inside the world, road walkable from the door); terrain; day phases/bedtime/wrap/clock label;
  harvest charges/cooldown/full backpack/regrowth; clock wrap; bedtime + after-midnight sleep;
  networked outdoor tests (morning start, clock runs, walk down the road, chop with cooldown, out of
  reach refused); daytime bed refused; resources and time saved.
- `npm run e2e`: 4 scenarios passing (two-players, home-loop now checks "sleep after sunset",
  solo-save, outdoors: road → tree → hold E chopping → dusk warning → night).
- Fixed a flaky-test cause: the harness now waits for the first state patch (bigger state).

**Known issues**

- Wood and stone have no use yet (crafting comes with the game loop phase).
- No creatures yet: night is atmospheric only (Phase 4 adds night-active creatures).
- No terrain-height validation on the server (movement is 2D on the ground; fine for now).
- Collision checks every box (151) per move; fine at 2 players — add a spatial grid if profiling says so.
- Night darkness is a tuning knob (`DayNight.tsx` keyframes) — tell me if it feels too dark/light.
- Bundle 1.34 MB (378 kB gzip); code-splitting in Phase 7.

**Next phase:** Phase 4 — creature + hunting.

## Phase 4 — Creature + hunting

**Status:** Approved by the user (2026-10-07)

**What was built**

- Data-driven creature framework (ADR-016): kinds in `packages/shared/src/creatures.ts`; one
  server FSM for all kinds: idle ⇄ patrol → alert → chase → attack (wind-up → strike → recover) →
  hurt (knockback) → dead → butcher → respawn (3 min). Night widens detection (×1.6).
- First creature: **boar** ×4 in the east meadow. Charges faster than you walk, slower than you
  sprint; telegraphs (snout up, rearing back) before each strike; can be dodged by stepping away.
- Pack limit (data, `maxAttackers`): by day one boar hunts you at a time, at night two. Found by the
  e2e: without it the whole herd charged at noon and an unarmed player always blacked out.
- Safe yard: creatures never enter it and drop the chase when you reach it; they also give up at
  18 m or outside their territory.
- Player health (synced, saved, HUD meter, red hurt flash, slow regen while fed). At 0: black out
  and wake up at home with 50 health (stand-in for Phase 5 downed/revive).
- Bare-hand strikes: left click on a boar in the crosshair (red crosshair + "Click Punch boar"),
  server checks reach, cooldown, alive; view nods on each swing; boar flashes and shows a health bar
  (in the world from afar; inside the "Punch boar" prompt up close, so it never covers the crosshair).
- Loot: carcass → `[E] Butcher boar` → 2–3 raw meat, +15 XP; "Boar down!" toast.
- Client boar model (primitive low-poly) with trot, alert hop, wind-up/lunge, flinch and keel-over.

**Tests**

- `npm test`: 114 passing. New: creature spawns (zone, out of trees and yard), detect → alert →
  chase → strike after wind-up, dodging the wind-up, night detection, safe yard, knockback, no
  wind-up interrupt, pack limit by day/night, out-of-reach strikes refused, kill → butcher → respawn, full backpack, health
  regen/blackout, health saved; networked: boars synced, no hitting from the house, a full hunt
  (walk to the meadow, a boar charges, punch it down, butcher it).
- `npm run e2e`: 5 scenarios passing (new `hunting`: walk to the meadow, a boar charges, "Click Punch
  boar", punch it down, "Boar down!", `[E] Butcher boar`, +raw meat, still standing). Ran 5× in a
  row green after the pack-limit fix.

**Known issues**

- Bare hands only; weapons, downed/revive and starvation damage are Phase 5.
- At night two boars can charge at once; unarmed that often means a blackout (intended pressure:
  night is for being home). Tune `CREATURES.boar` if it feels unfair.
- Aim uses look direction on the ground plane only (looking at the sky still punches a boar in front).
- Boars can overlap each other (no creature-creature separation).
- Creatures walk straight at their target and slide around trees (no pathfinding); fine in the open
  meadow, they can snag on a dense tree cluster.
- Creatures aren't saved (fresh herd on re-open).
- Bundle ~1.35 MB (~381 kB gzip); code-splitting in Phase 7.

**Next phase:** Phase 5 — combat + survival.

## Phase 5 — Combat + survival

**Status:** Approved by the user (2026-10-07)

**What was built** (ADR-017)

- Weapons as data: fists, spear (melee 20 dmg, 2.6 m), bow (16 dmg arrows, 34 m/s, gravity). The
  held hotbar item is the weapon; left click uses it (food is still eaten).
- Server-simulated arrows (swept collision vs boars, ground, trees, walls), one arrow per shot.
- Workbench crafting: spear, bow, arrows x5 from wood/stone; panel shows have/need; +5 XP.
- Starvation drains health; health regen only while fed.
- Downed (30 s bleed-out) → partner holds E for 3 s → revived with 30 health (+15 XP to the
  helper). Bleed-out / alone / both down → death → wake at home with 50 health, ≥30 hunger, items
  kept. Replaces the Phase 4 blackout.
- Feedback: first-person spear/bow/fist with thrust/punch/recoil, hitmarker (red on a kill), camera
  shake + red flash when hit, downed overlay with bleed/revive bar, partner "DOWN — go help!"
  pill/toast/name tag, revive progress in the prompt.
- Dev-only `dev:hurt`, `dev:give` (production-gated) for tests.

**Tests**

- `npm test`: 129 passing. New: starvation, fall-once; downed/revive (alone → death, revive
  timing, reach, bleed-out, both down), respawn keeps items; weapon mapping; an arrow drops and
  hits a boar, the ground stops arrows; crafting all-or-nothing, arrow bundles; networked: solo
  death → home, a downed player can't move, the partner revives (+XP), crafting only at the
  workbench, bow ammo + cooldown.
- `npm run e2e`: 6 scenarios passing (new `combat`: craft spear/bow/arrows in the workbench panel,
  B goes down, A is told, walks over and holds E to revive, a bow shot uses an arrow, spear thrust).
  Screenshot review fixed an oversized bow view model and the partner's name tag tipping over and
  filling the screen when you stand next to them.

**Known issues**

- No item durability, no arrow pickup, no headshots (kept simple on purpose).
- Melee aim uses your horizontal look only; the bow uses your real pitch.
- The held weapon can clip into walls (no separate view-model render pass).
- Remote players don't show what they hold yet (Phase 7). No sound yet (Phase 7).
- Bundle 1.36 MB (384 kB gzip); code-splitting in Phase 7.

**Next phase:** Phase 6 — game loop.

## Phase 6 — Game loop

**Status:** Approved by the user (2026-10-07)

**What was built** (ADR-018)

- Wolves: second creature on the same data-driven FSM; night-only (`activeAt`), den in the north
  woods, wide prowl (`roamRadius`), pairs, retreat and vanish at dawn. Pale fur and glowing eyes
  so they read at night. The creature model is now one data-driven `Beast` (boar + wolf looks).
- Obstacle feelers for all creatures (go around trees instead of grinding into them).
- Daily shared goals (hunt / cook / gather / craft), deterministic per home and day, +25 XP to
  both players per goal; HUD list under the clock; "Goal done" toasts.
- Day stats and a morning summary card ("Day N survived" with hunted / meals / gathered /
  crafted / revives, goals x/y). Goals and stats are saved.
- Nightfall toast names the danger ("wolves are out").

**Tests**

- `npm test`: 136 passing. New: goal picking (distinct, in range, deterministic, varies by day),
  goal completion once and capped, day close + reset; wolves absent by day, out at night in their
  den, flee and vanish at dawn; a creature goes around a tree (verified to fail without feelers);
  saves keep goals/stats (tampered values clamped); networked: sleeping sends the summary and
  brings day 2 with fresh goals.
- `npm run e2e`: 7 scenarios passing (new `game-loop`: goals on the HUD, nightfall wolf warning, a
  wolf comes for you in the north woods, spear fight, home to bed, "Day 1 survived" card, fresh
  goals). The `hunting` flake (boar stuck behind a tree) is fixed: 5/5 runs green.
- Screenshot review fixed: wolves nearly invisible at night (paler fur), the summary card covering
  toasts and the bed prompt.

**Known issues**

- Levels still unlock nothing (score only).
- Staying awake past midnight shows the summary at midnight; sleeping after midnight shows none
  that morning (the day had already changed).
- Feelers are local only: a creature can still get stuck in a dense tree cluster.
- Two-machine test still pending (on the user's side).

**Next phase:** Phase 7 — polish.

## Phase 7 — Polish

**Status:** Done on one machine (tests + all 9 e2e scenarios pass), awaiting the user's test +
approval (2026-10-08)

**What was built** (ADR-019)

- Audio, all synthesized (no files): mixer with buses, positional/stereo sounds, pitch variation;
  combat, creatures, harvesting, pickups, eating, stove bell, fanfares, nightfall howl,
  footsteps (wood/grass), ambience (birds, crickets, wind). M to mute.
- Pooled particles: wood chips, stone grit, leaves, hit puffs, dust.
- Settings in the pause menu: mouse sensitivity, volume, mute (remembered per browser).
- Partners see what you hold (synced selected slot); weapon models shared with the view model.
- Head bob; smaller fist; toasts merge loot + XP and stack repeats ("×4").
- Loading: the 3D canvas is lazy-loaded (menu chunk 137 kB gzip, was 385 kB for everything),
  "Loading the world…" backdrop, friendly WebGL error screen.
- **User request:** drag and drop in the backpack and chest (move, swap, merge), server-validated.
- Profiling (`npm run e2e -- perf`): 41–55 draw calls, ~47k triangles indoors/meadow/night;
  budget 250 calls / 250k triangles. Software-rendered FPS in headless is 7–15 (a floor, not a
  real GPU number; indoor lamps cost the most in software).

**Fixed (found by playtests/e2e)**

- The day now closes in the morning (waking up, or sunrise): staying up past midnight no longer
  loses the summary (Phase 6 known issue).
- A revive pauses instead of resetting when the helper's pings lapse (lag no longer undoes it).
- Clicking with food in hand while a creature is in your face punches instead of eating (loot lands
  in the selected slot mid-hunt).
- Devtools no longer import three/R3F (kept the e2e hook loading before the 3D chunk).

**Tests**

- `npm test`: 143 passing. New: move/swap/merge within a container; drag in the backpack over the
  network, chest only at the chest; revive pause + resume; staying up past midnight still sends
  the summary on waking.
- `npm run e2e`: 9 scenarios passing (new `backpack`: real mouse drag to an empty slot and onto
  another stack; new `perf`: draw-call/triangle budget snapshots).

**Known issues**

- Sound can't be checked by the automated tests (headless has no speakers): please listen and tell
  me what's too loud, too quiet or annoying.
- Remote players don't animate attacks (only what they hold).
- The fist is still a simple block; no hand/arm models.
- Two-machine test still pending on the user's side.

**Next phase:** Phase 8 — deployment.

## Phase 8 — Deployment

**Status:** Live at https://homebound-wild-world.pages.dev (server
https://homebound-server.onrender.com), awaiting the user's two-laptop test + approval
(2026-10-08). Hosting chosen by the user: Render + Neon (ADR-020).

**What was built**

- Saves are mirrored to Postgres (`persistence/mirror.ts`) when `DATABASE_URL` is set; homes
  missing from disk are restored on boot; queued writes are flushed on graceful shutdown.
- CORS limited to `ALLOWED_ORIGINS` in production (matchmaking and `/health`).
- Production warnings in the log when `ALLOWED_ORIGINS` or `DATABASE_URL` is missing.
- Landing screen: "Waking up the server… (up to a minute)" and retries for a sleeping free host.
- `render.yaml` (Singapore, free plan, health check), README deploy guide, `.env.example`.
- `npm run deploy -- db | server | client | check`: guided deploy; the user only does the browser
  steps (sign-ups, Render blueprint, one env var). The client is a direct upload to Pages, so
  client changes need `npm run deploy -- client`; server changes deploy on push.
- Landing-screen name placeholder in Vietnamese (user request).
- Same home code + same name on another device = your saved character (ADR-021, user request).
- In-game chat (user request): Enter opens, Enter sends, Esc cancels; lines fade after ~8 s;
  server cleans and rate-limits; typing never moves/mutes you; IME-safe (Vietnamese input).
  Tested on the live site with two browsers; new e2e scenario `chat`.

**Tests**

- `npm test`: 144 passing + 1 skipped (the Postgres round-trip test needs `TEST_DATABASE_URL`).
  New: every save reaches the mirror; restore fills only missing homes, ignores bad codes.
- Production smoke test on a temp port: `/health` ok, allowed origin echoed, other origins refused.
- Production bundle contains no dev hooks.
- Real Neon database: save round-trip + restore after a wiped disk passes.
- `deploy -- check` on the live URLs: health, page, CORS allowed for the page, refused for others.
- Live smoke test (two headless browsers on the public URL): build a home, join by code, both
  enter the world over WSS, no console errors. (It left one test home in the database.)

**Known issues**

- One unidentified test failed once in 8 full runs (timing under load); not reproduced.
- wrangler 4.14x delegates new Pages projects to Workers and fails at a monorepo root; the
  script creates the project with `--force` (classic Pages).
- Fixed live: Cloudflare stripped Colyseus' HTTP 52x errors, so re-opening a saved home by code,
  wrong codes and full homes failed in production; now sent as 42x. Verified live after a redeploy
  (disk wiped): the old home came back from Neon by its code.
- Fixed live: behind Render's proxy the server's close frame after "Leave" could be lost, so the
  client waited forever; it now finishes leaving locally after 1.5 s (the server already let go).
- Render only rebuilds for server/shared/dependency changes (`buildFilter`).
- Two real laptops on the public URL: pending on the user's side (required for the DoD).
- Render free sleeps after 15 min idle (~1 min first load) and has 750 free hours/month.

## Phase 9 — Movement and animation feel

**Status:** Done on one machine (tests + e2e pass), not deployed yet; awaiting the user's test +
approval (2026-10-08).

**What was built**

- Jump (Space) with landing dust, dip and sound; dodge roll (Q) with duck and lean; stamina meter;
  sprint drains stamina; winded at 0. Input buffer for quick or early presses.
- First-person arm (sleeve + hand) with keyframed punch, stab, bow draw, chop, mine, pick, eat,
  wave, point, dodge and jump; sway with the view; bob while walking.
- Partner body rebuilt with torso, head, arms and legs on pivots: walk/run cycle from the distance
  covered, and every action animated from `action`/`actionSeq` (attack, shoot, chop, mine, pick,
  eat, wave, point, jump arc, dodge roll). Held weapon follows the right hand.
- Creatures: idle sniffing, coiling before a strike, squash on hit (on top of the existing tell,
  lunge, flinch and fall).
- Wave (G) and ping (F): a beam and ring in your color for 8 s, a 📍 on the partner's compass and
  a chime from that direction.

**Tests**

- `npm test`: 155 passing + 1 skipped. New: stamina drain/regen/winded, dodge cost/cooldown/i-frames,
  action counter wrap; over the network: dodge seen by the partner and refused inside the cooldown,
  wave/jump emotes (unknown ones ignored), ping broadcast and too-far ping dropped.
- `npm run e2e`: new `feel` scenario (wave, jump, dodge, ping on the compass, sprint drains stamina)
  and `chat`; screenshots `p9-partner-waves`, `p9-ping`, `p9-arms-hud`.

**Bugs found and fixed**

- A quick tap on Space/Q could fall between two frames at low FPS and be lost: presses now come
  from key events with a buffer that includes the last frame.
- `game-loop` e2e was flaky (2 of 4 runs): wolves roam 34 m and sometimes never came near. A
  dev-only `dev:summon` brings the nearest wolf over after 10 s; 3 of 3 runs pass. Full suite: 71 of 72
  checks passed before the fix; only `game-loop` was re-run after it.

**Known issues**

- Downed players still can't crawl (they couldn't move before either).
- Sprint speed is not enforced on the server while winded (see ADR-022).
- Arms and partner poses are tuned from screenshots in headless Chrome; please judge them in a real
  browser.

## Phase 10 — Hunting 2.0

**Status:** Done on one machine (tests + e2e pass), awaiting the user's test + approval
(2026-10-08).

**What was built**

- Creatures: deer (east meadow, bolts faster than a sprint), rabbit (west grove, snareable), bear
  (north-west den, mini-boss with a big wind-up). Skittish animals freeze, then flee; they never
  attack. Models: antlers and white tail (deer), long ears (rabbit), round ears (bear).
- Sneaking (C): slower, lower view, half detection range; sprinting is loud; the partner sees you
  crouch. HUD shows "Sneaking".
- Tracks: footprints for every animal, fresh ones glow, fade in 90 s (one draw call).
- Traps: snare (catches rabbits) and spike trap (25 damage, the creature turns on the setter); set
  with left click outside the yard, picked up with [E]; saved with the home; toast when one goes off.
- Materials and gear: hide, antler, bear claw → leather armor (−25%), bear-hide coat (−45%),
  antler spear (30 damage), snares, spike traps. Armor works while carried; the partner sees a vest.
- Mushrooms (14 patches in the north) and stove recipes with [R]: hunter's stew (heal 6× for
  2 min) and mushroom skewer (light-footed for 3 min). Buff shown in the HUD with the time left.

**Tests**

- `npm test`: 168 passing + 1 skipped. New: prey bolts and never attacks, sneaking halves detection,
  noise and buffs, a hit rabbit runs; snares catch rabbits but not boars, spike traps hit once, no
  traps in the yard; best armor counts; stew buff speeds up healing and wears off; mushrooms leave
  the original layout untouched; traps saved and tampered ones cleaned; over the network: stew only
  at the stove, set/pick up a snare, a set trap survives a re-open.
- `npm run e2e`: new `hunting2` scenario (sneak, set a snare, a rabbit is caught and butchered, a
  deer bolts; screenshots `p10-snare`, `p10-deer-bear`, `p10-bear`). The other scenarios were re-run
  one by one after the fixes below and pass (`feel` failed once under load, then passed).

**Bugs found and fixed**

- Prey stopped fleeing when the player stood outside the animal's territory (the hunters' give-up
  rule) — prey now runs from the scare wherever it is.
- A mushroom at your feet hid the "Click Punch boar" prompt mid-fight — a creature in your face now
  outranks a harvest prompt (found by the `hunting` e2e).
- `combat` e2e matched "Antler spear" when looking for "Spear" — exact match.
- My own `npm test` during an e2e run rebuilt `shared`, restarting my dev server mid-run (process
  lesson, not a game bug).

**Not done (roadmap items cut)**

- Pheasant and feather arrows, backpack upgrade, honey cake, fish (ADR-023). Can return with
  Phase 12's biomes.

**Known issues**

- Armor is "carried = worn" (no equipment slot).
- Tracks only show where animals walked while you were in the home.

## Phase 11 — Fantasy pets

**Status:** Done on one machine (tests + e2e pass), awaiting the user's test + approval
(2026-10-08). The user changed the roadmap's wolf/fox/owl into fantasy pets and picked both ways
of getting one (eggs and befriending).

**What was built**

- Five pets as data (`pets.ts`, ADR-024): baby dragon (fire breath, guards the yard at night), little
  ghost (floats through walls, glows, marks the nearest animal on the compass), baby dino
  (headbutt, butchers carcasses near you into your backpack), unicorn foal (heals players within
  6 m), tiny alien (beams up berries and mushrooms near you). Low-poly models with flapping wings,
  wagging tails, a hover saucer; hearts, fire and sparkle particles; synthesized sounds.
- Eggs: four nests far out in the world hold a glowing egg (a new one every 20 min); set it down in
  the yard with left click; it wobbles and hatches after 45 s into a surprise (no duplicate kinds).
- Wild pets: one of each roams its corner (the ghost only at night). Shy, can't be hurt; they walk
  up to you if you hold their favorite food; [E] feeds them; three feeds and they're yours.
- [E] on your pet opens its panel: rename, Follow me / Stay here / Go home, pat. The partner can pat
  it. Offline or asleep owners' pets wait at home. Up to two pets per player. Saved with the home;
  claiming a character by name brings its pets (and traps) along.

**Tests**

- `npm test`: 184 passing + 1 skipped. New: eggs only in the yard, two-pet limit, hatching into
  different kinds; follow, catch-up, stay, go home when the owner leaves; dragon kills a hunting
  boar (credited), guards the yard at night; unicorn heals; dino fetches; ghost marks; alien
  forages; befriending (wrong food, three feeds, the wild one respawns), wild pets can't be hurt
  and come to food; saves round-trip and tampered pets are cleaned; nests placed clear of other
  nodes; over the network: egg placed and saved, befriend, rename, orders, pat, owner-only orders,
  pets follow a character claimed by name.
- `npm run e2e`: new `pets` scenario (egg → hatch → name and orders → befriend the unicorn foal →
  the first pet followed; screenshots `p11-egg`, `p11-hatched`, `p11-pet-panel`, `p11-unicorn`).
  In the full run `hunting2`, `feel`, `pets` and `perf` timed out (same load pattern as Phase 10);
  each passes when re-run on its own.

**Bugs found and fixed**

- Phase 10 regression: mushrooms could not actually be picked (the server's interact switch didn't
  list them). Every resource kind now goes through one harvest path, so nests and future kinds
  can't be missed.
- Claiming a character by name (ADR-021) left their traps credited to the old id.
- A following pet stopped 2 m away, just out of [E] reach: it now stops at 1.6 m.
- Name tags filled the view up close: hidden within 3 m.

**Not done**

- Pet hunger, knock-out and levelling up, the creature journal, a pet house (ADR-024).

**Known issues**

- A pet following you into the house goes around by popping to your side when a wall blocks it.
- Ghost pets leave footprints like every creature.
