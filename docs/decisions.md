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

## ADR-016: Data-driven creatures with one server-side FSM; Phase 4 combat stand-ins (2026-10-07)

**Decision:** Creature kinds are definitions in `packages/shared/src/creatures.ts` (health, speeds,
detection, leash, attack timings, loot table, XP, respawn, zone, count). One finite state machine in
`apps/server/src/systems/creatures.ts` runs every kind: idle ⇄ patrol → alert (telegraph) → chase →
attack (wind-up, strike, recover) → chase; hit → hurt (knockback) → chase; 0 health → dead (carcass,
butcher with [E]) → respawn after a delay. Only position, yaw, mode, health and presence are synced;
timers, targets and patrol goals are `noSync`. The client animates from `mode`.

- **The yard is a safe zone:** creatures never enter it and ignore players inside, so "run home"
  always works. Detection range grows at night, and so does the pack limit (`maxAttackers`: one
  boar per player by day, two at night).
- **No stun-lock:** hits during a wind-up don't interrupt it.
- **Creatures are not saved:** a re-opened home gets fresh creatures (nothing a player owns is lost).
- **Phase 4 stand-ins, replaced in Phase 5 (ADR-017):** players strike with bare hands (`UNARMED_ATTACK`);
  at 0 health a player blacks out and wakes up at home with `BLACKOUT_HEALTH` (instead of
  downed/revive). Player health is saved.

**Why:** content as data (CLAUDE.md), smallest AI that reads well; behaviour trees/navmesh are
unnecessary for open meadows with a few trees (collision sliding is enough).

## ADR-017: Weapons as data, server-simulated arrows, downed → revive → death, workbench crafting (2026-10-07)

**Decision:**

- **Weapons** live in `packages/shared/src/weapons.ts` (`fists`, `spear` melee; `bow` ranged with
  `arrow` ammo). An item's `weapon` field links it to a weapon. The client sends `attack { slot,
