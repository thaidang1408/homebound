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

The top-left pill shows "Server online" when the client can reach the server.

### Playing on two machines (LAN)

1. On Machine A run `npm run dev` and note the **Network** URL Vite prints (e.g. `http://192.168.1.88:5173`).
2. Allow Node.js through Windows Firewall on **Private** networks when prompted.
3. On Machine B (same Wi-Fi) open that URL.

## Scripts

| Command          | What it does                                                     |
| ---------------- | ---------------------------------------------------------------- |
| `npm run dev`    | Shared (watch) + server (tsx watch) + client (Vite, LAN-exposed) |
| `npm run build`  | Build shared, server, client                                     |
| `npm start`      | Run the built server (`apps/server/dist`)                        |
| `npm test`       | Vitest (unit + server integration)                               |
| `npm run lint`   | ESLint                                                           |
| `npm run format` | Prettier write                                                   |

## Layout

```text
apps/client     Vite + React + React Three Fiber
apps/server     Node + Colyseus (authoritative)
packages/shared Shared constants and protocol types
docs/           Architecture, decisions, phases, progress
.claude/        Claude Code skills for this project
```

See [docs/architecture.md](docs/architecture.md) and [docs/development-phases.md](docs/development-phases.md).
