# Roadmap after the MVP (proposal, 2026-10-08)

_Status: **proposal awaiting the user's approval.** Nothing here is built yet. Once approved, the
phases move into `docs/development-phases.md` and follow the same workflow (tests, docs, stop for
"OK")._

The MVP proved the loop: home → hunt → cook → sleep → new day, for two players. The next phases
make it **feel** better, give it **reasons to explore**, a **story**, **pets** and **fantasy
monsters**, and make the home grow. The audience is a parent and a child playing together, so the
fantasy is cozy-adventurous (cute, readable monsters, no gore) and co-op always beats solo.

Constraints stay the same: browser, 2 players, server authoritative, data-driven content,
procedural low-poly assets, zero running cost, and every phase ships something playable.

## 1. What similar games do well, and what we take

| Game                      | What makes it work                                                                                            | What Homebound takes                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Valheim                   | Biomes as difficulty tiers; a boss per biome whose trophy unlocks the next tier; "rested" buff at a cozy fire | Biome ladder gated by bosses; comfort buff from the home (fire, bed, decorations)                        |
| Don't Starve Together     | Night is truly dangerous; seasons; quirky monsters; a ghost partner can be brought back                       | Night tension (already), weather/seasons later, "spirit" form instead of hard death                      |
| Minecraft                 | Tame a wolf with a bone; pets follow, sit, fight; discoverable structures; one clear end goal                 | Tame by feeding a liked food; follow/stay commands; ruins/caves to find; a final boss as the story's end |
| Palworld / Pokémon        | Creatures have jobs at the base; collection; riding                                                           | Pets that help at home (guard at night, fetch loot, keep the fire going); a small creature journal       |
| Monster Hunter            | The hunt itself is the game: track → find → read tells → break parts → carve → craft gear from that monster   | Tracks to follow, readable wind-ups, monster-specific materials that become gear                         |
| Grounded / Raft           | Story found in the world (notes, recordings, landmarks); a quest log that points somewhere                    | Journal pages and a guide character; quests that send you to places                                      |
| Stardew Valley            | Daily rhythm, cozy home, garden, festivals, small goals every day                                             | Daily goals (already), garden plots, home upgrades, a festival day                                       |
| Enshrouded                | Glider and grappling make exploring fun; the safe zone grows as you progress                                  | Movement tools unlocked by the story (glider cloak); the yard's safe zone grows with the home            |
| Zelda: Breath of the Wild | Cooking by combining ingredients; landmarks you see and want to reach; climbing                               | Recipe combinations with buffs; visible landmarks (tower, giant tree); light climbing on ledges          |
| It Takes Two              | Abilities that only work together                                                                             | Co-op moments: one lures, one strikes the weak spot; two-person levers; boosting each other up           |

## 2. Gaps in the game today

- **Movement:** no jump, no stamina, no dodge; the world is flat to walk through.
- **Animation:** first-person "hands" are a block; the partner does not animate attacks, chopping,
  eating or the bow draw; creatures have simple poses.
- **Hunting:** two animals, no tracking, no stealth, loot is only meat.
- **Content:** one small world (58 m radius), three weapons, one recipe station.
- **Story / quests:** only daily goals; no reason to go anywhere specific.
- **Pets, fantasy monsters, bosses:** none yet.

## 3. Proposed phases

Each phase is about one to two weeks of work at the pace so far. Order follows the project
priority (gameplay > multiplayer > fun > performance > UX > visuals): feel first, then the hunt,
then the things that hunting and feel make fun (pets, exploration, story, bosses).

### Phase 9 — Movement and animation feel

_Goal: moving, fighting and watching your partner feel alive._

- Jump (cosmetic arc; the server keeps validating the 2D position), **stamina** for sprint and a
  **dodge roll** (server-owned, shown in the HUD), landing dust and camera dip.
- **First-person arms** (low-poly hands) with swing, stab, bow draw, chop, mine, eat and "pick up"
  animations; weapon sway and recoil.
- **Partner body animation:** procedural walk/run cycle, attack swings, bow draw, chopping, eating,
  sleeping, downed crawl, waving.
- **Creature animation pass:** anticipation squash before attacks, hit flinch, death tumble,
  idle variety (sniff, look around).
- **Emotes and pings:** wave/point (keys or `/wave` in chat) and a **ping marker** ("come here",
  "look at this") that shows on the partner's screen and compass. Great for a child who types slowly.

_Done when:_ both players can read what the other is doing at 20 m without chat, and sprint/dodge
make a boar fight about timing.

### Phase 10 — Hunting 2.0

_Goal: a hunt is a small adventure: find, approach, fight, harvest, craft._

- **Tracks:** footprints and broken twigs that lead to animals; fresh tracks glow faintly.
- **Stealth:** crouch to approach; animals notice you by distance, speed and noise.
- **New animals** (data in `creatures.ts`): deer (flees, quick), rabbit (caught with snares),
  turkey or pheasant (flies away), and a **bear** as the forest's mini-boss.
- **Traps:** snare and spike trap crafted at the workbench.
- **Materials from animals:** hide, feathers, antlers, bear claw. New gear: leather armor (less
  damage), feather arrows (fly farther), antler spear (more damage), backpack upgrade (+5 slots).
- **Cooking combinations:** stew (meat + berries + mushroom) → regenerates health; roasted fish;
  honey cake; each with a short buff shown in the HUD.

_Done when:_ a full hunt (track a deer, sneak, shoot, carve, craft armor) takes 10–15 minutes and
both players had a role.

### Phase 11 — Pets and taming

_Goal: each player can have one companion that matters._

- **Taming:** some creatures (wolf pup, fox, owl) can be befriended by offering their favorite food
  several times while calm. Kid-friendly: no capture balls, just friendship.
