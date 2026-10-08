# Game design

_Last updated: Phase 7 (2026-10-08). What exists in the build, not the full vision (see the master
prompt summary in `development-phases.md`)._

## The home (Phase 2)

A 12 × 10 m low-poly house, front door facing the clearing (+Z):

| Room        | Furniture                                         | Use                                                               |
| ----------- | ------------------------------------------------- | ----------------------------------------------------------------- |
| Living room | sofa, rug, **shared chest**, **workbench**        | store/take items; workbench is a placeholder until crafting       |
| Kitchen     | **stove**, table                                  | cook raw meat → cooked meat (6 s); progress, smoke, browning meat |
| Bedroom     | **double bed** (each half in its sleeper's color) | sleep; everyone in bed → new day                                  |

Players spawn in the living room. The house layout is data (`packages/shared/src/world/house.ts`) used
for rendering, client collision, server validation and interaction reach.

## The outdoors (Phase 3)

```text
                  north: dense forest behind the house
  west: GROVE (rocks, berry bushes)   HOUSE   east: MEADOW (open; boar hunting ground)
                  south: dirt ROAD from the front door to a forest CLEARING (z ≈ 42)
```

- World radius 58 m; flat yard (13 m) around the house, gentle hills beyond, the rim rises into
  hills that frame the world. Compass at the top of the HUD shows N/E/S/W, 🏠 and your partner
  (pinned to the edge when behind you).
- **Resources** (110 trees, 26 rocks, 24 bushes): `[E]` chop wood, mine stone, pick berries; hold E
  to keep going (one harvest per 0.6 s). Trees 4 chops, rocks 3, bushes 2 picks of 2 berries; then a
  stump/rubble/bare bush that grows back after 3–6 min. +2 XP per harvest. Berries are food (+6).
  Wood and stone have no use yet — crafting arrives later (workbench).
- **Day and night:** a full day takes 12 minutes. Dawn and dusk tint the sky; at dusk a toast says
  "head home before dark"; night is moonlit and foggy with stars — tense but readable. Beds only work
  from early evening until dawn; sleeping together skips to dawn.

## Creatures and hunting (Phase 4, ADR-016)

- **Boar** ×4 in the east meadow (40 HP, 12 damage per tusk strike). It grazes and wanders; when you
  come within 8 m (≈13 m at night) it raises its snout (alert, 0.7 s), then charges at 5.4 m/s —
  faster than walking, slower than sprinting, so you can always run. Before striking it rears back
  for 0.55 s: step away to dodge. Hits make it flinch and get knocked back, except mid wind-up.
  By day only one boar hunts you at a time; at night up to two (plus any you provoke).
- **Fighting:** see "Combat and survival" below.
- **Loot:** a downed boar becomes a carcass → `[E] Butcher boar` → 2–3 raw meat (+15 XP to the
  killer). A new boar appears in the meadow 3 minutes later.
- **Safe yard:** boars never enter the yard around the house and lose interest once you reach it.
  They also give up when you get 18 m away or leave their territory.
- **Health** 0–100 (HUD), heals 0.25/s while fed, drains 0.55/s while starving.

## Hunting 2.0 (Phase 10, ADR-023)

- **Prey vs hunters:** deer (east meadow, faster than a sprint) and rabbits (west grove) are
  _skittish_: they notice you, freeze for a beat, then bolt; they never attack. Boars, wolves and
  the **bear** (north-west den, 160 health, a huge 0.9 s wind-up worth dodging, slower than a
  sprint) hunt you.
- **Sneaking (C):** slower and lower; animals notice you from half as far. Sprinting makes you loud
  for 1.5 s (×1.35). The "light-footed" buff helps more.
- **Tracks:** every animal leaves footprints; fresh ones glow faintly and they fade in 90 s.
- **Traps** (workbench): a snare catches a rabbit that steps in; a spike trap hurts the first
  creature over it (25) and it turns on whoever set it. Left click with a trap in hand sets it 1.6 m
  ahead, outside the yard only; [E] picks it back up. Traps are saved; up to 8 per home.
- **Materials → gear:** hide (deer, rabbit, bear), antler (deer, sometimes), bear claw. Leather
  armor (3 hide, −25% damage), bear-hide coat (3 hide + claw, −45%), antler spear (30 damage).
  Armor works while it's in your backpack; the partner sees a vest.
- **Stove recipes ([R] at the stove):** hunter's stew (meat + 2 berries + mushroom: heal 6× faster
  for 2 min), mushroom skewer (2 mushrooms + wood: light-footed for 3 min). Mushrooms grow under the
  northern trees. One buff at a time, shown in the HUD.

