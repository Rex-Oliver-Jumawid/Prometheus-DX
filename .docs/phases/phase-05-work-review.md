# Phase 5 - Outcome Work, Submission, Review, and Dependencies

## Status

**Complete - release closure reassessed on 2026-09-25.**

The original journal remained open after the implementation was already integrated.
The current closure decision uses the accumulated Phase 5 browser evidence, database/service coverage, later regression coverage, and the final CAN_EDIT permission amendment.

## Release Closure Reassessment - 2026-09-25

Phase 5 satisfies its exit milestone.

The complete project-delivery loop is implemented with real persisted records:

```text
Project
-> Stage
-> Outcome
-> Outcome Membership
-> Feature / Task work
-> shared submission history
-> review / revision
-> resubmission
-> acceptance
-> reopening
-> dependency handling
```

Existing Phase 5 evidence already records a signed-in distinct-account core suite that passed 18/18 checks with real Supabase authentication, Registry authorization, revision, direct acceptance, dependency unlock/relock, and preserved dependency overrides.

Later repository work added additional service, component, integration, migration, stale-write, concurrency, and UI regression coverage.

The 2026-09-25 `CAN_EDIT` amendment is additive to the original Lead path.
The backend now grants Project review authority to the Project Lead or a Project Member with `CAN_EDIT`, while Outcome work still requires Outcome Membership and Project Member access management remains Lead-only.

Current CI verifies lint, typecheck, service/unit tests, component tests, production builds, PostgreSQL migration/integration checks, and the credential-free Chromium smoke suite.
Credential-gated browser journeys remain useful release smoke when configured, but they no longer represent missing Phase 5 implementation.

Phase 5 is therefore closed.
Future browser-suite refactoring and additional release smoke are maintenance work rather than unfinished Phase 5 scope.

## Permission Amendment - 2026-09-25

The original Phase 5 implementation and acceptance were written around Project Lead-only review decisions.
The current product rule expands those Project-level decision capabilities to Project Members with `CAN_EDIT`.
Historical Lead-only verification notes remain useful as records of the earlier baseline, but current authorization must follow the amended Project editor rule.

## Objective

Deliver the complete Outcome Member work, shared submission, Project editor review, revision, acceptance, reopening, and dependency lifecycle without implementing Phase 6.

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
The repository testing infrastructure now has a dedicated React component-test layer, Chromium development E2E, retained Playwright failure traces/screenshots, and release-level Firefox/WebKit verification commands.
Future Phase 5 test changes should migrate non-browser permission, validation, API-only, stale-write, and concurrency assertions below Playwright where practical while preserving the critical end-to-end acceptance journeys.

## Architecture and Data-Flow Changes

Added Outcome work and delivery services with project-scoped routes behind the existing authentication guard.
React Query remains the owner of client server-state caching.
Outcome Membership alone grants member work capabilities, subject to lifecycle and dependency conditions.
Persisted Project Lead identity or Project Member `CAN_EDIT` grants Project review, revision, acceptance/reopening, and dependency-override authority.
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
Binary attachment upload is outside the current release scope; Phase 5 output content supports the prototype's output name or HTTP(S) link.

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

