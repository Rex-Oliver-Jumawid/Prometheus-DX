# Phase 4 - Project Workflow Structure

## Status

Complete.

Slice 1 - Persistence and backend Stage/Outcome foundation is complete and verified.

Slice 2 - Project Workspace Stage and Outcome UI is complete and verified.

Slice 3 - Outcome joining and derived Project Membership is complete and verified.

Slice 4 - Project Member access management is complete and verified.

Phase 4 formally exited on 2026-09-16 after the complete browser, database, unit, typecheck, lint, and production-build gates passed.

## Objective

Implement Stages, Outcomes, Outcome Membership, derived Project Membership, Project Member access, the Project Workspace, and persisted Participating classification without introducing Phase 5 work-delivery behavior.

## Canonical Scope

- Project-owned ordered Stages.
- Stage-owned ordered Outcomes.
- Outcome responsible Departments.
- Ordered Acceptance Criteria.
- Same-Project Outcome prerequisites.
- Permanent Outcome Membership.
- Derived Project Membership with `CAN_VIEW` and `CAN_EDIT` access.
- Project Workspace Stage, Outcome, membership, and member-access interfaces.
- Participating projects derived from Project Membership and distinct from Leading.

Features, Tasks, submissions, review actions, acceptance transitions, reopening, and work-delivery logic remain Phase 5 scope.

## Authorization Model

- Every active authorized Prometheus Member may read every Project workflow.
- Only the persisted Project Lead may create or manage Stages and Outcomes.
- Administrator role and Project creator history do not grant Project Lead authority.
- Any active authorized Member may join a non-accepted Outcome.
- Outcome Membership cannot be left or removed.
- Joining an Outcome creates the missing Project Membership atomically with default `CAN_VIEW` access.
- Only the persisted Project Lead may change Project Member access.
- Project Lead or a Project Member with `CAN_EDIT` may change Project status.
- `CAN_EDIT` grants no Stage, Outcome, Project Member access-management, Registry, or Project Lead authority.

## Slice Plan

1. Add canonical persistence, Stage/Outcome APIs, contracts, focused service tests, and migration verification.
2. Add the Project Workspace Stage/Outcome UI and focused browser verification.
3. Add Outcome joining, derived Project Membership, Participating behavior, and focused verification.
4. Add Project Members access management, integrate `CAN_EDIT` status authority, run full Phase 4 acceptance and previous-phase regression, and close the phase.

All four slices are complete.

## Persistence Plan

Phase 4 added `ProjectMember`, `ProjectMemberAccessHistory`, `Stage`, `Outcome`, `OutcomeDepartment`, `OutcomeMember`, `OutcomeDependency`, and `AcceptanceCriterion` with canonical foreign keys, unique constraints, deterministic positions, and indexes.

Outcome lifecycle is persisted as `OPEN`, `NEEDS_REVISION`, or `ACCEPTED`.

Dependency lock and `FOR_REVIEW` remain derived conditions rather than persisted lifecycle enum values.

Outcome Membership remains permanent by omitting normal leave and removal behavior.

The first Outcome join uses one transaction so Outcome Membership and any missing default `CAN_VIEW` Project Membership succeed or fail together.

## Slice 1 Result

Migration `20260916040000_phase_04_project_workflow` added the canonical Phase 4 entities, enums, relationships, ordering constraints, membership uniqueness, dependency self-edge check, and a PostgreSQL trigger that rejects cross-Project dependencies.

The project-scoped workflow API supports listing workflow structure, Stage creation and editing, Outcome creation and editing, and direct Outcome reads.

All workflow reads remain company-visible to active authorized Members through the existing authentication guard.

All Stage and Outcome mutations compare the authenticated Member against the persisted Project Lead relationship.

F4-01 through F4-05 and F4-07 through F4-12 received focused service-level coverage before browser verification.

Slice 1 verification:

- `pnpm prisma:generate`: passed.
- `pnpm prisma:validate`: passed.
- `pnpm test`: 71/71 passed at the Slice 1 checkpoint.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with one pre-existing Registry hook warning and no errors.
- `pnpm prisma migrate status`: seven migrations found and database schema up to date.

## Slice 2 Result

The Phase 3 Project Overview extends into a production Project Workspace without removing project identity, ownership, Departments, status, timestamps, direct Project routing, or controlled not-found behavior.

The workspace provides ordered Stage columns, Outcome cards, Add/Edit Stage dialogs, Add/Edit Outcome dialogs, a dynamic Acceptance Criteria builder, persisted Department and prerequisite selection, and direct Outcome detail routes.

