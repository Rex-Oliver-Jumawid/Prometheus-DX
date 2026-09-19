# Phase 0 - Foundation

## Status

**Complete**

Phase 0 established the production application foundation and the minimum engineering controls required before feature development.

## Objective

Create a testable frontend/backend/database architecture with repeatable local development, migrations, validation, build checks, and browser automation.

The intended data path at phase exit is:

```text
React + TypeScript + Vite
          |
          | /api/*
          v
        NestJS
          |
          v
        Prisma
          |
          v
Supabase PostgreSQL
```

Supabase Auth was included as the authentication foundation, with the actual authenticated workspace flow deferred to Phase 1.

## Scope Delivered

- React + TypeScript frontend
- Vite development and production build pipeline
- React Router SPA routing
- NestJS REST backend
- Prisma ORM and migration workflow
- Supabase PostgreSQL connection foundation
- Supabase Auth client/server configuration foundation
- TanStack Query
- Zustand for shared UI-only state
- React Hook Form
- Zod shared/runtime validation
- Tailwind CSS and custom CSS support
- Shared frontend/backend contracts
- API health endpoints
- Centralized error-handling foundation
- ESLint
- TypeScript type checking
- Vitest
- Playwright
- GitHub Actions CI
- Project doctor / configuration validation
- Environment template and frontend/backend environment separation

## Architecture Decisions

Prometheus uses a client-side React SPA rather than server-rendered application pages. Business logic and authorization are handled by NestJS rather than directly from the browser.

Persistent business state belongs in PostgreSQL. Frontend state libraries are not treated as a second source of truth.

TypeScript is shared across frontend and backend so contracts and validation rules can be reused where practical.

## Database Changes

Phase 0 introduced a tracked Prisma migration history through:

```text
prisma/migrations/20260915000000_foundation
```

The migration intentionally did not introduce business tables. Its purpose was to establish a clean, repeatable migration baseline before feature-specific schema changes.

## API / Runtime Changes

Phase 0 established:

- NestJS server entry point
- `/api` application prefix
- frontend-to-backend development proxy
- health endpoints
- database health verification
- centralized application error handling

## Environment Configuration

Environment configuration is split so browser-safe values may use `VITE_*`, while server-only values remain backend-only.

Important variable names established by the foundation include:

- `PORT`
- `CLIENT_ORIGINS`
- `DATABASE_URL`
- `DIRECT_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL`

Secret values are not documented here.

## Engineering Commands Established

Primary verification commands include:

```text
pnpm project:doctor
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm verify
```

`pnpm verify` combines project configuration checks, lint, typecheck, unit tests, and production builds.

## Testing and Acceptance

Phase 0 established the test layers later phases depend on:

- Vitest for unit and utility tests
- Playwright for browser-level E2E tests
- GitHub Actions for automated verification
- frontend health/smoke behavior
- backend health behavior
- database connectivity checks
- migration validation
- production build validation

The Phase 0 regression baseline is carried forward into every later phase.

# Decision & Challenge Log

## P0-D01 - Separate SPA frontend from backend business logic

**Status:** Accepted  
**Area:** Architecture  
**Impact:** High

### What gave us a hard time

Prometheus needed a foundation that could support a large workflow system without turning the prototype HTML into the production architecture or placing database/business logic directly in the browser.

### Root cause / constraint

The existing prototype was useful for interaction and visual reference, but the production system needed enforceable backend authorization, relational persistence, reusable components, and testable APIs.

### Options considered

1. Continue evolving the prototype as a large frontend-only application.
2. Use a full-stack framework that combines rendering and backend behavior.
3. Use a React/Vite SPA with a dedicated NestJS REST backend.

### Proposed solution

Use React + Vite for the frontend and NestJS for server-side business rules and APIs.

### Decision

Adopt a React/Vite SPA communicating with NestJS through `/api/*`.

### Why we chose it

This keeps UI concerns separate from business authorization while preserving a fast client-side application. It also matches the intended internal-workspace use case, where server-side rendering is not a core requirement.

### Result

The browser can navigate as an SPA while protected business behavior can be implemented and tested independently in NestJS.

### What we learned

The prototype should define interactions, not system authority. Production authorization and persistence need dedicated server-side ownership.

### Next approach

Future phases should put security-sensitive rules in NestJS first, then reflect them in the frontend. UI visibility alone must never be considered authorization.

### Related changes

- `.context/tech-stack.md`
- `vite.config.ts`
- `server/main.ts`
- `src/`
- `server/`

## P0-D02 - Establish migration history before business tables

**Status:** Resolved  
**Area:** Database  
**Impact:** Medium

### What gave us a hard time

Feature work was about to begin, but introducing business tables before proving migration behavior would make later database debugging harder.

### Root cause / constraint

Prometheus needed a known migration baseline that could be deployed repeatedly before domain-specific schema changes were introduced.

### Options considered

1. Wait until the first business table to create migration history.
2. Manually create database structures outside Prisma.
3. Create an explicit Phase 0 baseline migration with no business tables.

### Proposed solution

Create a tracked baseline Prisma migration first.

### Decision

Use `20260915000000_foundation` as the migration-history baseline.

### Why we chose it

It proves the migration pipeline independently from later feature schemas and keeps database evolution reproducible.

### Result

Later phases can add schema changes as ordered migrations rather than treating the current database as an undocumented starting point.