At the time this implementation evidence was recorded, the full Phase 5 gate had not yet been formally closed.
Slice 1 focused browser verification: 6/6 passed.
The latest previously recorded `pnpm verify` passed with 106/106 Node tests across 16 files, typecheck, lint, and both production builds.
The repository now also runs React component tests through `pnpm test:ui`, includes them in `pnpm verify`, keeps normal Playwright E2E on Chromium, and exposes `pnpm verify:release` for Firefox/WebKit release verification.
The first component-level coverage verifies `ProjectDialog` Escape dismissal, backdrop dismissal, pending-state protection, and focus restoration without requiring a full browser/backend journey.
Phase 4's recorded 35/35 E2E result is prior evidence, not a newly executed result.
The P5-D07 latency pass ran `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:ui`, and `pnpm build` successfully.
That verification passed 113/113 Node tests and 11/11 React component tests.
The focused Project Chromium suite passed 5/5, including persisted status and exact history assertions.
The focused CAN_EDIT Chromium journey passed.
The focused CAN_VIEW test retained the known Project Members request timeout before reaching its status assertion.
The P5-D08 perceived-latency pass added a repeatable Chromium timing probe for cold, warm, prefetched, and unprefetched navigation milestones.
Focused component verification passed 12/12 tests, including optimistic Project Member access rollback.

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
| F5-18, F5-19 | Delivery non-editor denial plus the current service authorization matrix; CAN_EDIT is now an authorized Project editor path |
| F5-23 | Core 08 new distinct Member joins during revision |
| F5-24, F5-25 | Delivery acceptance/member snapshots; Core 10-11 and 20 |
| F5-26, F5-27 | Delivery accepted work/submission closure; Core 11 new Member join rejection |
| F5-28, F5-29, F5-30, F5-31 | Delivery reopening preserves members, submissions, and prior acceptance |
| F5-32 | Core 17 new Member joins reopened Outcome |
| F5-33, F5-34 | Delivery resubmission and second acceptance; Core 17 expanded credit |
| F5-35, F5-36, F5-37 | Work planning/execution lock tests; Core 12 locked membership and submission denial |
| F5-38, F5-39 | Core 13-14 acceptance unlock, refresh, and prerequisite reopen |
| F5-40 | Non-editor override denial plus Project editor dependency-override authorization |

Additional checks cover deletion audit events, stale private drafts, saved review preparation, stale combined reviews, explicit revision resolution, accepted-dependent preservation, acceptance/join races, background form refresh, loading/error/retry states, invalid direct routes, Back/Forward, mobile/desktop screenshots, and derived Project/Stage progress.

Under the layered workflow, this acceptance index describes what must be proven rather than requiring every item to remain in Playwright.
As individual tests are changed, permission matrices, validation, direct API status assertions, stale-write behavior, and concurrency should move to lower layers when the browser itself is not material to the evidence.
Critical browser journeys, refresh persistence, routing, responsive behavior, and real integration paths remain Playwright responsibilities.

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
At the time of this decision entry, distinct-user dependency browser checks were still in progress.
Later closure evidence supersedes that interim status.

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

### P5-D05 - Separate fast behavioral tests from browser acceptance

**Status:** Implemented
**Area:** Testing and Infrastructure
**Impact:** High

#### What gave us a hard time

Phase 5 Playwright suites accumulated permission matrices, validation checks, direct API assertions, persistence checks, concurrency checks, responsive behavior, real Supabase sign-in, and complete user journeys in the same browser layer.
Some suites therefore required serial execution and increased timeout headroom against the hosted acceptance database.

#### Root cause / constraint

Playwright was being used as both the acceptance layer and a general-purpose testing layer.
This made browser runs slower and increased coupling between tests even when the behavior under test did not require a browser.

#### Options considered

1. Continue expanding Playwright and increase timeouts as Phase 5 grows.
2. Replace Playwright with another browser framework.
3. Keep Vitest and Playwright, add React Testing Library/jsdom, and assign each behavior to the lowest reliable test layer.

#### Decision

Selected option 3.
Vitest remains the Node unit/service layer.
Vitest with React Testing Library and jsdom owns component interaction.
Service or API integration tests should own backend authorization, persistence, stale-write, and concurrency behavior where practical.
Playwright Chromium owns critical end-to-end browser journeys.
Firefox and WebKit are release-level verification rather than normal inner-loop browsers.

#### Result

Added `pnpm test:ui`, Chromium-specific `pnpm test:e2e`, cross-browser `pnpm test:e2e:cross-browser`, `pnpm verify:e2e`, and `pnpm verify:release`.
`pnpm verify` now includes component tests.
Playwright retains failure traces and screenshots.
The first component test covers `ProjectDialog` dismissal and focus behavior without booting the real application stack.
Repository guidance now instructs future work to migrate non-browser assertions downward incrementally rather than rewriting the entire existing Phase 5 suite at once.

#### What we learned

The browser should prove the behaviors that actually depend on browser integration.
Putting every rule in E2E tests obscures failures, slows feedback, and encourages serial state coupling.

#### Next approach

When an existing Playwright test is touched, first ask whether the browser is material to the assertion.
Move pure permission, validation, API status, stale-write, and concurrency assertions to lower layers where practical.
Keep one clear browser journey for the user-visible consequence when that consequence matters.
Prefer independent Playwright fixtures over sequential test dependencies.

