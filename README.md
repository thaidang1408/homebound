# HOMEBOUND: WILD WORLD

> Live together. Hunt together. Survive together.

A browser-based, first-person, stylized low-poly survival game for **two players online**.

## Requirements

- Node.js ≥ 22 (developed on 24)
- npm ≥ 10

## Quick start

```sh
npm install
cp .env.example .env   # optional; defaults work for local dev
npm run dev
```

- Client: http://localhost:5173
- Server: ws://localhost:2567 (health: http://localhost:2567/health)

The landing screen shows "Server online" when the client can reach the server.

### How to play

1. Enter a name → **Build a new home** → **Start game** (you can play alone).
2. Your partner enters the 5-character home code shown in the HUD → **Join** — any time, even mid-game.
3. Click the world to capture the mouse. WASD move, Mouse look, Shift sprint, **E** interact,
   left click eat the held food, 1–5 / wheel hotbar, Tab backpack, Esc pause. Hold **E** to keep
   chopping/mining/picking.
4. Loop: take raw meat from the **chest** → cook it at the **stove** → eat → head out the front door to
   chop wood, mine stone and pick berries → when the sun sets, come home → both lie in the **bed** → dawn.
5. Homes save automatically. Next time, **Continue home** (or enter the code) picks up where you left off.
   Saves live in `apps/server/data/homes/` in dev.

### Playing on two machines (LAN)

1. On Machine A run `npm run dev` and note the **Network** URL Vite prints (e.g. `http://192.168.1.88:5173`).
2. Allow Node.js through Windows Firewall on **Private** networks when prompted.
3. On Machine B (same Wi-Fi) open that URL.
4. If B can't connect: check both are on the same network, the network profile is **Private**, and
   `http://<machine-a-ip>:2567/health` opens on B.

## Deploying (free)

Frontend on Cloudflare Pages, game server on Render (free plan), saves copied to Neon Postgres
(ADR-020). All three have free tiers without a card. Render's free server sleeps after 15 minutes
without players; the first visit after that waits ~1 minute ("Waking up the server…").

1. **GitHub** — create an empty **private** repo, then:
   `git remote add origin https://github.com/<you>/homebound.git && git push -u origin main`
2. **Neon** (neon.tech) — new project, region _AWS Asia Pacific (Singapore)_. Copy the connection
   string (`postgres://…?sslmode=require`). The server creates its `homes` table itself.
3. **Render** (render.com) — _New → Blueprint_, pick the repo; it reads `render.yaml`. Set
   `DATABASE_URL` to the Neon string; leave `ALLOWED_ORIGINS` for step 5. When it is live, open
   `https://<service>.onrender.com/health` — it should say `{"status":"ok",…}`.
4. **Cloudflare Pages** — _Workers & Pages → Create → Pages → Connect to Git_, pick the repo:
   - Build command: `npm run build -w @homebound/shared && npm run build -w @homebound/client`
   - Build output directory: `apps/client/dist`
   - Environment variables: `VITE_SERVER_URL=https://<service>.onrender.com`, `NODE_VERSION=22`
5. Back on Render, set `ALLOWED_ORIGINS=https://<project>.pages.dev` (comma-separate several).
6. Open the Pages URL on two computers: one builds a home, the other joins with the code.

Every push to `main` redeploys both. Server logs: Render dashboard → _Logs_.

## Scripts

| Command             | What it does                                                                            |
| ------------------- | --------------------------------------------------------------------------------------- |
| `npm run dev`       | Shared (watch) + server (tsx watch) + client (Vite, LAN-exposed)                        |
| `npm run build`     | Build shared, server, client                                                            |
| `npm start`         | Run the built server (`apps/server/dist`)                                               |
| `npm test`          | Vitest (unit + server integration)                                                      |
| `npm run e2e`       | Browser playtests: two players, home loop, solo + save (needs `npm run dev` and Chrome) |
| `npm run typecheck` | TypeScript across all packages, including tests                                         |
| `npm run lint`      | ESLint                                                                                  |
| `npm run format`    | Prettier write                                                                          |

## Layout

```text
apps/client     Vite + React + React Three Fiber
apps/server     Node + Colyseus (authoritative)
packages/shared Shared constants and protocol types
docs/           Architecture, decisions, phases, progress
.claude/        Claude Code skills for this project
```

See [docs/architecture.md](docs/architecture.md) and [docs/development-phases.md](docs/development-phases.md).