Project Lead controls are derived from the authenticated workflow response.

Non-Leads retain readable workflow structure while direct forged Stage and Outcome mutations return forbidden responses.

The live Figma Outcome Workspace informed card hierarchy, typography, metadata layout, breadcrumbs, muted glass surfaces, and Outcome details while Phase 5 controls remained excluded.

Slice 2 verification:

- Focused Phase 4 Playwright: 6/6 passed, covering F4-01 through F4-13.
- Existing Phase 3 Projects Playwright regression: 5/5 passed.
- Typecheck: passed.
- Lint: passed with one pre-existing Registry hook warning and no errors.
- Refresh, direct Outcome routing, Back/Forward, invalid-then-valid forms, duplicate submission, API bypass denial, and 390px overflow checks passed.

## Slice 3 Result

Authenticated active Members can join non-accepted Outcomes from the direct Outcome details interface.

The server checks only the canonical accepted lifecycle closure, so locked, review-conditioned, and `NEEDS_REVISION` Outcomes remain joinable without inventing Phase 5 lifecycle state.

Joining uses one transaction with idempotent `OutcomeMember` and `ProjectMember` upserts.

The first join creates default `CAN_VIEW` Project Membership and later joins never duplicate it.

No Leave UI exists, and the explicit removal endpoint returns forbidden even when the caller is the Project Lead.

Project list responses derive participation from persisted Project Membership for the current Member.

Participating excludes Projects the current Member leads, and creator history alone does not classify participation.

Slice 3 verification:

- Unit tests: 77/77 passed at the Slice 3 checkpoint.
- Focused Slice 3 Playwright: 5/5 passed, covering F4-14 through F4-27.
- Typecheck: passed.
- Lint: passed with one pre-existing Registry hook warning and no errors.
- Direct-route join, reload persistence, duplicate join, multiple Outcomes, permanent membership, accepted denial, and Leading/Participating classification passed against PostgreSQL.

## Slice 4 Result

The Project Workspace now includes a Project Members panel backed by persisted derived Project Membership.

Project Member rows show the Member identity, joined Outcomes, and current project access level.

Only the persisted Project Lead receives editable `CAN_VIEW` / `CAN_EDIT` controls.

Project Member access changes persist and create `ProjectMemberAccessHistory` entries.

Project status authorization now permits the Project Lead or a Project Member with `CAN_EDIT` to change Project status.

A Project Member with `CAN_VIEW` remains unable to change Project status.

`CAN_EDIT` remains intentionally narrow and does not grant Stage creation/editing, Outcome creation/editing, Project Member access management, Registry access, or Project Lead identity.

Administrator status alone does not grant project-specific authority.

Slice 4 and final Phase 4 browser verification covered F4-28 through F4-36 plus the canonical main Phase 4 end-to-end flow.

## Scope Delivered

Phase 4 delivered the complete Project Workflow Structure scope:

- Ordered persistent Stages.
- Ordered persistent Outcomes.
- Outcome Departments.
- Acceptance Criteria.
- Same-Project prerequisites with database enforcement against invalid cross-Project dependency edges.
- Project Workspace UI.
- Direct Outcome routes.
- Permanent Outcome Membership.
- Derived Project Membership.
- Default `CAN_VIEW` access.
- Lead-managed `CAN_EDIT` access.
- Participating classification based on membership.
- Project Members UI.
- Project Member access history.
- `CAN_EDIT` Project-status authority without Project Lead authority leakage.

No Phase 5 Feature, Task, Submission, Review, Revision, Acceptance, or Reopening workflow was implemented.

## Architecture and Data-Flow Changes

The Phase 4 vertical flow is:

```text
Project Workspace
-> Stage / Outcome API
-> Supabase authentication guard
-> persisted Project Lead authorization
-> Prisma workflow persistence
-> React Query refresh
-> Project Workspace state
```

Outcome joining uses:

```text
Join Outcome
-> authenticated join API
-> canonical join eligibility check
-> transaction
-> OutcomeMember upsert
-> ProjectMember upsert with default CAN_VIEW
-> refreshed Outcome / Projects state
```

Project access management uses:

```text
Project Members UI
-> Lead-only access PATCH
-> ProjectMember update
-> ProjectMemberAccessHistory insert
-> Project detail/list/member query invalidation
```

## Database Changes

Migration `20260916040000_phase_04_project_workflow` is the only Phase 4 migration.

