# Development phases

Each phase ends with tests + build + lint, a Definition of Done check, an update to `progress.md`,
and a **stop for user approval ("OK")**.

MVP scope: exactly 2 players, online (two machines), small house, small forest, 1–2 creatures,
1 ranged + 1 melee weapon, health/hunger, downed/revive, raw → cooked meat, shared storage,
day/night, both-players-sleep to advance the day. No accounts, DB, voice, payments, social, 3–4 players.

| #   | Phase                      | Definition of Done                                                                                                                                                                                                                                                                  |
| --- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Foundation                 | `npm install`, `npm run dev`, `npm run build` work; lint + tests pass                                                                                                                                                                                                               |
| 1   | Real 2-player multiplayer  | Machine A creates a room → code → Machine B joins → both appear; each sees the other move/rotate; disconnect handled; basic lobby                                                                                                                                                   |
| 2   | House + interaction        | Both players enter the house, move, interact, cook, eat, store items (shared chest), sleep                                                                                                                                                                                          |
| 3   | Outdoor world              | Small forest, terrain, resources, day/night, spawn points, navigation, atmosphere                                                                                                                                                                                                   |
| 4   | Creature + hunting         | Data-driven creature framework, first creature with idle→patrol→detect→chase→attack→hurt→dead, loot; second creature only if the first works well                                                                                                                                   |
| 5   | Combat + survival          | Weapon system (ranged + melee), health, hunger, damage, downed, revive, death, respawn, combat feedback                                                                                                                                                                             |
| 6   | Game loop                  | Home → prepare → hunt → fight → loot → return → cook → eat → sleep → new day feels like a game                                                                                                                                                                                      |
| 7   | Polish                     | UI, animation, audio, lighting, particles, feedback, loading/error states, multiplayer UX, profiling                                                                                                                                                                                |
| 8   | Deployment                 | Frontend on Cloudflare Pages, game server on a WebSocket-capable Node host; HTTPS/WSS, CORS, health check, logging; Laptop A + Laptop B on the public URL join the same room                                                                                                        |
| 9   | Movement + animation feel  | Jump, stamina, dodge roll; first-person arms; partner body animation; creature animation pass; wave + ping. Both players read what the other does at 20 m without chat                                                                                                              |
| 10  | Hunting 2.0                | Tracks, sneaking, deer/rabbit/bear, snares and spike traps, hides → armor and an antler spear, stove recipes with buffs. A full hunt takes 10–15 min with a role for both                                                                                                           |
| 11  | Fantasy pets               | Baby dragon, little ghost, baby dino, unicorn foal, tiny alien: hatch an egg from a nest or befriend a wild one with its favorite food; follow/stay/home, a name, a pat; each pet has a job. The child wants to log in to see their pet                                             |
| 12  | Exploration + bigger world | The valley is ringed by a ridge with four passes; past it four biomes (Deep Forest, Rocky Hills, Misty Lake, Old Ruins) with five landmarks, loot caches, waystones and a shared map with fog of war. A new player finds three landmarks without being told; the frame budget holds |
| 13  | Story + quests             | Đốm the talking lantern; five chapters, one great lantern each; shared quest steps (talk, bring, visit, hunt, craft, tame, light); quest tracker and compass marker; grandpa's journal. Chapter 1 plays start to finish and both players know what to do next                       |

| 14 | Backpack, gear + kitchen | Drop items as bags anyone can pick up; head/body/feet/back/weapon slots (worn gear counts, the partner sees it); satchel and big backpack add slots; item descriptions; small on-screen key hints; three stove pans and new dishes |

Phases 15–17 (fantasy monsters, home + garden, seasons) are
proposed in `docs/roadmap.md` and are added here one at a time as the user approves them.

Success milestone: two people on two computers share a room code, cook, fight, revive each other,
run home at night, sleep, start a new day — and want to play again.