- **Commands:** follow, stay, go home; name the pet; pet it (hearts).
- **Pet roles:** wolf fights alongside you and **guards the yard at night**; fox **fetches** loot
  from carcasses and finds berries; owl **scouts** (marks the nearest animal on the compass).
- Pets have health and hunger, get **knocked out** instead of dying and wake up at home; they level
  up with their owner. Saved with the home.
- A **creature journal**: every animal seen, tracked, hunted or tamed gets a page.

_Done when:_ the child wants to log in to see their pet, and a pet changes how a night is played.

### Phase 12 — Exploration and a bigger world

_Goal: there's always a place you can see and want to reach._

- World grows to about 3× today in **biomes**: Meadow (home), Deep Forest, Misty Lake, Rocky Hills,
  Old Ruins. Each with its own trees, rocks, colors, ambience and animals.
- **Points of interest:** abandoned camp, cave, ruined watchtower (climb to reveal the map), spirit
  shrine, giant tree. Chests with loot and journal pages.
- **Shared map** (M) with fog of war that both players reveal; markers you can place.
- **Travel:** waystones to return home; a raft on the lake; the **glider cloak** unlocked by the
  story (Phase 13) to jump from the watchtower.
- Performance work in the same phase: biome chunks, instancing and LOD so the draw-call budget holds.

_Done when:_ a new player can find three landmarks without being told, and the frame budget holds.

### Phase 13 — Story and quests

_Goal: a reason to keep coming back that ends somewhere._

- **Premise (draft):** the family moves into grandpa's old cabin at the edge of the Wild. The
  forest's spirit-lanterns have gone out one by one and the night creatures grow bolder. A small
  talking lantern, **Đốm**, wakes up in the cabin and asks for help to relight the five great
  lanterns, one in each biome.
- **Chapters** (one per biome): each has a short quest chain (find, help, craft, defeat) and ends
  by relighting a great lantern, which pushes back the night, grows the safe zone and unlocks a
  reward (glider cloak, raft, new recipes).
- **Quest system as data** (`quests.ts`): steps like collect, hunt, visit, craft, talk, tame;
  shared progress for the home; a quest log and a compass marker for the current step.
- **Storytelling in the world:** grandpa's journal pages, carvings, Đốm's lines at key moments
  (text bubbles; no voice acting).
- **Side quests** from small characters (a lost hedgehog, a forest spirit merchant), alongside the
  daily goals.

_Done when:_ chapter 1 can be played start to finish and both players know what to do next.

### Phase 14 — Fantasy monsters and bosses

_Goal: nights and ruins hold magical creatures that are exciting, not scary-gross._

- **Night creatures:** will-o'-wisps (lure you off the path), shadow wolves (stronger wolves that
  fade in light: torches matter), mushroom sprites (puff sleep spores).
- **Cave and ruin creatures:** moss slimes (split when hit), stone beetles (armored: hit the back),
  crystal bats.
- **Bosses, one per chapter,** each with telegraphed attacks, phases and a **co-op mechanic**:
  - _Mossback Troll_ (forest): one player lures, the other hits the glowing moss on its back.
  - _Lake Serpent_ (lake): shoot the lanterns to stun it, then strike from the raft.
  - _Stone Golem_ (hills): two levers must be pulled at once to open its core.
  - _Shadow Alpha_ (ruins): light braziers to strip its shadow armor.
  - _The Night Moth_ (final): the last great lantern; everything learned comes together.
- Boss trophies unlock the next biome's gear tier (Valheim's ladder). Creatures get **abilities as
  data** (charge, leap, spit, summon, armor), still run by the one server-side state machine.

_Done when:_ each boss needs both players and can be beaten in 5–10 minutes on the first try with
some deaths.

### Phase 15 — Home that grows, garden and comfort

_Goal: the home is the reward for everything you do outside._

- **Home upgrades:** extra rooms, a porch, a fireplace, a pet house, a trophy wall for bosses.
- **Furniture and decoration** crafting, placed on a simple grid inside the house.
- **Garden:** plant berry bushes, carrots, mushrooms; water them; harvest every few days.
- **Comfort / "rested" buff** from fire, bed quality and decorations: slower hunger and faster
  regen when you set out.
- The yard's safe zone grows with each relit lantern.

_Done when:_ players spend time at home by choice and argue about where the trophy goes.

### Phase 16 — Weather, seasons and events (optional)

- Rain (fewer animals out, fire goes out), fog, snow in winter (warm clothes matter).
- Seasons change food and animals; a **festival night** each season with lantern decorations and a
  special recipe.
- **Difficulty setting** (relaxed / normal) chosen per home, so a young child can enjoy the story
  without stress.

## 4. Cross-cutting rules for all of this

- **Content as data:** creatures, abilities, quests, recipes, pets and biomes are definitions in
  `packages/shared`; the server runs them, the client draws them.
- **Server authoritative:** taming, pet actions, quest progress, boss phases and loot are decided
  on the server.
- **Saves:** every phase that adds something persistent bumps `SAVE_VERSION` with a migration and a
  test (pets, quests, home upgrades, garden).
- **Performance budget** stays: ≤ 250 draw calls and ≤ 250 k triangles; profile in each phase.
- **Kid-friendly:** cute silhouettes, no blood, readable warnings before every attack, and nothing
  is ever lost for good (items kept on death, pets wake up at home).

## 5. Recommendation

Start with **Phase 9 (movement and animation)**: everything after it, such as hunting, pets and
bosses, depends on how good moving and fighting feel, and it fixes the most visible gaps today
(block hands, a partner who doesn't animate). Then 10 → 11, which give the quickest "one more day"
pull for a parent and child. The story (13) is the long-term reason to return. Its draft premise
above should be adjusted with the user before writing quests.
