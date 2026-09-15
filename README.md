# Prometheus-DX

Prometheus-DX is the planning, prototype, and implementation repository for the Prometheus Centralized Workflow Management System.

Prometheus is an internal web application for project delivery, open internal project participation, Outcome Membership, submission review, scheduling, time tracking, notifications, reporting, and organization administration.

## Current status

Phase 01 authentication and the reusable application shell are implemented on top of the Phase 00 foundation.

The repository contains real Supabase email/password and Google sign-in, NestJS workspace authorization, a minimal Member model, protected routes, and the role-aware Prometheus shell.

Registry, project, schedule, notification, reporting, and collaboration business features remain placeholders for their later phases.

## Repository structure

```text
.context/      Product requirements, user flows, data model, tech stack, implementation phases, and template-adoption notes
.model/        HTML interaction prototypes used as references only
.testcases/    Manual acceptance gates for each implementation phase
scripts/       Repository health and maintenance scripts
src/           React application
server/        NestJS API
shared/        Contracts shared between frontend and backend
prisma/        Prisma schema and migrations
public/        Application assets
tests/e2e/     Playwright browser tests
```

## Source-of-truth hierarchy

- `.context/Software Requirements Specification - Prometheus Centralized Workflow Management System.md` defines functional requirements and business rules.
- `.context/user-flows.md` defines canonical user behavior and access-control flows.
- `.context/data-model.md` defines persistent entities, relationships, constraints, and derived state.
- `.context/tech-stack.md` defines implementation architecture and technology choices.
- `.context/phases.md` defines implementation order.
- Figma defines visual design.
- `.model/finalmodel.html` and `.model/login-page.html` are prototype and interaction references only.
- `.testcases/` contains the manual acceptance gates for each phase.

When references disagree, resolve the planning documents before encoding the behavior in application code.

## Phase 00 setup

Requirements:

- Node.js 22
- pnpm 10 or newer
- A Supabase project for the real database and Auth configuration

Use the repository Node version when `nvm` is available:

```bash
nvm use
```

Install dependencies:

```bash
pnpm install
```

Create local environment configuration:

```bash
cp .env.example .env
```

Replace the placeholder Supabase PostgreSQL and Auth values in `.env`.

In Supabase Auth, enable Email and Google as required and add both the local and deployed `/login` URLs to the allowed redirect URLs.

Apply the Prisma migration before starting the authenticated workspace:

```bash
pnpm prisma:migrate:deploy
```

For local test members, set `PROMETHEUS_SEED_MEMBERS_JSON` as documented in `.env.example`, then run `pnpm prisma:seed`.

The seed never creates Supabase Auth accounts or passwords.
Create test identities through Supabase Auth and use only non-production credentials.

Check the repository configuration:

```bash
pnpm project:doctor
```

Generate the Prisma client:

```bash
pnpm prisma:generate
```

Apply the tracked baseline migration to a clean development database:

```bash
pnpm prisma:migrate:deploy
```

Start the frontend and backend together:

```bash
pnpm dev
```

Open:

```text
http://localhost:5173/foundation
```

The page checks:

- React/Vite rendering
- Frontend to NestJS API connectivity
- NestJS to Supabase PostgreSQL connectivity through Prisma
- Presence of browser-safe Supabase Auth configuration

## Verification commands

```bash
pnpm project:doctor
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Run the non-browser checks together:

```bash
pnpm verify
```

Check or apply code formatting with:

```bash
pnpm format:check
pnpm format
```

Use `.testcases/phase-01-auth-shell-tests.md` as the Phase 01 manual acceptance gate.

## Environment security

Only variables prefixed with `VITE_` are exposed to browser code.

`DATABASE_URL`, `DIRECT_URL`, and any future service-role credentials are backend-only and must never be prefixed with `VITE_`.

`.env` and `.env.*` files are ignored by Git except `.env.example`.

## Implementation workflow

For each phase:

1. Read the matching section in `.context/phases.md`.
2. Implement only the planned phase scope.
3. Run the matching manual checks in `.testcases/`.
4. Fix failed acceptance checks before beginning the next phase.

The implementation must preserve the separation between organization authority, Project Lead authority, Project Member access, and Outcome Membership.

See `CONTRIBUTING.md` for the repository contribution workflow.
See `.context/template-adoption.md` for which conventions were adopted from `prometheus-inc/app-template` and which framework-specific pieces were intentionally excluded.