At Phase exit, `pnpm prisma migrate status` reported seven migrations and the database schema up to date.

No additional Slice 4 migration was required because the Slice 1 schema already contained Project Member access and access-history persistence.

## API Changes

Phase 4 introduced project-scoped workflow and membership behavior including:

- Workflow reads.
- Stage create/edit.
- Outcome create/edit/read.
- Outcome join.
- Explicit rejection of Outcome Member removal.
- Project Members read.
- Project Member access update.

The existing Project status endpoint was expanded so a persisted `CAN_EDIT` Project Member can change Project status without inheriting Project Lead-only permissions.

## Security and Authorization

Final authorization rules were browser- and API-verified:

- Stage mutation is Project Lead-only.
- Outcome mutation is Project Lead-only.
- Project Member access management is Project Lead-only.
- Outcome Membership is permanent.
- `CAN_EDIT` may change Project status only.
- `CAN_VIEW` cannot change Project status.
- `CAN_EDIT` cannot create Stages or Outcomes or manage access.
- Administrator status alone does not override Project relationships.
- Project creation history alone grants no project authority.
- Project Lead status still grants no Registry authority.

## Environment and Configuration Changes

No production timeout, Supabase connection, authentication, or Playwright configuration change was required for Phase 4 closure.

The existing one-worker E2E behavior for the shared credential remained in place.

## Testing and Acceptance Result

Final verification on 2026-09-16:

- `pnpm test:e2e`: 35/35 passed using one Chromium worker.
- F2-21 passed as part of the full suite.
- Outcome Membership acceptance tests passed.
- Project Member access tests passed.
- The canonical Phase 4 main E2E flow passed.
- Project Workflow Stage/Outcome tests passed.
- Phase 3 Projects regression passed.
- Registry Department and Member regressions passed.
- `pnpm prisma migrate status`: seven migrations found; database schema up to date.
- `pnpm verify`: passed.
- `pnpm lint`: zero errors, one pre-existing `RegistryPage.tsx` hook-dependency warning.
- `pnpm typecheck`: passed.
- `pnpm test`: 84/84 passed across 13 test files.
- `pnpm build:web`: passed.
- `pnpm build:api`: passed.

The Vite production build emitted its existing chunk-size advisory because the generated JavaScript bundle exceeds 500 kB after minification. This is a build optimization note rather than a Phase 4 correctness failure.

## Verification Strategy

Each slice received focused unit or service verification first, then the required browser coverage for that slice.

The final gate included every F4 case, the canonical main E2E flow, previous-phase regression including F2-21, full Playwright, migration status, and `pnpm verify`.

## Decision & Challenge Log

### P4-D01 - Keep Outcome lifecycle separate from derived workflow conditions

**Status:** Accepted

**Area:** Database and Product

**Impact:** High

#### What gave us a hard time

Phase 4 acceptance language refers to locked and `FOR_REVIEW` Outcomes even though Phase 5 owns submissions and review transitions.

#### Root cause / constraint

The canonical data model explicitly separates lifecycle state from dependency and review conditions.

#### Options considered

1. Add `LOCKED` and `FOR_REVIEW` to the Outcome lifecycle enum.
2. Persist only canonical lifecycle values and expose lock or review as derived conditions.
3. Defer all non-open join verification to Phase 5.

#### Proposed solution

Persist only `OPEN`, `NEEDS_REVISION`, and `ACCEPTED`, model dependency edges now, and avoid inventing Phase 5 submission state.

#### Decision

Use the canonical lifecycle enum and keep dependency lock and review status derived.

#### Why we chose it

This preserves the data-model boundary and prevents Phase 4 from encoding Phase 5 behavior prematurely.

#### Result

The Phase 4 schema persists only the canonical Outcome lifecycle values while dependency and review-related conditions remain derived. The Phase 4 acceptance suite verifies join eligibility without introducing Phase 5 submission state.

#### What we learned

Acceptance language describing a visible condition does not necessarily imply a stored lifecycle value.

#### Next approach

Model canonical source records first, then derive UI and authorization conditions from them.

#### Related changes

- `.context/data-model.md`
- `.context/user-flows.md`
- `.testcases/phase-04-project-workflow-tests.md`
- `prisma/migrations/20260916040000_phase_04_project_workflow/migration.sql`

### P4-D02 - Use the live Figma Outcome Workspace as a visual reference only

**Status:** Accepted

**Area:** Frontend

**Impact:** Medium

#### What gave us a hard time

The configured Figma node includes an Outcome work area with Phase 5 features and tasks while Phase 4 had to stop at workflow structure and membership.