## The wilds (Phase 12, ADR-025)

The home valley (everything up to Phase 11) is unchanged; a ridge rings it, with low **passes** to
the north, east, south and west. Past it the world is about three times bigger:

- **Deep Forest** (north): thick dark woods, mushrooms; **the Giant Tree** towers over it.
- **Rocky Hills** (east): steep hills and boulders; **Echo Cave**, open toward home.
- **Misty Lake** (south): a shallow lake you wade through, a sandy shore; **the Abandoned Camp**.
- **Old Ruins** (west): broken walls and pillars; **the Old Watchtower** — climb it ([E]) and the
  map fills in for 75 m around.
- **The Spirit Shrine** (north-east): a beam of light over the forest; resting there heals you fully.

Trails lead from the passes to the landmarks. Walk close to a landmark to **discover** it (for both
of you): its **waystone** lights up. [E] at any lit waystone travels to another lit one; there's
one in the front yard. Each landmark (but the shrine) has a **cache** of loot that fills up again
every morning (the giant tree's sometimes holds a pet egg). The compass shows ❔ toward the nearest
landmark nobody has found yet.

**The shared map** ([M]) shows the biomes, trails, landmarks, lit waystones and both players; the
fog lifts wherever either of you has been, and a click marks a spot for both (up to 8).

## Fantasy pets (Phase 11, ADR-024)

Up to two pets each (eggs count). Pets never get hurt and never get lost.

- **Eggs:** four nests far out in the world (north-east, south-west, south, west) each hold a
  glowing egg (a new one every 20 min). Left click with the egg in hand sets it down in the yard (or
  the house); it wobbles more and more and hatches after 45 s into a surprise pet (never a second of
  a kind you already have).
- **Wild pets:** one of each roams its corner: baby dragon (north-east crag), little ghost (behind
  the house, only at night), baby dino (east meadow), unicorn foal (south clearing), tiny alien
  (south-west hollow). They're shy (they run if you walk up), can't be hurt, and come over to you if
  you hold their favorite food. [E] feeds one from your hand; three times and it's your friend. A new
  one shows up later for your partner.
- **Favorite foods:** dragon cooked meat, ghost mushroom, dino raw meat, unicorn berries, alien
  stone (it's an alien).
- **Jobs:** dragon breathes fire at anything hunting a player (10 dmg); dino headbutts (6) and
  butchers carcasses near you into your backpack; ghost floats through walls, glows at night and
  marks the nearest animal on your compass (🐾); unicorn heals everyone within 6 m; alien beams up
  berries and mushrooms near you every 12 s.
- **Orders** ([E] on your pet): Follow me / Stay here / Go home, rename, pat 💕. Anyone can pat any
  pet. When you're offline or in bed your pets wait at home; at night the fighters (dragon, dino)
  go out to meet anything prowling within 22 m of the house.
- Saved with the home; a character claimed by name (ADR-021) brings their pets along.

## Combat and survival (Phase 5, ADR-017)

| Weapon   | How                   | Damage | Reach / speed       | Every  | Boar (40 HP) |
| -------- | --------------------- | ------ | ------------------- | ------ | ------------ |
| Fists    | empty hand / material | 8      | 1.8 m               | 0.45 s | 5 hits       |
| 🔱 Spear | hotbar, click         | 20     | 2.6 m               | 0.7 s  | 2 hits       |
| 🏹 Bow   | hotbar, click (aim!)  | 16     | arrow 34 m/s, drops | 0.8 s  | 3 arrows     |

- **Workbench** (`[E] Craft`): Spear = 3 wood + 2 stone · Bow = 4 wood · Arrows x5 = 1 wood +
  1 stone. +5 XP each. The loop: chop/mine → craft → hunt.
- **Feedback:** held weapon in view (thrust, punch, bow kick), hitmarker (red on a kill), boar
  flash + health bar, red screen edge + camera shake when you're hit.
- **Downed:** at 0 health you drop to the ground (view from the grass, red vignette, bleed-out
  bar, "Hang on — Binh can revive you"). Your partner sees "An is DOWN — go help!" and a toast;
  next to you they get `[E] Hold — revive An`; 3 s of holding gets you up with 30 health (letting go pauses, it doesn't start over) (+15 XP
  for them). Boars ignore downed players.
- **Death:** bleeding out (30 s), going down alone, or both going down → you wake up at home with
  50 health, at least 30 hunger, and all your items.

## Night: wolves (Phase 6, ADR-018)

- **Wolf** ×3, pale grey with glowing eyes. They come out of the north woods at nightfall and
  prowl the whole north side up to the yard's edge; they hunt in pairs (30 HP, 10 damage, 6.2 m/s:
  faster than walking, slower than sprinting, so you can still run home). At dawn they slink back
  into the woods. Loot: 1–2 raw meat, +20 XP. The yard is safe from them too.
- Nightfall toast: "Night has fallen — wolves are out. Stay close to home."

## A day in Homebound (Phase 6, ADR-018)

- **Two shared goals per day** under the clock (e.g. "Hunt 2 animals 0/2", "Cook 3 meals 1/3").
  Both of you count; finishing one gives each of you +25 XP ("✅ Goal done: …").
- **Morning summary:** in the morning (after sleeping, or at sunrise if you stayed up), a card shows how the day went ("Day 3 survived · 🐗 2
  hunted · 🍖 3 meals cooked · 🪵 14 gathered · Goals 2/2 — great teamwork!").
- **Pressure that makes the loop:** hunger needs about two cooked meals per person per day, so
  two players need roughly two boars a day; nights are dangerous; beds only work from evening.

## Core loop available now

```text
morning goals → chop / mine → workbench → hunt boar → butcher → home before the wolves → cook → eat → bed → summary
```

- **Hunger** 0–100, starts at 80, drains over 20 min of play, paused while asleep or downed. At 0
  you lose health. Raw meat +8, cooked meat +35.
- **Sleep:** lying down moves you onto your side of the bed. When every player in the home is in
  bed (a lone player counts), the screen fades for 2.5 s and the next day starts. Getting up
  cancels. Your partner gets a toast when you go to bed.
- **XP / levels** (ADR-012): cooking a meal +10 XP (to the cook, even if the partner collects it),
  each new day +20 XP to each sleeper. Curve 50, 75, 100, … per level, max 50. Unlocks come later.
- **Starter supplies:** the chest holds 6 raw meat on day 1, a first meal before the first hunt.

## Two players, or one

- Either player can start a home alone; the other joins any time with the 5-character code.
- Both players have their own backpack and XP; the chest, stove and day are shared.
- Moments this already creates: one cooks while the other waits; "Binh came home"; "An went to bed"
  → the other hurries to bed; whoever is closer collects the finished meal.

## Feel (Phase 7, ADR-019)

- **Sound:** swings, bow twangs, hits (deeper on a kill), boar grunts and wolf growls from where
  they are (left/right), chopping/mining/picking, pickups, eating, the stove bell, fanfares for
  goals and levels, a howl at nightfall, footsteps (wood indoors, grass outside), and ambience:
  birds by day, crickets at night, wind. N mutes.
- **Particles:** wood chips, stone grit and leaves when harvesting; a puff on every hit; dust when
  a creature falls or an arrow lands.
- **Movement:** gentle head bob while walking.
- **Partner:** you see the spear or bow in their hand.
- **Backpack / chest:** drag a stack onto another slot to move, swap or merge it.
- **Settings** (pause menu): mouse sensitivity, volume, mute; remembered in this browser.

## Saving

Homes save automatically (ADR-009). Closing the browser and coming back with **Continue home** (or
the code) restores the chest, stove, day and each returning player's items, hunger, health, XP and
position. Creatures are not saved: a re-opened home has a fresh herd. A player is recognised by an anonymous id stored in their browser (ADR-010).

## Controls

WASD move · Mouse look · Shift sprint (uses stamina) · Space jump · Q dodge roll (stamina; strikes
miss you for a moment) · F mark a spot for your partner · G wave · C sneak · R stove recipes · Enter chat · E interact (hold to keep harvesting / reviving) · Left click
use the held item (food: eat; spear/bow/fists: attack; a creature in your face: punch) · 1–5 / wheel
hotbar · Tab backpack (drag to rearrange) · M map · N mute · Esc pause (settings).
