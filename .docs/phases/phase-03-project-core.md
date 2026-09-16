# Phase 3 - Project Core

## Status

**Complete - 2026-09-16**

All three planned Phase 3 slices are complete and verified.

Phase 2 - Registry is complete.

Its formal closure record is `.docs/phases/phase-02-registry-closure.md`.

## Objective

Create project discovery, creation, ownership relationships, and the project overview while preserving the distinction between organization authority and project-specific authority.

## Canonical Scope

Required interfaces:

- `/projects`
- All Projects
- My Projects
- Leading
- Participating
- Create Project modal or drawer
- `/projects/:projectId`
- Project Overview
- Project status control
- Project Lead display
- Department associations

## Core Rules

1. All active authorized Prometheus users may view all Projects.
2. Any active authorized user may create a Project.
3. Project creator and Project Lead are separate concepts.
4. Project Lead is project-specific and is not an organization role.
5. Project creation grants no special authority by itself.
6. Administrator status grants no Project Lead authority by itself.
7. Only eligible active authorized Members may be selected as Project Lead.
8. Project-specific authorization must be enforced by the backend and not inferred from frontend visibility.

## Deferred Regression From Phase 2

F2-21 must run as soon as a persisted Project Lead relationship exists.

The fixture must be a Project Lead whose workspace role is `MEMBER`, not `ADMINISTRATOR`.

Expected result:

- Registry navigation is absent.
- Direct `/registry` access is denied.
- Direct Registry API access is forbidden.

This regression is tracked in `.testcases/phase-03-project-core-tests.md`.

## Recommended Implementation Order

### Slice 1 - Persistence and authorization foundation

Establish the Project data model and protected backend behavior first.

Required outcomes:

- Project persistence exists.
- `created_by_member_id` and `lead_member_id` are separate relationships.
- Project-to-Department associations persist according to the canonical data model.
- Project status persists according to the canonical data model.
- Project list, create, and detail APIs exist.
- Every active authorized Member can view Projects.
- Every active authorized Member can create a Project.
- Lead assignment validates an active authorized Member.
- Creator status does not grant Lead authority.
- Administrator status does not grant Lead authority.
- Focused service/API tests cover these rules.
- F2-21 is executed once a non-admin Lead fixture exists.

Do not implement Stage, Outcome, Outcome Membership, or Project Membership in this slice.

Those belong to Phase 4.

### Slice 2 - Project discovery and creation UI

After Slice 1 is verified, replace the `/projects` placeholder with the real project list and Create Project experience.

Use `.model/finalmodel.html` for interaction behavior and Figma for visual presentation.

Keep All Projects, My Projects, Leading, and Participating behavior aligned with canonical rules.

Participating may remain empty or intentionally unavailable until the Phase 4 relationship that derives participation exists, but the UI and documentation must not fabricate participation records.

### Slice 3 - Project overview and status

Implement `/projects/:projectId`, Project Overview, Lead display, Department associations, and status controls after list/create persistence is stable.

Backend authorization must remain authoritative for project-specific actions.

## Required Verification Strategy

After each meaningful change, run the smallest relevant check first.

For the persistence slice:

- Prisma validation and generation.
- Migration inspection and status.
- Focused Project service/controller tests.
- Typecheck and lint.
- Focused browser tests only after the corresponding UI exists.

Before Phase 3 exit:

- `pnpm verify`
- `pnpm test:e2e`
- `pnpm prisma migrate status`
- Complete `.testcases/phase-03-project-core-tests.md`
- Confirm deferred F2-21 passes with a real non-admin Project Lead.

## Source Ownership

- `.context/phases.md` defines Phase 3 scope and exit milestone.
- `.context/data-model.md` defines Project persistence relationships.
- `.context/user-flows.md` defines Project workflows and authorization behavior.
- `.model/finalmodel.html` defines intended interaction behavior.
- Figma defines visual presentation.
- Current code defines implementation reality to evolve.

## First Action

