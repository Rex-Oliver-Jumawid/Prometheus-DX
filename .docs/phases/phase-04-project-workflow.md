# Phase 4 - Project Workflow Structure

## Status

In progress.

Slice 1 - Persistence and backend Stage/Outcome foundation is complete and verified.

Slice 2 - Project Workspace Stage and Outcome UI is complete and verified.

Slice 3 - Outcome joining and derived Project Membership is complete and verified.

Slice 4 - Project Member access management is active.

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
- `CAN_EDIT` grants no Stage, Outcome, or access-management authority.

## Slice Plan

1. Add canonical persistence, Stage/Outcome APIs, contracts, focused service tests, and migration verification.
2. Add the Project Workspace Stage/Outcome UI and focused browser verification.
3. Add Outcome joining, derived Project Membership, Participating behavior, and focused verification.
4. Add Project Members access management, integrate `CAN_EDIT` status authority, run full Phase 4 acceptance and previous-phase regression, and close the phase.

No later slice starts while the current slice has a known blocker.

## Persistence Plan

Add `ProjectMember`, `ProjectMemberAccessHistory`, `Stage`, `Outcome`, `OutcomeDepartment`, `OutcomeMember`, `OutcomeDependency`, and `AcceptanceCriterion` with canonical foreign keys, unique constraints, deterministic positions, and indexes.

Persist Outcome lifecycle as `OPEN`, `NEEDS_REVISION`, or `ACCEPTED`.

Treat dependency lock and `FOR_REVIEW` as derived conditions rather than lifecycle enum values.

Keep Outcome Membership permanent by omitting leave and removal fields and APIs.

Use a transaction for the first Outcome join so Outcome Membership and the missing default `CAN_VIEW` Project Membership succeed or fail together.

## Slice 1 Result

Migration `20260916040000_phase_04_project_workflow` added the canonical Phase 4 entities, enums, relationships, ordering constraints, membership uniqueness, dependency self-edge check, and a PostgreSQL trigger that rejects cross-Project dependencies.

The project-scoped workflow API now supports listing workflow structure, Stage creation and editing, Outcome creation and editing, and direct Outcome reads.

All workflow reads remain company-visible to active authorized Members through the existing authentication guard.

All Stage and Outcome mutations compare the authenticated Member against the persisted Project Lead relationship.

F4-01 through F4-05 and F4-07 through F4-12 have focused service-level coverage at this stage.

Slice 1 verification:

- `pnpm prisma:generate`: passed.
- `pnpm prisma:validate`: passed.
- `pnpm test`: 71/71 passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with one pre-existing Registry hook warning and no errors.
- `pnpm prisma migrate status`: seven migrations found and database schema up to date.

## Slice 2 Result

The Phase 3 Project Overview now extends into a production Project Workspace without removing project identity, ownership, Departments, status, timestamps, direct Project routing, or controlled not-found behavior.

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

The server checks only the canonical accepted lifecycle closure, so locked, review-conditioned, and `NEEDS_REVISION` Outcomes remain joinable without inventing Phase 5 state.

Joining uses one transaction with idempotent `OutcomeMember` and `ProjectMember` upserts.

The first join creates default `CAN_VIEW` Project Membership and later joins never duplicate it.

No Leave UI exists, and the explicit removal endpoint returns forbidden even when the caller is the Project Lead.

Project list responses now derive participation from persisted Project Membership for the current Member.

Participating excludes Projects the current Member leads, and creator history alone does not classify participation.

Slice 3 verification:

- Unit tests: 77/77 passed.
- Focused Slice 3 Playwright: 5/5 passed, covering F4-14 through F4-27.
- Typecheck: passed.
- Lint: passed with one pre-existing Registry hook warning and no errors.
- Direct-route join, reload persistence, duplicate join, multiple Outcomes, permanent membership, accepted denial, and Leading/Participating classification passed against PostgreSQL.

## Verification Strategy

Each slice receives focused unit or service verification first, then the required browser coverage for that slice.

The final gate includes every F4 case, the canonical main E2E flow, previous-phase regression including F2-21, full Playwright, migration status, and `pnpm verify`.

Browser verification must also cover refresh, direct routing, Back/Forward, loading and empty states, controlled errors, keyboard behavior, narrow viewport layout, duplicate submission protection, persistence, and console cleanliness.

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

Implementation is pending in Slice 1.

#### What we learned

Acceptance language describing a visible condition does not necessarily imply a stored lifecycle value.

#### Next approach

Model canonical source records first, then derive UI and authorization conditions from them.

#### Related changes

- `.context/data-model.md`
- `.context/user-flows.md`
- `.testcases/phase-04-project-workflow-tests.md`

### P4-D02 - Use the live Figma Outcome Workspace as a visual reference only

**Status:** Accepted

**Area:** Frontend

**Impact:** Medium

#### What gave us a hard time

The configured Figma node includes an Outcome work area with Phase 5 features and tasks while Phase 4 must stop at workflow structure and membership.

#### Root cause / constraint

The Figma frame spans a later product state, while the phase plan and canonical domain documents intentionally limit this task.

#### Options considered

1. Implement the full Figma frame including work delivery.
2. Ignore Figma entirely.
3. Reuse its visual language and Phase 4 structure while excluding Phase 5 controls.

#### Proposed solution

Use the Figma node for spacing, typography, card hierarchy, breadcrumb treatment, and Outcome metadata presentation, then follow the phase boundary for functionality.

#### Decision

Adopt option 3.

#### Why we chose it

It honors the requested visual source while preserving phase discipline.

#### Result

The live node `17:4603` in file `8zgQ4pcWtku7rSWzjlP9K9` was inspected before coding.

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

The reviewed migration applied successfully and `prisma migrate status` reports the database schema up to date.

#### What we learned

TCP reachability and pooled application health do not prove that a migration session is currently available.

#### Next approach

Diagnose DNS, TCP, pooled queries, and direct queries separately before changing migration or connection behavior.

#### Related changes

- `prisma/migrations/20260916040000_phase_04_project_workflow/migration.sql`

## Known Limitations

- Phase 4 implementation and verification are not yet complete.
- Review-derived `FOR_REVIEW` behavior cannot be produced through a Phase 4 UI because submissions are Phase 5 scope.

## Technical Debt

None recorded yet.

## Next Action

Implement and verify Slice 4 Project Members UI, Lead-only `CAN_VIEW` and `CAN_EDIT` management, Project status authorization expansion, and authority non-leakage.
