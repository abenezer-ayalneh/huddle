# Postgres + Prisma + BetterAuth for accounts & scheduling

Phase 7 introduced the first database. We chose **Postgres** (a real server, not
SQLite) because the Phase 9 target is multi-node behind a shared store, and
**Prisma** as the ORM because it fits the TypeScript-everywhere stack with typed
queries and first-class migrations. Postgres runs as a fourth container in
`infra/docker-compose.yml`; the API reads `DATABASE_URL` from the repo-root `.env`.

For auth we chose **BetterAuth** with **social login only** (Sign in with Google
and Apple) — no password storage to secure. BetterAuth owns its own tables
(`user`, `session`, `account`, `verification`) in the same Prisma schema; our
`room` model references `user`.

## Two consequences worth remembering

1. **better-auth is ESM-only; NestJS compiles to CommonJS.** A static `import`
   would break the build (and switching the API to ESM would break the Jest/
   ts-jest setup that the pre-commit hook depends on). So the auth instance is
   loaded via a dynamic `import()` and built once, lazily (`apps/api/src/auth/auth.ts`),
   and its HTTP routes are mounted with `toNodeHandler` in `main.ts`. Because of
   this, body parsing is configured per-route: raw for `/api/auth`, JSON (with
   raw-byte capture for the LiveKit webhook) for everything else.

2. **Session and host key are separate authorities.** The BetterAuth session
   answers "who is signed in" and gates owning/creating rooms (`AuthGuard`). The
   per-room `x-host-key` answers "are you this room's host" and gates in-call
   admin actions (`HostGuard`). They are intentionally independent so host
   authority is never inferred from a (client-visible) token role claim. The host
   key now lives on the persisted `room` row, so host authority survives an API
   restart.

## Prisma version note

We pinned Prisma to the **6.x** line. Prisma 7 removed `url` from the schema
datasource (requiring `prisma.config.ts` + driver adapters) and BetterAuth's
Prisma adapter targets the 6.x client shape; 6.x keeps the setup simple.
