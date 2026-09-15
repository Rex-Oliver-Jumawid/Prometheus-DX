# Prometheus-DX

Prometheus-DX is the planning, prototype, and implementation repository for the Prometheus Centralized Workflow Management System.

Prometheus is an internal web application for project delivery, open internal project participation, Outcome Membership, submission review, scheduling, time tracking, notifications, reporting, and organization administration.

## Current status

Phase 01 authentication and the reusable application shell are implemented on top of the Phase 00 foundation.

The repository contains real Supabase email/password and Google sign-in, NestJS workspace authorization, a minimal Member model, protected routes, and the role-aware Prometheus shell.

Registry, project, schedule, notification, reporting, and collaboration business features remain placeholders for their later phases.

## Repository structure

```text
.agents/skills/ Vendor-neutral reusable workflows for coding agents
.context/       Product requirements, user flows, data model, tech stack, and implementation phases
.docs/phases/   Per-phase implementation journals, decisions, lessons, and final acceptance records
.model/         Functional HTML prototypes for approved UI interactions and design reference
.testcases/     Manual acceptance gates for each implementation phase
scripts/        Repository health and maintenance scripts
src/            React application
server/         NestJS API
shared/         Contracts shared between frontend and backend
prisma/         Prisma schema and migrations
public/         Application assets
tests/e2e/      Playwright browser tests
```

## Agent workflow

`AGENTS.md` contains only the rules that should remain active for every coding task.

Detailed procedures live under `.agents/skills/` and are loaded when relevant:

- `prometheus-phase-delivery` for phase implementation, acceptance, regression, and phase journals.
- `prometheus-debugging` for diagnosis and root-cause fixes.
- `prometheus-ui-implementation` for functional prototype plus Figma-driven UI work, responsive behavior, accessibility, and browser verification.
- `prometheus-database-change` for Prisma schema, migrations, constraints, and persistence changes.

Agents that do not support automatic skill discovery can read the corresponding `SKILL.md` directly because `AGENTS.md` routes each workflow to its file.

## Source-of-truth hierarchy

- `.context/Software Requirements Specification - Prometheus Centralized Workflow Management System.md` defines functional requirements and business rules.
- `.context/user-flows.md` defines canonical user behavior and access-control flows.
- `.context/data-model.md` defines persistent entities, relationships, constraints, and derived state.
- `.context/tech-stack.md` defines implementation architecture and technology choices.
- `.context/phases.md` defines implementation order.
- `.model/finalmodel.html` defines the approved functional UI interaction reference for the main application where it does not conflict with canonical requirements.
- `.model/login-page.html` defines the authentication UI interaction reference.
- Figma defines visual design and visual detail.
- `.testcases/` contains the manual acceptance gates for each phase.
- `.docs/phases/` records what was actually implemented, important decisions and challenges, lessons learned, and the final phase result.

For substantial UI work, inspect both the relevant `.model/` interaction and the relevant Figma frame when both are available.

Use `.model/` to understand intended interactions such as navigation, tabs, toggles, drawers, modals, expansion, scrolling, and interaction sequencing.

Use Figma for visual details such as layout, spacing, typography, colors, dimensions, icons, and hierarchy.

Neither prototype JavaScript nor Figma may override canonical authorization, persistence, business rules, or production architecture.

When references disagree, resolve the planning documents before encoding the behavior in application code.

The phase journals are historical implementation records rather than a replacement for canonical requirements.
If a lesson changes a product or architecture rule, update the canonical source of truth as well as the journal.

## Phase 00 setup

Requirements:

- Node.js 22
- pnpm version declared by the `packageManager` field in `package.json`
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

For phase work, use `.agents/skills/prometheus-phase-delivery/SKILL.md`.

The workflow requires agents to read the active phase and canonical requirements, keep the phase journal live, implement complete vertical slices, run acceptance and regression checks, and finalize lessons and the next approach before declaring the phase complete.

For substantial UI work, also use `.agents/skills/prometheus-ui-implementation/SKILL.md`, which requires reviewing the functional HTML prototype and the relevant Figma design before implementation.

A phase is not complete until its acceptance gate and required regression checks pass and its implementation journal is finalized.

Use stable decision IDs such as `P1-D01` and `P2-D01` so later phases can reference earlier architectural decisions without rewriting their history.

The implementation must preserve the separation between organization authority, Project Lead authority, Project Member access, and Outcome Membership.

See `AGENTS.md`, `CONTRIBUTING.md`, `.agents/skills/`, and `.docs/phases/README.md` for the repository workflow.
