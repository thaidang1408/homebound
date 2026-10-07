# Game design

_Last updated: Phase 4 (2026-10-07). What exists in the build, not the full vision (see the master
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
- **Fighting:** look at a boar within reach → the crosshair turns red with "Click Punch boar".
  Bare hands deal 8 (5 punches, one every 0.45 s). Weapons arrive in Phase 5.
- **Loot:** a downed boar becomes a carcass → `[E] Butcher boar` → 2–3 raw meat (+15 XP to the
  killer). A new boar appears in the meadow 3 minutes later.
- **Safe yard:** boars never enter the yard around the house and lose interest once you reach it.
  They also give up when you get 18 m away or leave their territory.
- **Health** 0–100 (HUD), heals 0.25/s while not starving. At 0 you black out and wake up at home
  with 50 health and all your items (Phase 5 replaces this with downed + revive by your partner).

## Core loop available now

```text
go out: hunt boar / chop / mine / pick → butcher → home → stove (cook) → eat → dusk → bed → dawn
```

- **Hunger** 0–100, starts at 80, drains over 20 min of play, paused while asleep. No penalty at 0
  yet (Phase 5 adds health damage). Raw meat +8, cooked meat +35.
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

## Saving

Homes save automatically (ADR-009). Closing the browser and coming back with **Continue home** (or
the code) restores the chest, stove, day and each returning player's items, hunger, health, XP and
position. Creatures are not saved: a re-opened home has a fresh herd. A player is recognised by an anonymous id stored in their browser (ADR-010).

## Controls

WASD move · Mouse look · Shift sprint · E interact (hold to keep harvesting) · Left click punch the
creature in the crosshair, otherwise eat held food · 1–5 / wheel hotbar ·
Tab backpack · Esc pause.