#### Root cause / constraint

The Figma frame spans a later product state, while the phase plan and canonical domain documents intentionally limit Phase 4.

#### Options considered

1. Implement the full Figma frame including work delivery.
2. Ignore Figma entirely.
3. Reuse its visual language and Phase 4 structure while excluding Phase 5 controls.

#### Proposed solution

Use the Figma node for spacing, typography, card hierarchy, breadcrumb treatment, and Outcome metadata presentation, then follow the phase boundary for functionality.

#### Decision

Adopt option 3.

#### Why we chose it

It honors the visual source while preserving phase discipline.

#### Result

The live node `17:4603` in file `8zgQ4pcWtku7rSWzjlP9K9` informed the Phase 4 UI while Phase 5 controls remained excluded.

#### What we learned

Design context can guide visual fidelity without broadening functional scope.

#### Next approach

Map Figma patterns onto existing project tokens and components rather than copying generated reference code.

#### Related changes

- `.context/ui-reference.md`
- `.model/finalmodel.html`
- Figma node `17:4603`

### P4-D03 - Preserve the dedicated migration connection after transient failures

**Status:** Resolved

**Area:** Infrastructure

**Impact:** Medium

#### What gave us a hard time

The Supabase direct endpoint intermittently returned Prisma `P1001` while both configured ports accepted TCP connections and the pooled application connection remained healthy.

#### Root cause / constraint

The failure was isolated to transient direct-session availability rather than migration SQL, schema validation, DNS, or application database access.

#### Options considered

1. Change database connection configuration.
2. Increase timeouts.
3. Verify each boundary and retry only after a successful direct read.

#### Proposed solution

Keep the canonical connection configuration unchanged and retry deployment only after a direct read-only Prisma query succeeds.

#### Decision

Use option 3.

#### Why we chose it

There was no repeatable evidence requiring a production connection change.

#### Result

The reviewed migration applied successfully and final `prisma migrate status` reports seven migrations with the database schema up to date.

#### What we learned

TCP reachability and pooled application health do not prove that a migration session is currently available.

#### Next approach

Diagnose DNS, TCP, pooled queries, and direct queries separately before changing migration or connection behavior.

#### Related changes

- `prisma/migrations/20260916040000_phase_04_project_workflow/migration.sql`

## Known Limitations

- Phase 4 intentionally does not implement submission-derived `FOR_REVIEW` behavior because submissions and review transitions belong to Phase 5.
- The production web build currently emits a chunk-size advisory for a JavaScript bundle larger than 500 kB after minification. It does not block the build or Phase 4 behavior.

Neither limitation blocks Phase 4 completion.

## Technical Debt

- The existing `RegistryPage.tsx` React Hook dependency warning remains. It predates Phase 4 and produced no regression in the 35/35 browser suite.
- Future bundle code-splitting may be worthwhile before the application grows substantially beyond the current core workflow.

## Lessons from the Phase

- Keep project-specific authority independent from workspace role, creator history, and Outcome participation.
- Persist the minimum canonical lifecycle state and derive workflow conditions from source records instead of expanding enums prematurely.
- Create derived Project Membership atomically with the first permanent Outcome Membership.
- Treat access levels as narrow capabilities rather than substitute roles.
- Browser-level direct API bypass tests are necessary whenever UI visibility is used to represent authorization.
- Preserve migration and application database diagnostics as separate boundaries before changing connection configuration.

## Recommendations / Next Approach

Phase 5 should build on the now-stable Outcome and membership model rather than redesigning it.

Before implementing Phase 5:

1. Read the Phase 5 canonical data-model and user-flow sections.
2. Create the Phase 5 journal before substantial coding.
3. Preserve permanent Outcome Membership and the single shared Outcome work history.
4. Add Feature, Task, Submission, Review, Revision, Acceptance, and Reopening behavior only within the Phase 5 boundary.
5. Extend regression from Project workflow structure into the complete create -> join -> work -> submit -> review -> accept loop.

## Phase Exit Result

**PASS - Phase 4 is complete.**

F4-01 through F4-36 are verified and recorded.

The canonical Phase 4 main E2E flow passes.

Previous-phase regression passes, including F2-21 and Phase 3 Projects behavior.

Full Playwright passes 35/35.

The database is current with seven migrations.

`pnpm verify` passes with 84/84 unit tests and both production builds.

No Phase 4 blocker remains.

Phase 5 is unblocked but was not started as part of Phase 4 closure.