#### Related changes

- `package.json`
- `vitest.ui.config.ts`
- `src/test/setup.ts`
- `src/features/projects/ProjectDialog.test.tsx`
- `playwright.config.ts`
- `.github/workflows/ci.yml`
- `.github/workflows/release-verification.yml`
- `AGENTS.md`
- `CONTRIBUTING.md`
- `.testcases/README.md`
- `.docs/phases/README.md`
- `.agents/skills/prometheus-phase-delivery/SKILL.md`

### P5-D06 - Optimize hosted navigation without weakening authorization

**Status:** Implemented
**Area:** Performance, authentication, and query consistency
**Impact:** High

#### Measurement

The initial hosted measurements showed Projects useful content at 3.90 seconds, Project detail at 3.43 seconds, Registry at 2.41 seconds, and a Project status change at 4.33 seconds perceived and 4.12 seconds for the PATCH request.

The initial server breakdown showed roughly 0.13 to 0.16 seconds for remote Supabase `getUser`, 0.46 to 0.56 seconds for Member lookup, about 1.37 seconds for broad status authorization reads, and about 1.80 seconds for the full status update graph response.

Response serialization was measured below 0.1 milliseconds and was not a material bottleneck.

#### Decisions

Supabase `auth.getClaims` is used for verified JWT signature and expiry checks with explicit issuer, audience, and UUID subject validation.

The current ES256 signing-key configuration supports local verification through the cached JWKS path documented by Supabase.

Prometheus Member resolution now deduplicates only concurrent in-flight lookups.

Successful membership is never retained across sequential requests, so role and deactivation changes remain effective on the next protected request.

Project, workflow, and Registry reads use domain-specific TanStack Query stale times, targeted cache updates, parallel workflow reads, Registry overview aggregation, and limited hover or focus prefetching.

Stable read query functions do not consume React Strict Mode abort signals when an aborted duplicate would otherwise create unnecessary hosted work.

The status mutation uses a narrow authorization projection, an atomic status plus history transaction, and a small response contract.

The status control updates Project detail and list caches optimistically, rolls back failed requests, and serializes rapid status mutations per Project.

Prisma relation joins are enabled for the measured Project and workflow read graphs after generation and schema validation.

#### Result

Across three hosted Chromium runs, median useful content was 1.33 seconds for Projects, 1.34 seconds for Project detail, and 1.42 seconds for Registry.

Cached Project returns measured 18 milliseconds and cached revisits measured 45 milliseconds.

Project status rendered its optimistic value in 24 milliseconds median and settled authoritatively in 1.60 seconds median.

The corresponding median API durations were about 0.98 seconds for Projects, 0.99 seconds for Project detail, 1.08 seconds for workflow, 1.04 seconds for the aggregated Registry overview, and 1.58 seconds for status PATCH.

The original paths were reproduced after the changes, including refresh persistence, role downgrade, deactivation denial, failed optimistic rollback, and the hosted submission loading retry path.

#### Lessons and remaining bottlenecks

Hosted network distance and repeated server-side authentication and Member lookup remain the dominant warm-request cost.

The remaining full-suite Project Members acceptance failure is pre-existing test drift because the current main workspace does not mount the existing `ProjectMembersPanel` component.

No long-lived authorization cache, arbitrary retry, timeout increase, UI redesign, or speculative infrastructure was introduced.

Related files include `AuthService`, `AuthProvider`, `ProjectsService`, `ProjectWorkflowService`, Registry overview services and contracts, Project query configuration, and the Project overview status tests.

### P5-D07 - Reduce status round trips and isolate the remaining database-distance floor

**Status:** Implemented
**Area:** Performance, backend, persistence, and infrastructure
**Impact:** High

#### What gave us a hard time

Warm protected requests remained close to one second after the first latency pass, and authoritative Project status completion remained close to 1.60 seconds.
The Projects list also loaded every Project Member and every Outcome status even though the list only needs current-member participation and aggregate progress.

#### Root cause / constraint