Read the canonical Project model and flows, inspect the existing Prisma schema and `/projects` placeholder, then design the smallest additive Prisma migration and backend vertical slice for Project list/create/detail with separate creator and Lead relationships.

## Slice 1 Delivery - 2026-09-16

### Implemented

- Added `Project`, `ProjectDepartment`, and `ProjectStatusHistory` persistence with migration `20260916030000_phase_03_project_persistence`.
- Added canonical `ProjectStatus` values: `PLANNING`, `IN_PROGRESS`, `DONE`, and `ARCHIVED`.
- Preserved separate `created_by_member_id` and `lead_member_id` relationships with explicit Prisma relation names and lookup indexes.
- Added shared Zod Project contracts for list, detail, create input, status, Department summaries, and Member summaries.
- Added protected `GET /api/projects`, `POST /api/projects`, and `GET /api/projects/:projectId` endpoints.
- The create endpoint derives the creator from the authenticated active Member, validates the selected Lead is active, validates every persisted Department ID, and writes the Project, Department associations, and initial status-history row atomically.
- The Projects placeholder UI remains intentionally unchanged.

### P3-D01 - Model creator and Lead as independent Project relationships

**What gave us a hard time:** Project creation must preserve audit authorship without turning the creator into a project authority.

**Root cause or constraint:** The canonical model requires an active Member to create a Project and independently allows another active Member to become its Project Lead.

**Options considered:** A single owner relationship would be simpler but would incorrectly grant implied authority and could not represent a creator assigning another Lead.

**Final decision:** Persist non-null `created_by_member_id` and `lead_member_id` foreign keys on `projects` with explicit Prisma relation names, and derive only the former from `currentMember`.

**Why it was chosen:** This encodes the authorization boundary in durable domain data and makes Administrator, creator, and Lead authority remain separate.

**Observed result:** Focused tests confirm a regular Member and an Administrator can create a Project for another active Lead without either creator relationship replacing the selected Lead.

**What was learned:** The API contract must not accept a client-supplied creator ID because it is audit data owned by authenticated server context.

**Next approach:** Build the list and Create Project UI directly on the established contracts, then defer overview and status mutation behavior to the planned Slice 3.

**Related files:** `prisma/schema.prisma`, `prisma/migrations/20260916030000_phase_03_project_persistence/migration.sql`, `server/projects/`, and `shared/contracts/project.ts`.

### Verification

- Focused Project and contract tests: 42/42 unit tests passed.
- Deferred F2-21 browser regression: 1/1 passed with a real persisted active non-admin Project Lead fixture.
- `pnpm verify`: passed, including lint, typecheck, 42 unit tests, and both production builds.
- `pnpm test:e2e`: passed with 15/15 tests.
- `pnpm prisma migrate status`: six migrations applied and schema up to date.

### Next Slice

Implement Slice 2 only: real `/projects` list, Create Project flow, and the intentional empty/loading/error states backed by the new API.

Do not implement `/projects/:projectId` overview or status controls until Slice 3.

## Slice 2 Delivery - 2026-09-16

### Implemented

- Added protected `GET /api/projects/create-options` under the existing active-member guard without an Administrator requirement.
- The endpoint returns only active Member `id`, `fullName`, and `email` for Lead selection, plus persisted Department `id`, `name`, and `shortLabel` data.
- Replaced the `/projects` placeholder with real All Projects query rendering, intentional loading, empty, and error states, and a Retry action.
- Added a keyboard-accessible Create Project dialog with focus management, safe Escape and backdrop behavior, React Hook Form validation, active Lead selection, persisted multi-Department selection, mutation error retention, query invalidation, and synchronous duplicate-submit protection.
- Added current Phase 3 client filters for Leading and the clearly scoped creator-or-Lead My Projects view.
- Participating explicitly remains unavailable until Outcome Membership creates the canonical Project participation relationship in Phase 4.
- Added no migration because Slice 1 persistence already contains every required Project relationship.

### P3-D02 - Keep Project creation options in the Projects domain

**What gave us a hard time:** Every active Member may create a Project, but Registry APIs remain Administrator-only.

