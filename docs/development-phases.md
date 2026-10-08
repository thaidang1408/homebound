# Development phases

Each phase ends with tests + build + lint, a Definition of Done check, an update to `progress.md`,
and a **stop for user approval ("OK")**.

MVP scope: exactly 2 players, online (two machines), small house, small forest, 1–2 creatures,
1 ranged + 1 melee weapon, health/hunger, downed/revive, raw → cooked meat, shared storage,
day/night, both-players-sleep to advance the day. No accounts, DB, voice, payments, social, 3–4 players.

| #   | Phase                     | Definition of Done                                                                                                                                                           |
| --- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Foundation                | `npm install`, `npm run dev`, `npm run build` work; lint + tests pass                                                                                                        |
| 1   | Real 2-player multiplayer | Machine A creates a room → code → Machine B joins → both appear; each sees the other move/rotate; disconnect handled; basic lobby                                            |
| 2   | House + interaction       | Both players enter the house, move, interact, cook, eat, store items (shared chest), sleep                                                                                   |
| 3   | Outdoor world             | Small forest, terrain, resources, day/night, spawn points, navigation, atmosphere                                                                                            |
| 4   | Creature + hunting        | Data-driven creature framework, first creature with idle→patrol→detect→chase→attack→hurt→dead, loot; second creature only if the first works well                            |
| 5   | Combat + survival         | Weapon system (ranged + melee), health, hunger, damage, downed, revive, death, respawn, combat feedback                                                                      |
| 6   | Game loop                 | Home → prepare → hunt → fight → loot → return → cook → eat → sleep → new day feels like a game                                                                               |
| 7   | Polish                    | UI, animation, audio, lighting, particles, feedback, loading/error states, multiplayer UX, profiling                                                                         |
| 8   | Deployment                | Frontend on Cloudflare Pages, game server on a WebSocket-capable Node host; HTTPS/WSS, CORS, health check, logging; Laptop A + Laptop B on the public URL join the same room |
| 9   | Movement + animation feel | Jump, stamina, dodge roll; first-person arms; partner body animation; creature animation pass; wave + ping. Both players read what the other does at 20 m without chat       |

Phases 10–16 (hunting 2.0, pets, exploration, story, fantasy monsters, home + garden, seasons) are
proposed in `docs/roadmap.md` and are added here one at a time as the user approves them.

Success milestone: two people on two computers share a room code, cook, fight, revive each other,
run home at night, sleep, start a new day — and want to play again.