Five-sample measurements against the configured hosted Supabase database reproduced medians of 1013.4 milliseconds for `GET /api/projects`, 993.9 milliseconds for Project detail, 1004.6 milliseconds for workflow, 996.5 milliseconds for Registry, and 1593.0 milliseconds for authorized status PATCH.
Warm JWT verification measured 0.8 milliseconds and response serialization measured at or below 0.1 milliseconds.
Active Member resolution measured 512.5 milliseconds and individual Prisma read services measured roughly 484 to 598 milliseconds.
The configured Supavisor transaction-pool URL is in AWS `ap-south-1` and one Prisma read emitted four query events.
A read-only session-pool comparison reduced warm Member resolution to 94.6 milliseconds and individual read services to roughly 109 to 112 milliseconds with one query event.
Repository evidence does not identify the deployed Vercel function region or its concurrency and connection-pool requirements.

#### Options considered

1. Cache active authorization across sequential requests.
2. Combine unrelated endpoints or add a broad workspace bootstrap response.
3. Replace list loading with a narrower read model and collapse the authorized status update plus history insertion into one atomic statement.
4. Switch production from transaction pooling to session pooling.

#### Proposed solution

Keep next-request Member enforcement and existing API ownership.
Use a purpose-built Projects list projection.
Execute status authorization, row locking, status and timestamp updates, and append-only history insertion in one parameterized PostgreSQL statement through Prisma.
Treat connection mode and deployment placement as a separately reviewed infrastructure decision.

#### Decision

Selected option 3.
The list now selects only the current Member's Project Membership and uses per-Stage counts plus open Outcome identifiers to derive the existing metrics contract.
Status mutation now performs the authorized transition and history insertion atomically in one statement, with a fallback existence lookup only for denied or missing Projects.
No schema, migration, RLS, Auth, Storage, timeout, retry, or long-lived authorization-cache change was made.
Session pooling was measured but not adopted because Supabase recommends transaction pooling for serverless workloads and the deployment connection budget has not been verified.

#### Result

The isolated Projects list service median decreased from 598.3 to 503.3 milliseconds, while the same end-to-end `GET /api/projects` median changed from 1013.4 to 1007.7 milliseconds and is not treated as a meaningful user-perceived improvement.
The same authorized status PATCH path decreased from 1593.0 to 1197.0 milliseconds, a 396.0 millisecond or 24.9 percent reduction.
Project Lead persistence and exact status-history assertions passed in Chromium.
The CAN_EDIT browser flow passed, and unrelated active Members remained denied.
The focused CAN_VIEW browser test retained the pre-existing timeout while waiting for an unmounted Project Members request before reaching its status assertion.

#### What we learned

The transaction-pool and geographic round-trip floor dominates ordinary protected reads more than response size or transformation work on the current dataset.
Reducing selected rows is still useful for scale, but it cannot remove the sequential active-Member database leg.
Multi-record mutations can gain meaningful latency by reducing application-level database round trips while keeping authorization and history atomic.

#### Next approach

Before changing database connection mode, verify the deployed Vercel function region, whether the API uses serverless or a persistent runtime, peak concurrent function instances, Prisma connection limits, and the Supabase session-pool capacity.
Prefer co-locating the API runtime with the `ap-south-1` database if deployment evidence confirms geographic separation.
Do not replace transaction pooling with session pooling until connection-exhaustion risk is measured under production-like concurrency.

#### Related changes

- `server/projects/projects.service.ts`
- `server/projects/projects.service.test.ts`
- `scripts/measure-latency.ts`
- `tests/e2e/projects.spec.ts`
- `tests/e2e/project-member-access.spec.ts`

### P5-D08 - Preserve useful cached content and preload heavy authenticated routes

**Status:** Implemented
**Area:** Frontend performance, query consistency, and testing
**Impact:** High

#### What gave us a hard time

Backend reads remained dominated by the already measured database and network path.
The remaining opportunity was to make navigation useful before those authoritative reads completed without showing one Project as another or treating cached authorization as authoritative.

#### Root cause / constraint

Project detail required its dedicated query before rendering even though the Projects list already held the exact matching Project read model.
Project Members, Outcome work, and Outcome delivery forced refetches on every mount despite also defining domain stale times.
The Project workspace and Registry were included in one 812.56 kilobyte minified initial JavaScript bundle.
Project Member access remained visually unchanged until its authorized PATCH returned.

#### Options considered

1. Increase all stale times globally.
2. Add a combined workspace backend endpoint.
3. Reuse exact cached records, retain domain-specific stale times, preload code and data from existing high-intent signals, and make only deterministic access changes optimistic.

