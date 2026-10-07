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
