# Phase 5 - Outcome Work, Submission, Review, and Dependencies

## Status

In progress.
Phase 4 remains the completed baseline.
Repository orientation on 2026-09-17 found a clean worktree, 84 passing unit tests, and a valid Prisma schema.

## Objective

Deliver the complete Outcome Member work, shared submission, Lead review, revision, acceptance, reopening, and dependency lifecycle without implementing Phase 6.

## Slice Plan

1. Outcome work area with persisted Features, Tasks, editing, completion, planning while locked, and derived work progress.
2. Persisted output drafts and append-only shared submissions with attribution, parallel review entries, and submission details.
3. Lead review, criterion verification, revision requests, resubmission, and explicit revision resolution.
4. Transactional Outcome acceptance, member credit snapshots, reopening, preserved history, and dependency decisions.
5. Full acceptance coverage, Phases 1-4 regression, visual verification, and formal closure.

## Scope Delivered

Orientation and baseline unit/schema verification are complete.
Slice 1 is implemented and verified through six focused browser tests.
Features and Tasks support creation, editing, deletion, completion/reopening, derived progress, collapse/expand, and membership-gated actions.
Locked Outcomes allow planning but deny execution; accepted Outcomes deny all work mutations.
Slice 2 passed four focused browser tests for saved drafts, attributed shared history, parallel pending entries, and retry idempotency.
Slices 3 and 4 passed an eleven-test delivery suite including Lead-only decisions, revision, resubmission, criteria verification, Outcome acceptance, all-member credit, reopening, and repeated acceptance.
The expanded twelve-test delivery run additionally verifies individual review while other submissions remain pending.
The initial distinct-account core suite passed 18/18 checks, including real Supabase sign-in, Registry authorization, the full revision path, direct acceptance, dependency unlock/relock, and preserved overrides.
Additional race, stale-history, read-state, and visual checks are being verified before final regression.

## Architecture and Data-Flow Changes

Added Outcome work and delivery services with project-scoped routes behind the existing authentication guard.
React Query remains the owner of client server-state caching.
Outcome Membership alone grants member work capabilities, subject to lifecycle and dependency conditions.
Persisted Project Lead identity alone grants review authority.
Project and Stage progress derive from currently accepted Outcomes, while work progress derives from completed Tasks and accepted Outcomes display 100 percent.
Project status remains independent from acceptance progress.

### UI and prototype reconciliation

Used `.model/finalmodel.html` as the interaction reference and inspected the connected Figma helper screenshot.
Preserved the completed Phase 4 Project and Outcome navigation, metadata, and authorization surfaces.
Added the prototype's Feature composer, expandable Feature cards, Task controls, top/bottom Feature actions, saved Output draft, shared versioned history, submission detail overlay, combined review overlay, verification checklist, feedback, and recent/all activity controls.
Added explicit acceptance/reopening history and per-edge dependency decisions required by the canonical records.
React Hook Form owns editor intent and TanStack Query owns server state; no prototype mock state or local-storage business data was copied.
The browser skill's in-app runtime is unavailable in this environment, so repository Playwright and inspected screenshots provide browser-level interaction and visual verification.

## Database Changes

Applied migrations `20260917000000_phase_05_outcome_work` and `20260917000100_phase_05_work_integrity`.
They add ordered Features and Tasks, completion metadata, foreign keys, uniqueness, nonblank-title/completion constraints, and RLS/client-grant protection.
Prisma generation/validation pass and migration status reports nine applied migrations.
Subsequent migrations `20260917000200` through `20260917000500` add submission/draft/activity and review/revision/acceptance/credit records with their security and integrity constraints.
Thirteen migrations are applied and Prisma generation and validation pass.
A read-only database catalog check confirms all ten new tables enable RLS and deny direct `anon` and `authenticated` table privileges.
The current-acceptance partial unique index is present.
Schema drift inspection shows only the pre-existing `updated_at` defaults on `members` and `departments`, originating in the Phase 1 and Phase 2 migrations and absent from the earlier Prisma model.
Phase 5 introduces no table/column drift.
Implemented entities include Feature, Task, OutcomeSubmission, SubmissionReview, OutcomeRevisionRequest, OutcomeAcceptance, OutcomeAcceptanceMember, and ActivityLog.
Reconciled prototype output content, private saved drafts, and persisted criterion verification in the canonical data model before implementation.
Attachment upload remains Phase 9; Phase 5 output content supports the prototype's output name or link.

## API Changes

The project-scoped `/projects/:projectId/outcomes/:outcomeId/work` API delivers work reads, Feature/Task create/edit/delete, and Task state changes.
The sibling `/delivery` API delivers shared history, private output drafts, submission creation, saved Lead review preparation, individual submission review, revision request/resolution, acceptance, reopening, and per-edge dependency overrides.

