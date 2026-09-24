# Prometheus Development and Worktree Guide

## Standard Setup

```bash
pnpm install
cp .env.example .env
pnpm prisma:generate
pnpm prisma:migrate:deploy
pnpm dev
```

Use Node 22 or newer and the pnpm version declared in `package.json`.

## Multiple Git Worktrees

Prometheus development frequently uses several worktrees at once.

Each worktree is a separate checkout but may still compete for:

- Vite port
- NestJS API port
- preview port
- shared database
- browser sessions

Do not assume the default ports are free.

Prefer `git switch` when changing branches inside a worktree.

## Port Troubleshooting

Find the process using a port:

```bash
lsof -nP -iTCP:5173 -sTCP:LISTEN
lsof -nP -iTCP:3001 -sTCP:LISTEN
```

Replace the port with the one reported by Vite or the API.

Terminate only the process you intend to stop.

If several Prometheus worktrees are running, verify the process working directory before killing it when practical.

## Per-Worktree Ports

A worktree may override development ports through its environment.

Keep the frontend proxy and API port aligned.

If the API runs on a non-default port, verify the Vite proxy/environment for that same worktree points to the matching API.

A browser page loading on one port while its API proxy points at another worktree can produce misleading behavior.

## API Health

Use a direct API health request before debugging UI symptoms:

```bash
curl -i http://127.0.0.1:<API_PORT>/api/health
```

For database connectivity:

```bash
curl -i http://127.0.0.1:<API_PORT>/api/health/database
```

A successful Vite page does not prove the API or database is healthy.

## Prisma Client Errors

If the API reports an error similar to:

```text
Cannot find module '.prisma/client/default'
```

run:

```bash
pnpm prisma:generate
```

Then restart the API process.

After pulling a branch containing new migrations:

```bash
pnpm prisma:generate
pnpm prisma:migrate:deploy
```

## Database Migrations

Use:

```bash
pnpm prisma:migrate:deploy
```

to apply committed migrations.

Use `pnpm prisma:migrate` only while deliberately authoring a development migration.

Never assume Vercel applies migrations automatically.

## Verification Layers

Fast repository verification:

```bash
pnpm verify
```

Includes project doctor, lint, typecheck, unit/service tests, component tests, and production builds.

Browser integration:

```bash
pnpm test:e2e
```

Release cross-browser:

```bash
pnpm test:e2e:cross-browser
```

Use lower-level service/component tests for authorization matrices, validation, stale-write handling, and pure derived models when a real browser is not material.

Use Playwright for browser routing, real authentication, persisted journeys, responsive UI, and integration behavior.

## Credential-Gated E2E

Some Playwright journeys require:

- `E2E_MEMBER_EMAIL`
- `E2E_MEMBER_PASSWORD`

A test reported as skipped is not a pass.

Do not weaken an E2E test simply because credentials are unavailable.
Use service/component coverage for behavior that can be proven below the browser and record signed-in smoke separately when required.

## Work Sessions and Live Refresh

`WorkSession` remains the source of truth.

Home, Team, and VisiWork may poll or invalidate queries so Time In and Time Out changes appear automatically.

If a live refresh looks wrong, inspect the WorkSession API/database state before adding client-only presence state.

## Chat Debugging

For Project Chat or VisiWork Chat:

1. verify the message exists in PostgreSQL.
2. verify the room scope.
3. verify the current user's read/write relationship.
4. verify the API response.
5. verify React Query refresh/invalidation.
6. verify exact-message context and search independently.
7. verify notifications separately from message persistence.

Do not fix a missing live update by creating duplicate local-only message state.

## tmux

List sessions:

```bash
tmux ls
```

Kill a specific session:

```bash
tmux kill-session -t <session>
```

## Safe Main-Branch Workflow

Before a direct main change:

```bash
git switch main
git pull
git log -1 --oneline
```

Never force-push `main` to reconcile a normal branch divergence.

After direct changes, verify CI on the exact resulting commit.

## Common Misdiagnoses

### UI looks stale after merge

Check whether the production deployment actually contains the new main commit.
A GitHub merge and a Vercel Production deployment are separate events.

### New database feature returns 500

Check migration state before changing UI code.

### One browser shows stale data

Check query refresh policy, focus/reconnect behavior, and whether that browser is connected to the intended local API.

### Different worktrees behave differently

Compare:

- branch/commit
- `.env`
- Vite/API ports
- Prisma client generation
- migration state
- browser origin/session
