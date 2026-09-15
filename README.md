# Prometheus-DX

Prometheus-DX is the planning, prototype, and implementation repository for the Prometheus Centralized Workflow Management System.

Prometheus is an internal web application for project delivery, open internal project participation, Outcome Membership, submission review, scheduling, time tracking, notifications, reporting, and organization administration.

## Current status

Phase 01 authentication and the reusable application shell are implemented on top of the Phase 00 foundation.

Phase 02 Registry is in progress.

The repository contains real Supabase email/password and Google sign-in, NestJS workspace authorization, protected routes, the role-aware Prometheus shell, and the first persisted Registry department-management slice.

Later Registry member-management work and the project, schedule, notification, reporting, and collaboration phases remain incomplete.

## Repository structure

```text
.agents/skills/ Vendor-neutral reusable workflows for coding agents
.context/       Product requirements, UI reference policy, user flows, data model, tech stack, and implementation phases
.docs/phases/   Per-phase implementation journals, decisions, lessons, and final acceptance records
.model/         Functional HTML prototypes that define the intended application experience
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
- `prometheus-ui-implementation` for prototype-driven UI implementation, Figma-assisted visual inspection, responsive behavior, accessibility, and browser verification.
- `prometheus-database-change` for Prisma schema, migrations, constraints, and persistence changes.

Agents that do not support automatic skill discovery can read the corresponding `SKILL.md` directly because `AGENTS.md` routes each workflow to its file.

## Source-of-truth hierarchy

- `.context/Software Requirements Specification - Prometheus Centralized Workflow Management System.md` defines functional requirements and business intent.
- `.context/user-flows.md` defines authorization and canonical workflow rules that production must enforce.
- `.context/data-model.md` defines the current persistent entities, relationships, constraints, and derived state.
- `.context/tech-stack.md` defines implementation architecture and technology choices.
- `.context/phases.md` defines implementation order.
- `.context/ui-reference.md` defines how the prototype and Figma are used during UI implementation.
- `.model/finalmodel.html` is the prototype source of truth for the main authenticated application's user-visible behavior and experience.
- `.model/login-page.html` is the prototype source of truth for the authentication screen experience.
- Figma is a supporting helper for measurements, visual detail, variables, icons, and frame inspection.
- `.testcases/` contains the manual acceptance gates for each phase.
- `.docs/phases/` records what was actually implemented, important decisions and challenges, lessons learned, and the final phase result.

The production application is intended to turn `finalmodel.html` into a real working application rather than design a different application inspired by it.

For substantial UI work, inspect the relevant workflow in `finalmodel.html` first.

Everything demonstrated by that workflow should be reflected in production unless the user explicitly changes the product decision.

Use Figma MCP or another connected Figma integration as a helper for fine visual implementation details when available.

When Figma and `finalmodel.html` disagree about the application experience, follow `finalmodel.html` unless a newer explicit user decision says otherwise.

Prototype code itself is not production architecture.

The real application must implement the same experience through React, NestJS, Prisma, PostgreSQL, Supabase, validation, and backend authorization.

If a prototype feature requires a field or relationship missing from the current data model, reconcile that mismatch rather than silently omitting the prototype feature.

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

For substantial UI work, also read `.context/ui-reference.md` and use `.agents/skills/prometheus-ui-implementation/SKILL.md`.

Start from the relevant `finalmodel.html` workflow, reproduce that experience in the working application, and use Figma as a supporting visual helper rather than a competing source of truth.

A phase is not complete until its acceptance gate and required regression checks pass and its implementation journal is finalized.

Use stable decision IDs such as `P1-D01` and `P2-D01` so later phases can reference earlier architectural decisions without rewriting their history.

The implementation must preserve the separation between organization authority, Project Lead authority, Project Member access, and Outcome Membership.

See `AGENTS.md`, `CONTRIBUTING.md`, `.context/ui-reference.md`, `.agents/skills/`, and `.docs/phases/README.md` for the repository workflow.