## Security and Authorization

Preserve separate workspace role, Project Lead, Project Member access, and Outcome Membership checks.
Serialize membership, work, submission, and acceptance transitions where needed to protect accepted-state closure and complete member-credit snapshots.
Keep browser database access closed for new business tables through RLS and revoked client grants.

## Environment and Configuration

No environment changes.
Do not print credentials or send invitations during automated fixture setup.

## Testing and Acceptance Result

Baseline checks run during orientation:

- `pnpm test`: 84/84 passed across 13 files.
- `pnpm prisma:validate`: passed.

The full Phase 5 acceptance gate remains in progress.
Slice 1 focused browser verification: 6/6 passed.
The latest `pnpm verify` passed with 106/106 tests across 16 files, typecheck, lint, and both production builds.
Phase 4's recorded 35/35 E2E result is prior evidence, not a newly executed result.

### Acceptance coverage index

The following mappings identify executable checks; final PASS status is contingent on the complete regression run below.

| Acceptance IDs | Executable evidence |
| --- | --- |
| F5-01, F5-03, F5-08 | Work slice create/validation; Core 05-06 |
| F5-02 | Work slice nonjoined viewer, Administrator, CAN_EDIT, and nonjoined Lead |
| F5-04 | Work slice Task editing and refresh |
| F5-05, F5-06 | Work slice completion/reopening with persisted progress |
| F5-07 | Work slice stale-write rejection; Core 08b distinct-member concurrent work |
| F5-09, F5-12, F5-13 | Delivery attributed submission/history refresh; Core 07 |
| F5-10, F5-11 | Delivery nonmember and missing-content API rejection |
| F5-14, F5-15, F5-16 | Delivery parallel requests, deterministic history, rapid double-click/idempotency; Core 08-09 |
| F5-17, F5-20, F5-21, F5-22 | Delivery combined review/revision/resubmission; Core 07-10 |
| F5-18, F5-19 | Delivery non-Lead Administrator and CAN_EDIT API denial; service authorization matrix |
| F5-23 | Core 08 new distinct Member joins during revision |
| F5-24, F5-25 | Delivery acceptance/member snapshots; Core 10-11 and 20 |
| F5-26, F5-27 | Delivery accepted work/submission closure; Core 11 new Member join rejection |
| F5-28, F5-29, F5-30, F5-31 | Delivery reopening preserves members, submissions, and prior acceptance |
| F5-32 | Core 17 new Member joins reopened Outcome |
| F5-33, F5-34 | Delivery resubmission and second acceptance; Core 17 expanded credit |
| F5-35, F5-36, F5-37 | Work planning/execution lock tests; Core 12 locked membership and submission denial |
| F5-38, F5-39 | Core 13-14 acceptance unlock, refresh, and prerequisite reopen |
| F5-40 | Delivery/Core 15 non-Lead override denial and Lead edge override |

Additional checks cover deletion audit events, stale private drafts, saved review preparation, stale combined reviews, explicit revision resolution, accepted-dependent preservation, acceptance/join races, background form refresh, loading/error/retry states, invalid direct routes, Back/Forward, mobile/desktop screenshots, and derived Project/Stage progress.

## Decision & Challenge Log

### P5-D01 - Prerequisite reopening policy needs a product decision

**Status:** Accepted
**Area:** Product and Database
**Impact:** High

#### What gave us a hard time

The requested dependency/reopening lifecycle includes behavior explicitly deferred by the canonical data model.

#### Root cause / constraint

Sections 17 and 47 of `.context/data-model.md` leave automatic relocking after prerequisite reopening unresolved.
The prototype unlocks dependents when accepted but does not establish a canonical reopening policy.

#### Options considered

1. Relock unfinished dependent Outcomes when a prerequisite is reopened, preserving explicit Lead overrides and accepted dependent Outcomes.
2. Keep previously unlocked dependents unlocked, requiring persistent evidence of prior dependency resolution.

#### Proposed solution

Recommend option 1 because it derives readiness from current prerequisite acceptance and existing override records.
Planning and joining remain available while locked; task execution and submission pause.
Already accepted dependent Outcomes retain their acceptance and credit history.
Explicit Lead overrides remain effective for their individual dependency edges.

#### Decision

Presented option 1 as the recommended rule, then continued with it following the user's instruction to continue.
Recorded the resulting semantics in the canonical data model.

#### Result

The rule is implemented from current prerequisite acceptance and per-edge override records.
The distinct-user dependency browser checks are in progress.

#### What we learned

Existing Phase 4 derived lock code does not settle a product decision that the canonical source explicitly deferred.

