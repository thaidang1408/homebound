# Game design

_Last updated: Phase 2 (2026-10-07). What exists in the build, not the full vision (see the master
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

## Core loop available now

```text
chest (raw meat) → stove (cook) → eat (hotbar click / backpack) → bed (sleep) → new day
```

- **Hunger** 0–100, starts at 80, drains over 20 min of play, paused while asleep. No penalty at 0
  yet (Phase 5 adds health damage). Raw meat +8, cooked meat +35.
- **Sleep:** lying down moves you onto your side of the bed. When every player in the home is in
  bed (a lone player counts), the screen fades for 2.5 s and the next day starts. Getting up
  cancels. Your partner gets a toast when you go to bed.
- **XP / levels** (ADR-012): cooking a meal +10 XP (to the cook, even if the partner collects it),
  each new day +20 XP to each sleeper. Curve 50, 75, 100, … per level, max 50. Unlocks come later.
- **Starter supplies:** the chest holds 6 raw meat on day 1 (until hunting exists, Phase 4).

## Two players, or one

- Either player can start a home alone; the other joins any time with the 5-character code.
- Both players have their own backpack and XP; the chest, stove and day are shared.
- Moments this already creates: one cooks while the other waits; "Binh came home"; "An went to bed"
  → the other hurries to bed; whoever is closer collects the finished meal.

## Saving

Homes save automatically (ADR-009). Closing the browser and coming back with **Continue home** (or
the code) restores the chest, stove, day and each returning player's items, hunger, XP and
position. A player is recognised by an anonymous id stored in their browser (ADR-010).

## Controls

WASD move · Mouse look · Shift sprint · E interact · Left click eat held food · 1–5 / wheel hotbar ·
Tab backpack · Esc pause.