**Root cause or constraint:** Reusing Registry list APIs in the Create Project dialog would either leak Registry metadata or make normal Member creation impossible.

**Options considered:** Broaden Registry authorization, duplicate records in the client, or add a narrow Projects-domain query.

**Final decision:** Add `GET /api/projects/create-options` behind only the existing active-member authentication guard and select the smallest fields directly from Member and Department persistence.

**Why it was chosen:** This preserves Registry authority boundaries while giving every authorized creator only the data needed to select a Lead and Departments.

**Observed result:** Focused service coverage verifies the active-member predicate and the narrow response shape, while browser coverage creates a Project as a regular active Member with another active Member as Lead.

**What was learned:** A safe UI option endpoint is a domain-specific read model, not a reason to expose an administrative controller to a broader role.

**Next approach:** Build Slice 3 detail and status behavior on the existing Project read model without creating any Phase 4 participation records.

**Related files:** `shared/contracts/project.ts`, `server/projects/projects.controller.ts`, `server/projects/projects.service.ts`, `src/features/projects/`, and `tests/e2e/projects.spec.ts`.

### Verification

- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- Focused Project service and contract tests: passed within the 44-test Vitest suite.
- `pnpm exec playwright test tests/e2e/projects.spec.ts`: passed with the real authenticated creation path, Lead and Department persistence checks, refresh, duplicate-submit guard, narrow viewport check, and console-error assertion.
- `pnpm test:e2e`: did not pass because the pre-existing `tests/e2e/registry-members.spec.ts` Member-edit suggestion assertion failed after the Projects test passed.
- Focused `pnpm exec playwright test tests/e2e/registry-members.spec.ts` reproduced the Registry failure at the existing suggestion locator, which is outside Slice 2 files and is not changed in this slice.
- `pnpm verify`: passed with project doctor, lint, typecheck, 44 unit tests, and both production builds.
- `pnpm prisma migrate status`: six migrations found and database schema up to date.

### Regression Verification - 2026-09-16

- `pnpm prisma:generate` and `pnpm prisma:validate`: passed.
- A normal-environment Prisma `member.count()` query returned `4` through the recovered transaction pooler.
- The exact abandoned Slice 2 member and Department fixtures were verified to have no Project or ProjectDepartment references and were deleted in FK-safe order.
- The focused Projects command passed with 16/16 tests.
- An initial Registry-command run reproduced a transient Project interactive-transaction expiration at 5.253 seconds and an Escape assertion failure in the Member Edit dialog.
- A controlled measurement of the existing transaction completed in 2139.6ms, with concurrent Lead and Department lookups at 582.8ms each and nested Project creation at 1158.2ms.
- The complete `pnpm test:e2e` suite then passed with 16/16 tests, including Project creation and the Registry Member Edit Escape path.
- `pnpm verify` passed with project doctor, lint, typecheck, 44 unit tests, and both production builds.

### P3-D03 - Keep recovered database configuration and test limits unchanged

**What gave us a hard time:** A temporary loss of pooler reachability was followed by one interactive Project transaction expiration and one Registry dialog Escape assertion failure.

**Root cause or constraint:** The later successful minimal Prisma query, operation timing measurement, full browser suite, and verification suite showed that neither production code nor connection configuration could be identified as the root cause from the transient failures.

**Options considered:** Change the transaction timeout, change pooler modes, increase Playwright timeouts, alter Registry dialog behavior, or preserve the current configuration while gathering repeatable evidence.

**Final decision:** Preserve the existing transaction timeout, Playwright timeouts, `DATABASE_URL` transaction-pooler mode, `DIRECT_URL` session-pooler mode, and MemberDialog Escape behavior.

**Why it was chosen:** The complete regression suite passed without those changes, while the measured transaction operations completed well below the existing five-second limit.

**Observed result:** The full Playwright suite passed 16/16 and `pnpm verify` passed after connectivity recovered.

**What was learned:** A one-off pooler or interactive-transaction failure requires operation-level measurement and a clean regression run before changing application limits or connection settings.