#### Next approach

Keep explicit regression for reopening, accepted dependents, and per-edge overrides.

#### Related changes

- `.context/data-model.md`, sections 17 and 47.
- `.model/finalmodel.html`, `canPlan`, `canExecute`, `acceptOutput`, and `skipPrerequisite`.
- `.testcases/phase-05-work-review-tests.md`, F5-28 through F5-40.

### P5-D02 - Serialize lifecycle decisions with membership and work

**Status:** Implemented
**Area:** Database and authorization
**Impact:** High

#### Constraint and options

Acceptance must snapshot every current member and prevent concurrent joins or submissions from crossing the accepted-state boundary.
Separate frontend checks or independent database reads cannot protect this invariant.
Considered duplicated lock fields and transaction isolation retries; selected a shared Project row lock inside short Prisma transactions.

#### Decision and result

Structure edits, joining, work mutations, submission, and Lead decisions serialize on the same Project record.
The acceptance transaction writes the acceptance, member-credit snapshot, lifecycle, pending reviews, revision resolution, and audit event together.
A partial unique database index allows only one current acceptance per Outcome.
Focused delivery tests verify closure, repeated acceptance rejection, all-member credit, and preserved reopening history.
Distinct-account acceptance/join race verification is part of the final gate.

#### Lessons and next approach

Authorization relationships remain independent of workspace role and CAN_EDIT.
Future mutations affecting these invariants must take the same lock before reading state.
Related files: `outcome-delivery.service.ts`, `outcome-work.service.ts`, `project-workflow.service.ts`, and the Phase 5 integrity migrations.

### P5-D03 - Preserve evidence and reject stale writes

**Status:** Implemented
**Area:** UI, API, and persistence
**Impact:** High

#### Constraint and options

Shared submissions can arrive while a Lead reviews, and another browser window can edit a private draft or Task.
Blind upserts or resetting forms on every query refresh would silently overwrite or discard work.

#### Decision and result

Submission request UUIDs provide database-backed idempotency with content matching on retries.
Work and draft writes require the version originally loaded by the editor.
Final review decisions require the reviewed Outcome version and exact shared submission ID set.
Acceptance stores immutable criterion and member snapshots; submitting new evidence invalidates saved criterion checks without clearing revision state.
Forms preserve unsaved text across background query refreshes and clear only after their own successful submission.

#### Lessons and next approach

React Query cache updates are not permission or concurrency authority.
Capture editor versions, not the newest background cache version, when protecting a user's in-progress intent.
Related files: Phase 5 shared contracts, `OutcomeDeliveryPanel.tsx`, `OutcomeReviewDialog.tsx`, and work/delivery tests.

### P5-D04 - Browser tests must follow real asynchronous boundaries

**Status:** Implemented
**Area:** Testing and UI
**Impact:** Medium

#### Reproduction and root cause

Direct Outcome routes load Project, workflow, work, and delivery data in sequence.
Early assertions mistook an in-flight dependent request for an empty state.
Task checkboxes also reverted immediately while awaiting a server-confirmed value, and validation text changed a form label's accessible name.

#### Options and decision

Kept existing timeouts and assertions intact in intent.
Tests await the relevant request before checking resulting UI state.
Task controls retain transient pending intent, then reconcile with server data or revert on failure.
Explicit accessible names keep labels stable while validation feedback appears.

#### Result and next approach

The six-test work slice and eleven-test initial delivery slice pass.
The first distinct-user core run encountered an API 500 during workflow navigation; the same path passed on immediate rerun without a server behavior change.
Final full regression must remain clean, and any recurring backend error must be captured and diagnosed.
Use isolated real Supabase Auth identities and Registry authorization for the core path rather than treating one Administrator session as different users.

## Known Limitations

Phase 5 is incomplete.
The dependency reopening policy and lifecycle are implemented; final acceptance verification is pending.

## Technical Debt

Phase 4 records an existing Registry hook warning and a production bundle-size advisory.
Both remain non-blocking warnings; Vite also reports its existing CJS API deprecation.
The inherited Member/Department timestamp-default schema mismatch is recorded above rather than changing completed-phase persistence as part of this work.
Shared history and activity currently load the full Outcome record; future pagination should preserve chronological versions and combined-review snapshot checks.

## Lessons from the Phase

The prototype distinguishes planning from execution while locked.
Canonical rules override prototype permission shortcuts and its revision-clearing behavior.
New submissions must not automatically clear NEEDS_REVISION.

## Recommendations / Next Approach

Verify each complete slice before starting the next.
Preserve the Phase 4 baseline and run the complete core browser workflow before closure.

## Phase Exit Result

Not complete.
The repository is not yet ready to begin Phase 6.