targetId, yaw, pitch }`; the server reads the weapon from its own copy of that hotbar slot,
  applies the cooldown, and for melee checks reach to the creature's body.
- **Arrows** are simulated on the server (gravity, swept in 0.25 m steps against creature
  cylinders, terrain, trees/rocks/walls). Only x/y/z are synced; clients extrapolate and orient
  them. Hits send `hit-confirm` to the shooter (hitmarker); creatures turn on the shooter.
- **Downed / revive / death** (replaces the Phase 4 blackout): at 0 health you're downed for 30 s;
  a partner holding [E] next to you for 3 s revives you with 30 health (bleeding pauses while they
  do). Bleeding out, going down alone, or both going down = death: wake up at home with 50 health
  and at least 30 hunger, **items kept** (co-op, not punishment). Starving drains health.
- **Crafting** at the workbench from `recipes.ts` (spear, bow, arrows x5), atomic, +5 XP. Added now
  because weapons need a source that also works for existing saves.
- Dev-only `dev:hurt` / `dev:give` for tests (same production gate as ADR-015).

**Why:** content as data; the server stays authoritative over damage, ammo and hits; the downed
state is the core co-op moment ("go help!") of the MVP.

## ADR-018: The day loop: night wolves, shared daily goals, morning summary (2026-10-07)

**Decision:**

- **Wolves** (second creature, same FSM and data as ADR-016): `activeAt: 'night'`. They appear
  at nightfall in the north woods (`ZONES.forest`), prowl up to 34 m around it (`roamRadius`, right
  up to the yard's edge), hunt in pairs, and at dawn run from the nearest player and vanish once
  nobody is within 25 m. The yard stays safe.
- **Feelers:** creatures that bump into a tree try headings fanned out to either side and take
  the first that makes real progress (no pathfinding). Found by a flaky e2e: a charging boar could
  grind against a trunk forever.
- **Daily goals:** each day the home gets 2 shared goals from `packages/shared/src/goals.ts`
  (hunt, cook, gather wood/stone, craft), deterministic per home code and day. Both players
  contribute; finishing one gives **everyone** +25 XP.
- **Day stats and summary:** the server counts what the home did today; when the day number
  changes (sleeping, or staying up past midnight) it broadcasts `day-summary`, resets the stats
  and picks new goals. Goals and stats are saved (older saves get fresh goals).

**Why:** the MVP's success test is "chơi thêm ngày nữa đi": each day needs a direction (goals),
a reason to be home by dark (wolves), and a moment of closure that invites the next day (summary).
Levels still unlock nothing; they stay a score for now.

## ADR-019: Polish without assets: synthesized audio, pooled particles, lazy 3D chunk (2026-10-08)

**Decision:**

- **Audio** is synthesized with WebAudio (`apps/client/src/audio/`): oscillators + one shared noise
  buffer, a small mixer (master → sfx / ambience buses, levels in dB), ±8% pitch variation per play,
  positional sounds with distance roll-off and stereo pan from the local player. Ambience follows
  the clock (birds by day, crickets at night, wind). No audio files, no licences, zero bytes to
  download. The context starts on the first click/key (browser rule).
- **Particles:** one pooled instanced mesh (192 pieces) for wood chips, stone grit, leaves, hit
  puffs and dust; game code calls `emitBurst()`; no per-frame allocation.
- **Code splitting:** the R3F canvas is `React.lazy`-loaded: the menu shell is 137 kB gzip and works
  while the 253 kB 3D chunk downloads ("Loading the world…"); an error boundary explains when WebGL
  can't start.
- **Settings** (mouse sensitivity, volume, mute) are per-viewer and live in `localStorage` with
  safe fallbacks; they are preferences, not game state.
- **Partner's held item:** `PlayerState.selectedSlot` is synced (cosmetic); attacks still read the
  weapon from the server's own copy of the slot named in the attack.
- **Fixes found by playtests:** the day closes at sunrise (waking up, or dawn without sleeping), so
  staying up past midnight still ends with the morning summary; a revive pauses (never resets)
  when the helper's pings lapse; clicking with food in hand while a creature is in your face
  punches instead of eating; repeated toasts stack ("×4").

## ADR-020: Cloudflare Pages + Render free + saves mirrored to Neon Postgres (2026-10-08)

**Context:** Phase 8 needs a public URL at zero cost. Free Node hosts with WebSockets (Render)
sleep when idle and wipe the disk, where saves live (ADR-009). Chosen by the user over self-hosting
behind a Cloudflare Tunnel and an Oracle Cloud VM.
**Decision:**

- Client: static build on Cloudflare Pages; `VITE_SERVER_URL` points at the Render service.
- Server: Render free web service from `render.yaml` (`NODE_ENV=production`, `/health` check).
- Saves: the JSON files stay the working copy (the room code stays synchronous); each save is
  also upserted into a Neon `homes (code, save jsonb)` table through a queue, and on boot homes
  missing from disk are restored. The queue is flushed on graceful shutdown. The data is validated
  on load exactly like a file.
- CORS: `ALLOWED_ORIGINS` (exact origins) in production.
- Matchmaking errors leave the server as HTTP 420–429 instead of Colyseus' 520–529: Render sits
  behind Cloudflare, which replaces 52x with its own bodiless, CORS-less errors. Found live: re-opening
  a saved home by code failed (the client never saw "not running" and so never re-opened the save).

**Trade-off:** first visit after 15 idle minutes waits ~1 minute (the landing screen says so). A
save written in the last seconds before a crash (not a graceful stop) can miss the database.
**Revisit when:** the wait annoys players (paid always-on instance, ~$7/month) or saves outgrow
loading every home at boot.

## ADR-021: A character can be claimed by name (2026-10-08)

**Context:** Players are known by an anonymous browser id (ADR-010), so a new device or browser
meant a fresh character in the same home. The user asked for "same home code + same name = my
character".
**Decision:** On join, the character saved under the browser id wins; if there is none, a saved
character with the same name (case-insensitive) who is not in the home right now is moved to the
new browser id. A different name still starts fresh.
**Trade-off:** anyone with the home code and a player's name can take over that character (accepted
for a private two-person game). Two saved characters with the same name: the first one is claimed.

## ADR-022: Movement and animation feel (2026-10-08)

**Decision:**

- **Actions are replicated as state, not events:** `PlayerState.action` + a wrapping `actionSeq`.
  The server sets them when it accepts something visible (strike, shot, harvest, eat, dodge) or an
  emote (jump, wave, ping → point). A changed counter replays the animation even for repeats, and
  a late joiner never sees a stale one-shot. The local player animates immediately (`localAction`).
- **Stamina is server-owned.** Moves carry `sprint`; the server drains stamina for the time spent
  sprinting, refills it after a pause, and winds you at 0 until 25. Dodges cost 30 and give a short
  window in which creature strikes miss (checked on the server). Known ceiling (`ponytail:` in
  `systems/stamina.ts`): the speed check still allows sprint speed while winded, because walking vs
  sprinting is inside the jitter tolerance; the client simply stops sprinting.
- **Jump is cosmetic:** positions stay 2D on the server; the arc is local and the partner replays it
  from the `jump` emote.
- **Input buffer:** Space/Q are read from key events and kept for 250 ms plus one frame, so quick
  taps and slightly early presses (Q in mid-air) are never lost, even at a low frame rate. Found by
  the e2e run at 2–3 FPS.
- **Pings** are broadcast messages (not saved): a beam + ring in the sender's color for 8 s, a 📍
  on the compass. For a child who types slowly, F does what a sentence would.
- First-person arms and the partner's limbs are keyframed procedurally from data tables (no
  skeletal assets).

## ADR-023: Hunting 2.0 — prey, stealth, traps, gear and recipes as data (2026-10-08)

**Decision:**

- **Temperament in the creature definition** (`hostile` | `skittish`) and a `Flee` mode in the one
  shared state machine: prey spots you, freezes for `alertMs`, then bolts until the scare is
  `giveUpRange` behind it. Prey ignores the pack limit and the leash when spotting or fleeing (only
  hunters give up at the edge of their territory). New kinds are entries in `creatures.ts`: deer,
  rabbit (`snareable`), bear (new `den` zone).
- **Stealth on the server:** `crouch` rides on move messages; detection range × 0.5 crouched,
  × 1.35 for 1.5 s after sprinting, × buff. The most noticeable player wins (distance / own range).
- **Traps are synced, saved state** (`HomeState.traps`, ADR-009 save + validation). The server
  checks them every tick against creature bodies; players never trigger them. Owner credit is by
  playerId, so a trap set by someone offline still counts.
- **Armor is carried, not equipped:** the best `armor` item anywhere in the backpack reduces
  creature damage. No equipment slots or UI for one stat; revisit if more slots appear.
- **Recipes have a station** (`workbench` | `stove`); stove recipes are instant dishes with a
  `buff`. Plain raw meat keeps its timed cook on [E]; [R] opens the recipes (no change to the old
  loop). Buffs are data (`buffs.ts`): one at a time, server-timed, shown in the HUD.
- **Mushrooms are generated in a separate pass with their own seed**, so adding them didn't move a
  single existing tree or rock (test).
- **Tracks are client-only**: footprints are drawn from the synced creature positions in one
  instanced mesh; no extra network or server work.

**Not done (from the roadmap):** pheasant and feather arrows, backpack upgrade, honey cake and fish.
They can come back with Phase 12's biomes.

## ADR-024: Fantasy pets — one pet AI as data, two ways to get one (2026-10-08)

**Context:** The user asked for fantasy pets (ghost, dragon, dinosaur, alien, unicorn…) instead of
the roadmap's wolf/fox/owl, obtained both by hatching eggs and by befriending wild ones.

**Decision:**

- **Pets are data** (`pets.ts`): name, favorite food, feeds needed, and optional abilities
  (`fight`, `fetch`, `scout`, `heal`, `forage`). One server loop (`systems/pets.ts`) moves every pet
  by its order and runs whichever abilities its definition has.
- **Wild pets are creatures** with `tame: <pet kind>`: the existing AI, zones and respawn handle
  them; they're skittish, can't be damaged, ignore players offering their food and walk up to them.
  Befriending retires the creature (it respawns later) and creates a `PetState`.
- **Eggs are pets with an empty kind** (`PetState.kind === ''`), so eggs and pets share one map,
  one save list and one per-player limit (2). Nests are a resource kind (charges 1), so finding an
  egg reuses harvesting and its respawn.
- **Pets can't be hurt** (kid-friendly; no health, hunger or knock-out). Offline/asleep owners'
  pets wait at home; fighters guard the yard at night.
- **Owner is server-only** (`owner` = playerId, never sent); clients see `ownerSession`. Claiming a
  character by name re-owns their pets and traps.
- Saves: `HomeSave.pets` (validated: id pattern, owner id, kind, order, name cleaned, coordinates
  clamped, at most 2 per owner); additive, so `SAVE_VERSION` stays 1 like Phase 10's traps.

**Not done:** pet hunger and knock-out, pets levelling up, a creature journal, a pet house (Phase 15).

## ADR-025: A bigger world around an unchanged valley; biomes, landmarks and the map as data (2026-10-08)

**Decision:**

- **The valley stays exactly as it was:** its generator still uses the old radius
  (`HOME_RADIUS` = 58); `WORLD_RADIUS` grows to 100 (≈3× the area). The wilds are one more
  generation pass with their own seed and ids that continue after the valley's, so saved homes
  keep every tree, rock and nest in place and their resource charges still match.
- **Biomes by direction** past a ridge with four passes (`biomes.ts`): ground colors, leaf/rock
  tints, hill height and how thickly things grow. `biomeMix` blends them so terrain heights and
  colors never jump; trees and rocks keep one instanced draw call per part (instance colors tint
  them).
- **Landmarks are data** (`landmarks.ts`): position, colliders, a cache with a loot table, a
  waystone. Discovery is proximity (14 m) and shared by the home; travel only between lit
  waystones and only from one you stand at; caches empty once per day per home.
- **Fog of war is server state** (8 m cells, a map of revealed indices, 22 m around each player,
  the tower 75 m), so both players share it and it is saved. The client draws the map on a canvas:
  the land once, fog and marks every 400 ms while it's open.
- The lake is shallow water you wade through (no swimming or raft); mute moved to N so M is the
  map.

**Not done (from the roadmap):** the raft, the glider cloak (Phase 13), journal pages (Phase 13),
biome animals (Phase 14 brings monsters to the biomes), biome ambience. No LOD or chunking was
needed: the wilds measured 30 draw calls and 116k triangles looking out from the north pass.

## ADR-026: The story as data — one shared step, finished by events, the world or [E] (2026-10-08)

**Decision:**

- **Chapters and steps are data** (`quests.ts`): each step has a kind (talk, bring, visit, hunt,
  craft, tame, light), its goal text and Đốm's line when it's done. The client builds every line
  from the position (`domLine(chapter, step)`), so nothing but `{ chapter, step, progress }` and the
  lit lanterns is synced or saved.
- **One linear story per home**, shared: either player moves it on. Hunts and crafts send events
  (kills by players, traps and pets go through one `hunted()` in the room); visits and pets are
  checked every tick; talking and lighting happen on [E].
- **Rewards are items** for everyone present at a chapter's end (overflow into the chest). The
  roadmap's glider cloak and raft were cut: they need new movement (gliding, floating) that isn't
  worth it yet.
- **Lit lanterns are safe zones** (creatures don't spot or keep chasing anyone within 14 m) and
  brighten the night ambient a little each.
- Saves: `quest` (validated: a real chapter and step, or the end) and `lanterns`.

**Not done:** side quests (lost hedgehog, spirit merchant), carvings in the world, the glider
cloak and raft.

## ADR-027: Gear is worn, bags resize the backpack, drops are saved state, the stove has pans (2026-10-08)

**Decision:**

- **Equipment slots** (`PlayerState.equipment`, EQUIP_SLOTS: head, body, feet, back, weapon) are
  synced (the partner draws them) and saved. Items say where they go (`wear`, or `weapon` for
  weapons) and what they do (`armor`, `stealth`, `slots`). **Supersedes ADR-023's "armor is
  carried":** only worn pieces count; armor adds up to ARMOR_MAX 0.6 (blows always hurt a little).
- **Bags resize the backpack array** (10 → 15/20). Equipping or removing a bag is refused while the
  slots that would disappear hold anything: nothing is ever silently lost. Saves store the
  equipment and validate the inventory against `backpackSize(equipment)`.
- **The weapon slot is a fallback**, not a second hand: an empty hotbar slot holds the worn weapon
  (`handItem`, used by client and server alike). Hotbar weapons work as before.
- **Drops are `HomeState.drops`** (a bag per dropped stack, ≤ MAX_DROPS 40, saved): refusing a drop
  beats despawning someone's items. Picking up takes what fits and leaves the rest.
- **The stove is STOVE_PANS (3) `StoveState`s** (`HomeState.pans`). [E] collects everything done,
  else fills every free pan with the held cookable food or raw meat — never mushrooms you aren't
  holding (chapter 1 asks for them). Old saves' single `stove` loads as the first pan.
- **Descriptions are data** (`ItemDefinition.description`); the client words the numbers.

**Not done:** dropping from the chest or straight from the hotbar, a durability system, gear stats
beyond armor/stealth/slots.

## ADR-028: The game speaks Vietnamese (2026-10-08)

**Decision:** every player-facing string — UI, prompts, toasts, items, creatures, pets, places,
the story — is Vietnamese, written in place (no i18n layer, no language switch). The family plays
in Vietnamese; one language keeps the code simple. Code, comments, logs and docs stay English.
The page is `lang="vi"`. A shared glossary keeps terms consistent (Ba lô, Rương chung, Bàn chế
tạo, Đèn lồng lớn, …).

**Revisit when** someone who doesn't read Vietnamese plays: then move strings into a `strings`
module per language.