**Next approach:** If the transaction expiration recurs, capture individual transaction-operation timings and connection-path evidence before considering any configuration change.

**Related files:** `server/projects/projects.service.ts`, `src/features/registry/RegistryPage.tsx`, `tests/e2e/projects.spec.ts`, and `tests/e2e/registry-members.spec.ts`.

### Next Slice

Implement Slice 3 only: `/projects/:projectId`, Project Overview, Lead and Department display, Project status controls, Lead-only status mutation permissions, and direct route/not-found behavior.

Do not begin Phase 4 relationships or workflow structures.

## Slice 3 Delivery - 2026-09-16

### Implemented

- Added the `/projects/:projectId` Project Overview backed by the existing protected Project-detail API.
- Added Project Lead, creator, associated Department, status, timeline, and `doneAt` presentation.
- Added Lead-only Project status changes with server authorization and persisted status history.
- Added controlled nonexistent and invalid Project-route states.
- Preserved the existing active-member guard, direct query implementation, Registry behavior, connection configuration, and timeouts.
- Renamed the focused E2E fixture run identifier from `phase3-slice2-` to `phase3-slice3-`.
- Separated React Query list and detail keys as `['projects', 'list']` and `['projects', 'detail', projectId]` so a successful status mutation invalidates only the list.

### P3-D04 - Treat the direct-detail loading report as transient unless it reproduces under Playwright ownership

**What gave us a hard time:** A prior direct `/projects/:projectId` browser loading report was observed while an independently started development API already occupied port 3001.

**Root cause or constraint:** The isolated diagnostic against that manually running API returned 200 and rendered the Project, but it did not prove the normal Playwright-owned API lifecycle.

**Options considered:** Change database or timeout configuration, add an HTTP timeout, attribute the failure to Prisma, or reproduce under Playwright's isolated API process first.

**Final decision:** Stop the confirmed repository development API, leave `playwright.config.ts` with API `reuseExistingServer: false`, and run the focused suite under Playwright ownership before changing production code.

**Why it was chosen:** The request path must establish an actual stalled boundary before a connection, authentication, Prisma, or response-handling cause can be claimed.

**Observed result:** The focused Projects suite passed 5/5 under a Playwright-owned API, including direct Project loads, status persistence, authorization denial, refresh, and controlled not-found behavior.

**What was learned:** A port conflict can invalidate the intended E2E lifecycle, but it is not evidence that the Project detail request or database path is defective.

**Next approach:** If the symptom recurs under a Playwright-owned API, add temporary boundary timing around guard, Auth, Member lookup, controller, Project query, and response handling, then remove it after identifying the last completed boundary.

**Related files:** `playwright.config.ts`, `tests/e2e/projects.spec.ts`, `server/auth/`, and `server/projects/`.

### Verification

- The initially occupied port 3001 was confirmed as a repository `pnpm dev:api` watch process and was stopped before focused E2E.
- `pnpm exec playwright test tests/e2e/projects.spec.ts`: passed 5/5 under Playwright-owned API lifecycle.
- The direct-detail hang did not reproduce and no root cause or production fix was claimed.
- The focused test assertion for Project Lead display was scoped to the Project ownership card because the intentional fixture uses the same Member as both creator and Lead.
- `pnpm exec playwright test tests/e2e/auth-shell.spec.ts -g "non-admin Project Lead cannot see or open Registry"`: passed 1/1.
- `pnpm test:e2e`: passed 20/20.
- `pnpm prisma migrate status`: six migrations found and database schema up to date.
- `pnpm verify`: passed with project doctor, lint warning only, typecheck, 54 unit tests, and both production builds.

### Phase 3 Exit

Phase 3 is formally complete.

F3-16 through F3-26 are browser-verified by `tests/e2e/projects.spec.ts` against real authenticated routes, persistence, and status API authorization.

F2-21 is verified separately with a persisted non-admin Project Lead fixture.

Phase 4 is unblocked but has not been started.