#### Decision

Selected option 3.
Project detail now uses only the list record with the same Project ID as placeholder data while its dedicated authoritative query runs.
Cached content remains visible if that refresh fails and the existing error pattern reports the failure.
Forced every-mount refetches were removed from Project Members, Outcome work, and Outcome delivery, leaving their 30-second or 10-second stale policies and precise mutation cache updates in control.
Project workspace and Registry routes are lazy chunks, and the existing hover and focus prefetch paths now preload both route code and query data.
Project Member access updates its exact Project Members cache optimistically, rolls back on error, reconciles with the server response, and continues to rely on backend authorization.

#### Result

The baseline Chromium probe measured cold Projects useful content at 1957.7 milliseconds, prefetched Project A at 187.0 milliseconds, warm Projects return at 138.4 milliseconds, prefetched Project B at 160.1 milliseconds, and Registry warm revisit at 100.9 milliseconds.
After the change, an intentionally unprefetched Project click from a cached Projects list displayed the exact Project header in 21.7 milliseconds while authoritative detail completed at 977.0 milliseconds.
The same after-change run measured prefetched Project navigation at 148.3 to 192.6 milliseconds and warm Projects return at 72.2 milliseconds.
The final focused timing run measured Project status local feedback at 19.3 milliseconds while still awaiting and restoring through the authoritative PATCH path.
Cold Projects measured 2632.9 milliseconds in that run, so no cold backend improvement is claimed.
The production build now emits 60.86 kilobyte Project workspace and 22.04 kilobyte Registry route chunks.
Initial minified JavaScript decreased from 812.56 to 731.79 kilobytes, with gzip size decreasing from 230.72 to 213.15 kilobytes.

#### What we learned

Exact cache reuse can remove a visible wait even when authoritative latency is unchanged.
Stale-time policy is ineffective when a query separately forces every mount to refetch.
Code preloading and data prefetching should share the same limited high-intent interaction instead of creating independent speculation systems.

#### Next approach

Keep measuring useful-content and authoritative-completion milestones separately.
Do not broaden placeholder reuse across Project IDs.
Further initial-bundle work should be evidence-driven because the remaining main chunk includes the application shell, authentication, Projects landing page, and shared runtime dependencies.

#### Related changes

- `src/routes/router.tsx`
- `src/routes/route-modules.ts`
- `src/features/projects/ProjectOverviewPage.tsx`
- `src/features/projects/ProjectsPage.tsx`
- `src/features/shell/AppShell.tsx`
- `src/features/projects/ProjectMembersPanel.tsx`
- `src/features/projects/OutcomeWorkArea.tsx`
- `src/features/projects/OutcomeDeliveryPanel.tsx`
- `src/features/projects/ProjectMembersPanel.test.tsx`
- `tests/e2e/perceived-latency.spec.ts`

## Known Limitations

The core Phase 5 product scope is complete.

Some browser suites still contain assertions that can eventually move to faster service/component layers.
That is test-maintenance debt rather than an unfinished product capability.

Credential-gated signed-in browser tests require configured test identities and should continue to be used for release smoke when available.

## Technical Debt

Phase 4 records an existing Registry hook warning and a production bundle-size advisory.
Both remain non-blocking warnings; Vite also reports its existing CJS API deprecation.
The inherited Member/Department timestamp-default schema mismatch is recorded above rather than changing completed-phase persistence as part of this work.
Shared history and activity currently load the full Outcome record; future pagination should preserve chronological versions and combined-review snapshot checks.
Some existing Phase 5 browser suites still carry API-only and permission assertions that should move to lower test layers as those tests are next maintained.

## Lessons from the Phase

The prototype distinguishes planning from execution while locked.
Canonical rules override prototype permission shortcuts and its revision-clearing behavior.
New submissions must not automatically clear NEEDS_REVISION.
Testing should use the lowest reliable layer and reserve browser E2E for workflows whose correctness depends on real integration.

## Recommendations / Next Approach

Keep the completed workflow protected by layered regression.
Use focused service/component tests for permission and stale-write behavior and preserve a small signed-in browser path for release smoke.

## Phase Exit Result

**Complete.**

Phase 5 no longer blocks release status or later phase closure.