### What we learned

Migration infrastructure should be verified before the schema becomes complex.

### Next approach

Every phase that changes persistent structure should add a migration and record that migration in its phase documentation.

### Related changes

- `prisma/migrations/20260915000000_foundation/migration.sql`
- `prisma/schema.prisma`

## P0-D03 - Make verification a first-class project capability

**Status:** Accepted  
**Area:** Testing / Infrastructure  
**Impact:** High

### What gave us a hard time

A multi-phase implementation can appear functional while accumulating configuration, type, build, or integration failures that only become visible much later.

### Root cause / constraint

Prometheus needs changes across frontend, backend, database, and browser behavior. Checking only the currently edited screen would not protect the overall system.

### Options considered

1. Rely mainly on manual browser verification.
2. Add automated checks after the core product is complete.
3. Establish automated verification before feature implementation.

### Proposed solution

Create lint, typecheck, unit-test, production-build, E2E, project-doctor, and CI workflows during the foundation phase.

### Decision

Treat verification tooling as part of the product foundation rather than later cleanup.

### Why we chose it

Later phases can fail early when they break an existing contract or runtime assumption.

### Result

The repository has dedicated commands for local verification and CI, plus a Playwright baseline that later phases can expand into acceptance coverage.

### What we learned

Acceptance criteria are much easier to enforce when automation exists before feature complexity grows.

### Next approach

Each phase should extend automated coverage for its critical rules while still retaining manual checks for visual, interaction, and scenario-specific behavior.

### Related changes

- `package.json`
- `playwright.config.ts`
- `vitest.config.ts`
- `.github/workflows/ci.yml`
- `scripts/doctor.mjs`
- `tests/e2e/foundation.spec.ts`

## Known Limitations at Phase Exit

- No production business workflow existed yet.
- Authentication identity and workspace authorization were not yet implemented end to end.
- The Phase 0 migration intentionally contained no business tables.
- Later feature phases still needed to prove their own empty, loading, error, permission, and persistence states.

## Production Deployment Correction

The initial Vercel deployment built and served the Vite frontend but did not expose the existing NestJS application as a Vercel Function.
As a result, same-origin frontend calls such as `GET /api/me` were handled as static deployment paths and returned `404` after successful Supabase authentication.

The correction adds a single cached Vercel Function adapter for the existing Nest application and moves Nest creation and configuration into a shared bootstrap module.
Both the local listener and the serverless adapter now use the same `AppModule`, `/api` global prefix, CORS policy, and `AllExceptionsFilter`.
Vercel dispatches nested `/api/*` requests through an unnamed `/api/(.*)` rewrite to the `/api` function before applying the Vite SPA fallback.
The unnamed wildcard avoids adding a captured path value to the query string, and Vercel preserves the incoming pathname and query string when it invokes the function.
Local development continues to use `server/main.ts` and `app.listen()`.

The deployment keeps the Prisma 6 connection model already established by the repository: `DATABASE_URL` uses the Supabase transaction pooler for runtime queries and `DIRECT_URL` uses a direct or session connection for Prisma CLI operations.
The Vercel build command remains `pnpm prisma:generate && pnpm build` so the serverless bundle has a generated Prisma Client.

Verification on 2026-09-19 confirmed the existing production `/api/health` path returned `404` before redeployment.
`pnpm prisma:generate`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and the broader `pnpm verify` gate passed after the correction.
The compiled serverless adapter returned `200` for `/api/health` and authentication-controlled `401` responses for unauthenticated `/api/me` and `/api/projects`, proving those paths reached Nest instead of a static `404`.
The local `server/main.ts` listener also returned `200` for `/api/health` on an alternate port while the normal development port was already occupied.
Vercel CLI 59.23.2 local emulation returned `200` for `/api/health?probe=one%20two`, authentication-controlled `401` responses for `/api/me?probe=one%20two` and a nested `PATCH /api/projects/123/status?probe=one%20two`, and `200` HTML for a direct SPA route.
The CLI debug trace retained each original API pathname and query string without adding a wildcard capture parameter.
The local CLI required `TSX_TSCONFIG_PATH=tsconfig.server.json` so its development TypeScript loader used the repository's Nest decorator settings.
`vercel build` could not proceed because the checkout has no local Vercel project settings, so an actual Vercel build and post-deployment production checks remain pending.

Related changes:

- `server/bootstrap.ts`
- `server/main.ts`
- `api/index.ts`
- `vercel.json`
- `server/bootstrap.test.ts`
- `server/vercel-handler.test.ts`
- `server/vercel-config.test.ts`

## Technical Debt at Phase Exit

No Phase 0 technical debt blocks Phase 1. Any warnings from underlying build tooling should continue to be monitored but should not be confused with application correctness failures.

## Lessons From This Phase

- Establish architecture boundaries before implementing screens.
- Keep business authority on the backend.
- Track schema evolution from the beginning.
- Make verification repeatable before feature work accelerates.
- Keep environment secrets separated from browser-exposed configuration.

## Recommendations / Next Approach

Phase 1 should build real identity and authorization on top of the established architecture rather than bypassing it with prototype user state.

The key next question is not only "is this person authenticated?" but also "is this authenticated identity an active Prometheus member?"

## Phase Exit Result

**Phase 0 passed its foundation milestone and is complete.**

The project was ready to proceed to Phase 1 - Authentication and Application Shell.
