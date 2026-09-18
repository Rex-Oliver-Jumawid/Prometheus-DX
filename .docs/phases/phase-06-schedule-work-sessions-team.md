# Phase 6 - Schedule, Work Sessions, and Team

## Status

In progress in parallel with the formal Phase 5 acceptance and regression work.
Schedule Slice 1 implements F6-01 through F6-09.
Work Sessions and Team Slice 2 implements F6-10 through F6-26.
Phase 6 is not complete until the remaining manual acceptance checks are finalized and the pre-existing Project Members regression is resolved on its owning branch.

## Objective

Deliver planned recurring Member availability, persisted actual Work Sessions, and Team visibility without mixing those concepts or substituting realtime presence for business records.

## Scope Delivered

Schedule Slice 1 adds `/schedule`, Team Schedule, Shifts, and Configure My Schedule.
Active Members can view shared recurring availability and can create, edit, or remove only their own schedule blocks.
The UI includes loading, error with retry, no-schedule, configuration, save-pending, and teammate-availability states.
Choosing Configure My Schedule from Shifts returns to the Team Schedule configuration context.

Slice 2 adds the global Time In and Time Out control, refresh-persistent active sessions, weekly actual-work history in Shifts, the `/team` page, and self-correction for stale sessions.
Team shows Registry identity, planned Schedule hours, actual WorkSession hours, and authoritative Working Now state.

## Architecture and Data Flow

TanStack Query owns server schedule state.
React Hook Form owns temporary configuration input.
Shared Zod contracts validate request and response boundaries.
NestJS authenticates the caller and enforces schedule ownership.
Prisma persists schedules and schedule blocks in PostgreSQL.

The implementation treats recurring schedule clock values as local wall-clock values for `Asia/Manila`.
It does not apply event-timestamp timezone conversion to these values.

WorkSession event timestamps are stored as UTC instants and presented in `Asia/Manila`.
TanStack Query owns current session, weekly history, and Team server state.
Time In, Time Out, and correction mutations invalidate only WorkSession, Team, and affected Schedule summary queries.
Elapsed time is derived presentation state and is never persisted as a client-only work record.

## Database Changes

Migration `20260918000000_phase_06_schedule` adds the `Weekday` enum, `member_schedules`, and `schedule_blocks`.
Each Member can have at most one `MemberSchedule`.
Schedule blocks require `start_time < end_time`.
Identical blocks are prevented by a unique index.
Member deletion cascades to the schedule and schedule deletion cascades to its blocks.
Schedule replacement updates the parent and replaces child blocks in one Prisma transaction.

`ScheduleOverride` is intentionally deferred because F6-01 through F6-09 do not require date-specific overrides.
Migration `20260918010000_phase_06_work_sessions` adds `WorkSessionStatus`, `work_sessions`, and `work_session_corrections`.
PostgreSQL enforces status and timestamp consistency, correction timestamp ordering, non-empty correction reasons, and at most one unresolved session per Member through a partial unique index where `time_out IS NULL`.
WorkSession and correction timestamps use `TIMESTAMPTZ(6)`.
Member deletion is restricted while WorkSession history exists, and correction history cannot be cascade-deleted independently of its WorkSession.

## API Changes

- `GET /api/schedule/team` returns active Registry Members with Department, position, and permitted schedule data.
- `GET /api/schedule/me` returns an explicit `{ schedule }` resource, including JSON `null` when no schedule exists.
- `PUT /api/schedule/me` replaces the authenticated Member's schedule.
- `PUT /api/schedule/members/:memberId` permits only the same authenticated Member identity.

Team Schedule ordering is deterministic by Member name, creation time, and Member ID.
Schedule blocks are returned in weekday, start-time, end-time, and block-ID order.

- `GET /api/work-sessions/current` returns the authenticated Member's unresolved session.
- `POST /api/work-sessions/time-in` atomically starts a session for `CurrentMember`.
- `POST /api/work-sessions/time-out` atomically completes only `CurrentMember`'s OPEN session.
- `GET /api/work-sessions/history` returns the authenticated Member's Monday-to-Monday weekly history.
- `POST /api/work-sessions/:workSessionId/corrections` permits only self-correction of a `NEEDS_CORRECTION` session and records previous and new timestamps with a reason.
- `GET /api/team` aggregates active Registry Members, Schedule blocks, and WorkSessions for the selected week.

## Security and Authorization

The existing `SupabaseAuthGuard` resolves an active `CurrentMember` for every endpoint.
Deactivated Members are rejected by the shared authentication boundary.
Schedule write authority is based only on equality with the authenticated Member ID.
Administrator role does not grant cross-Member schedule write authority.
Project Lead status does not grant cross-Member schedule write authority.
The backend enforces ownership independently of UI visibility.

WorkSession write routes never accept a client-supplied Member ID.
Administrator and Project Lead status grant no cross-Member Time In, Time Out, or correction authority.
The service pre-checks unresolved state for clear errors, while the partial unique database index remains authoritative under concurrent Time In requests.
Time Out and correction use conditional updates in transactions so repeated or concurrent requests cannot close or correct the same session twice.

## Environment and Configuration

`WORK_SESSION_MAX_HOURS` configures the stale OPEN-session threshold.
The documented default is 16 hours because the canonical exact threshold remains a deferred product decision.
Crossing the threshold marks the session `NEEDS_CORRECTION` on WorkSession or Team access and never supplies an automatic Time Out.
The committed machine-specific `playwright.phase6.config.ts` was removed because it was a temporary alternate-port configuration for concurrent worktrees.
The normal portable `playwright.config.ts` remains the repository standard.

## Testing and Acceptance Result

Focused contract tests cover malformed weekdays, malformed times, equal and reversed ranges, same-day overlap, adjacent blocks, duplicates, the 28-block maximum, and weekly-target bounds.
Service and controller tests cover ownership denial, atomic replacement behavior, malformed request rejection, active-Member filtering, Registry identity fields, and deterministic query ordering.
Database integration coverage exercises create, edit, removal, fresh reads, Administrator and Project Lead denial, active-Member visibility, Registry Department and position data, PostgreSQL time ordering, and overlap rejection without changing the prior saved schedule.
React component coverage exercises the empty state, teammate visibility, Shifts-to-configuration transition, saving, and clearing stale mutation errors when configuration is reopened.
The focused Chromium journey covers opening Schedule, no-schedule state, teammate visibility, create, refresh persistence, edit, removal, and the Shifts transition.

The configured environment became available during Slice 2.
Migration deployment, live Schedule integration, live WorkSession and Team integration, and the authenticated Chromium journeys now pass.

Verification performed on 2026-09-18:

- `pnpm exec vitest run shared/contracts/schedule.test.ts server/schedule/schedule.service.test.ts server/schedule/schedule.controller.test.ts`: 14/14 passed across three files.
- `pnpm exec vitest run src/features/schedule/SchedulePage.test.tsx --config vitest.ui.config.ts`: 5/5 passed.
- `pnpm prisma:generate`: passed with non-secret local placeholder database URLs and generated Prisma Client 6.19.3.
- `pnpm prisma:validate`: passed with non-secret local placeholder database URLs.
- `pnpm verify`: passed when supplied non-secret local Auth placeholders required by the existing AuthService tests.
- The passing `pnpm verify` result includes project doctor, typecheck, 127/127 enabled Node tests, 17/17 component tests, and both production builds.
- Ten configured database tests were skipped by the broad Node run, including the four Schedule database integration tests.
- Lint completed with zero errors and the one pre-existing `RegistryPage.tsx` hook dependency warning.
- The web build retained the existing chunk-size warning for the main bundle.
- `pnpm exec vitest run server/schedule/schedule.service.integration.test.ts`: suite loaded successfully and all four tests skipped because `RUN_DATABASE_INTEGRATION` was not enabled and no Prometheus database connection is configured.
- `pnpm exec playwright test tests/e2e/schedule.spec.ts --project=chromium --list`: listed one focused Chromium journey successfully.
- Authenticated Chromium execution was not run because this worktree has no Supabase or E2E credentials.
- No local Supabase stack belongs to this worktree, so migration deployment and live PostgreSQL assertions were not run.

Slice 2 verification performed on 2026-09-18:

- `pnpm prisma:generate`: passed with Prisma Client 6.19.3.
- `pnpm prisma:validate`: passed.
- `pnpm prisma:migrate:deploy`: applied `20260918010000_phase_06_work_sessions`; all 15 migrations were applied.
- Focused WorkSession, Team, timezone, and Schedule service/controller tests: passed.
- Focused React tests for Schedule, attendance, and Team: 10/10 passed.
- Live WorkSession database integration: 5/5 passed.
- Live Team database integration: 2/2 passed.
- Pending Slice 1 Schedule database integration after fixture correction: 4/4 passed.
- Focused authenticated Chromium on isolated local ports: 2/2 passed.
- Chromium covers the complete Schedule, Time In, refresh, Team Working Now, Time Out, weekly history, and planned-versus-actual path.
- `pnpm verify`: passed with project doctor, lint, typecheck, 139/139 enabled Node tests, 22/22 component tests, and both production builds.
- The broad Node gate skipped 17 configured database tests; the 11 Phase 6 Schedule, WorkSession, and Team database tests passed separately against live PostgreSQL.
- Final full Chromium regression: 90 passed, 1 failed, and 3 did not run in 18.6 minutes.
- Both Phase 6 Chromium tests passed in the final full regression.
- The sole failure is the pre-existing Phase 4 Project Members test waiting for `GET /api/projects/:projectId/members`; `ProjectMembersPanel` exists but is not mounted by the current Project UI at branch HEAD.
- The three tests that did not run are serial dependents in the same `project-member-access.spec.ts` file.
- Project UI was intentionally not changed to make Phase 6 pass, as required by the Phase 6 scope boundary.
- The attendance panel initially made a Phase 5 test's generic complementary-role selector ambiguous; scoping the assertion to `.app-sidebar` restored all 15 Outcome Work Chromium tests.
- Full Registry Chromium acceptance passes after correcting an existing delayed-blur and keyboard-suggestion race in the member dialog.

A raw `pnpm test` without environment values reached 116 passing tests and failed the 11 existing AuthService tests because `SUPABASE_URL` was unset.
The same suite passed 127/127 enabled tests when rerun with non-secret local Auth placeholders.

### Schedule Slice 1 acceptance coverage

| ID | Coverage |
| --- | --- |
| F6-01 | Route, loading/error states, Team Schedule component, and focused browser journey |
| F6-02 | Own-schedule API, transactional persistence integration, component save, and browser refresh journey |
| F6-03 | Replacement persistence integration and browser edit/refresh journey |
| F6-04 | Empty-block replacement integration and browser removal journey |
| F6-05 | Active teammate API response, component visibility, and browser teammate fixture |
| F6-06 | Controller, service, and database integration ownership denial for unrelated, Administrator, and Project Lead callers |
| F6-07 | Component and browser intentional empty states plus null schedule response contract |
| F6-08 | Shared validation and service/integration overlap rejection with adjacent-block acceptance |
| F6-09 | Component and browser Shifts-to-Team-Schedule configuration transition |

### Work Sessions and Team Slice 2 acceptance coverage

| ID | Coverage |
| --- | --- |
| F6-10 | Time In service, controller, component, database integration, and Chromium |
| F6-11 | Current-session query plus authenticated Chromium refresh |
| F6-12 | Partial unique index, simultaneous database integration, service conflict, and pending-state UI |
| F6-13 | Atomic Time Out service, database integration, component, and Chromium |
| F6-14 | Service and database integration denial without an OPEN session |
| F6-15 | Exact duration helper, service totals, database integration, and UI formatting |
| F6-16 | Weekly history API, component rendering, and Chromium |
| F6-17 | Separate history rows and summed service totals |
| F6-18 | Separate Schedule and WorkSession queries, Team metrics, and Chromium |
| F6-19 | Cross-midnight helper and live database integration |
| F6-20 | Active Registry Member aggregation, Team component, database integration, and Chromium route |
| F6-21 | OPEN WorkSession-derived Working Now in service, database integration, component, and Chromium |
| F6-22 | Time Out invalidation and Chromium Team transition |
| F6-23 | ScheduleBlock-derived planned minutes in Team service and integration |
| F6-24 | WorkSession-derived actual seconds in Team service and integration |
| F6-25 | Team empty page and zero-value Member component/integration coverage |
| F6-26 | Registry Department and position service, component, and integration coverage |

## Decision and Challenge Log

### P6-D01 - Keep planned schedule clocks separate from event timestamps

**Status:** Implemented
**Area:** Database and API
**Impact:** High

#### What gave us a hard time

Prisma represents PostgreSQL `TIME` values with JavaScript `Date` objects even though recurring schedule clocks are not instants.

#### Root cause or constraint

Treating schedule values as Manila-to-UTC timestamps would shift recurring wall-clock availability and mix two different time concepts.

#### Options considered

1. Convert schedule clocks through `Asia/Manila` as event timestamps.
2. Preserve the `HH:mm` wall-clock value through a neutral date representation at the Prisma boundary.

#### Decision

Use option 2 and read or write the clock components through UTC accessors solely as a neutral transport representation.

#### Result

The API preserves values such as `09:00` without timezone shifting.
Actual Work Session timestamps remain deferred and will use UTC instants.

#### What we learned

Timezone presentation rules must not be applied to recurring local-clock domain values.

#### Next approach

Keep explicit clock-time tests when Schedule Overrides are introduced.

#### Related changes

- `shared/contracts/schedule.ts`
- `server/schedule/schedule.service.ts`
- `prisma/migrations/20260918000000_phase_06_schedule/migration.sql`

### P6-D02 - Schedule ownership follows authenticated Member identity

**Status:** Implemented
**Area:** Security
**Impact:** High

#### What gave us a hard time

Existing organization and project authorities could be incorrectly interpreted as schedule-management authority.

#### Root cause or constraint

Canonical requirements grant Members self-management and do not define an Administrator or Project Lead override.

#### Options considered

1. Grant cross-Member editing to Administrators or Project Leads.
2. Require the target Member ID to equal the authenticated Member ID.

#### Decision

Use option 2 at both controller and service boundaries.

#### Result

Administrator and Project Lead callers receive the same cross-Member denial as any unrelated Member.

#### What we learned

Existing authority in one domain must not be reused as authority in another domain without an explicit rule.

#### Next approach

Apply the same identity-first rule to Work Session writes unless canonical requirements add a correction authority.

#### Related changes

- `server/schedule/schedule.controller.ts`
- `server/schedule/schedule.service.ts`
- `server/schedule/schedule.service.integration.test.ts`

### P6-D03 - Enforce unresolved-session uniqueness in PostgreSQL

**Status:** Implemented
**Area:** Database and Backend
**Impact:** High

#### What gave us a hard time

An application pre-check cannot prevent two near-simultaneous Time In requests from both observing no active session.

#### Root cause or constraint

Only the persistence boundary can serialize every writer that may create an unresolved WorkSession.

#### Options considered

1. Disable the frontend button and rely on a service pre-check.
2. Use a PostgreSQL partial unique index in addition to the service rule.

#### Decision

Use option 2 with a unique index on `member_id` where `time_out IS NULL`.

#### Result

One of two simultaneous Time In requests succeeds and one receives a conflict.
The database also rejects a second unresolved row created outside the normal service path.

#### What we learned

User-interface pending state prevents accidental clicks, while database constraints protect the domain under real concurrency.

#### Next approach

Keep service errors user-readable, but treat the partial unique index as the authoritative invariant.

#### Related changes

- `prisma/migrations/20260918010000_phase_06_work_sessions/migration.sql`
- `server/work-sessions/work-sessions.service.ts`
- `server/work-sessions/work-sessions.service.integration.test.ts`

### P6-D04 - Group weekly history by Time In in the presentation timezone

**Status:** Implemented
**Area:** Backend and Product
**Impact:** High

#### What gave us a hard time

UTC storage, Manila presentation, Monday week boundaries, and cross-midnight sessions must agree without splitting one WorkSession.

#### Root cause or constraint

Grouping by UTC dates would move early Manila hours into the previous day and splitting by midnight would contradict the canonical WorkSession record.

#### Options considered

1. Use UTC calendar boundaries.
2. Split durations at midnight or week boundaries.
3. Use Monday-to-Monday Manila boundaries and assign the complete session by its Time In.

#### Decision

Use option 3.

#### Result

Week boundaries are converted to UTC instants for queries, while cross-midnight sessions remain one row with an exact duration.

#### What we learned

Event storage timezone and reporting calendar timezone must be explicit and independently tested.

#### Next approach

If reporting later requires prorating across weeks, add a reporting projection without changing WorkSession identity.

#### Related changes

- `shared/work-session-time.ts`
- `shared/work-session-time.test.ts`
- `server/work-sessions/work-sessions.service.ts`

### P6-D05 - Make stale sessions self-correctable without silent closure

**Status:** Implemented
**Area:** Product, Security, and Database
**Impact:** High

#### What gave us a hard time

The canonical model requires a maximum-session threshold but intentionally defers its exact value.

#### Root cause or constraint

Leaving the threshold absent creates a dead-end rule, while hardcoding it in domain structure would prematurely finalize deferred policy.

#### Options considered

1. Defer stale handling entirely.
2. Silently auto-close stale sessions.
3. Use a configurable operational threshold with a documented default and self-correction audit history.

#### Decision

Use option 3 with `WORK_SESSION_MAX_HOURS`, defaulting to 16 hours.

#### Result

Stale OPEN sessions become `NEEDS_CORRECTION`, remain unresolved, block another Time In, and can be closed only through a self-owned correction that preserves previous and new timestamps plus a reason.

#### What we learned

Deferred policy values can remain configurable without weakening already-decided lifecycle and audit invariants.

#### Next approach

Replace the default only when product ownership supplies the final threshold.

#### Related changes

- `.env.example`
- `server/config/env.ts`
- `server/work-sessions/work-sessions.service.ts`
- `src/features/work-sessions/WorkAttendanceControl.tsx`

### P6-D06 - Aggregate Team from canonical records at read time

**Status:** Implemented
**Area:** Backend and Frontend
**Impact:** High

#### What gave us a hard time

Team combines identity, planned data, actual data, and current work state without creating another synchronized model.

#### Root cause or constraint

Registry, Schedule, and WorkSession each own a different part of the display, and presence cannot stand in for actual work.

#### Options considered

1. Persist a Team summary table.
2. Derive the response from Registry Members, ScheduleBlocks, and WorkSessions.

#### Decision

Use option 2.

#### Result

Department and position come from Registry, planned minutes come only from ScheduleBlocks, actual seconds come only from valid WorkSessions, and Working Now requires `OPEN` with no Time Out.

#### What we learned

An aggregation endpoint can provide a stable UI contract without introducing duplicate business state.

#### Next approach

Measure query behavior at larger member counts before introducing any controlled reporting projection.

#### Related changes

- `server/team/team.service.ts`
- `server/team/team.service.integration.test.ts`
- `src/features/team/TeamPage.tsx`

### P6-D07 - Return an explicit empty Schedule resource

**Status:** Implemented
**Area:** API and Testing
**Impact:** Medium

#### What gave us a hard time

The first authenticated Schedule Chromium run received HTTP 200 with an empty response body for a Member without a schedule.

#### Root cause or constraint

Returning bare `null` from the Nest controller produced an empty response, but the Zod client contract expected JSON `null`.

#### Options considered

1. Special-case empty response parsing in the generic API client.
2. Return an explicit resource object with a nullable `schedule` field.

#### Decision

Use option 2.

#### Result

`GET /api/schedule/me` now returns `{ "schedule": null }` for the empty state and the authenticated Slice 1 browser journey passes.

#### What we learned

Nullable resource responses should remain valid JSON at the transport boundary.

#### Next approach

Prefer explicit resource envelopes for future optional singleton resources.

#### Related changes

- `shared/contracts/schedule.ts`
- `server/schedule/schedule.controller.ts`
- `server/schedule/schedule.controller.test.ts`

## Known Limitations

Date-specific schedule overrides are not implemented.
The exact product-owned maximum WorkSession duration remains deferred; the current operational default is configurable at 16 hours.
Stale detection runs at WorkSession and Team access boundaries rather than through a background scheduler.
WorkSession corrections have their dedicated immutable correction records, but the existing project-scoped `ActivityLog` cannot represent organization-level work-session events without a future canonical ActivityLog scope change.
Manual visual and console acceptance across all Phase 6 states remains pending.
The full Chromium repository regression is complete with 90 passing tests and one known pre-existing Project Members failure whose three serial dependents did not run.

## Technical Debt

No duplicate Team, presence, or client-only WorkSession state was introduced.
The stale-session access-boundary sweep is acceptable for this slice but should be revisited if product requirements demand proactive background flagging.

## Lessons

Recurring availability and actual recorded work need separate contracts, persistence, and tests from the first slice.
Permission evidence belongs below the browser even when a browser journey also demonstrates the user experience.
Partial unique indexes are necessary when application pre-checks cannot serialize concurrent creates.
Authenticated browser execution exposed transport and selector defects that lower layers could not reveal.

## Recommendations and Next Approach

Complete intentional manual visual and console checks for desktop and small viewports.
Resolve the pre-existing Project Members panel wiring on its owning Project UI branch, then rerun its four-test serial acceptance file.
Do not add ScheduleOverride or realtime presence during Phase 6 closure unless a concrete acceptance requirement changes.

## Phase Exit Result

Phase 6 remains in progress.
Schedule Slice 1 and the integrated Work Sessions plus Team Slice 2 are implemented.
Live migration, database integration, and focused authenticated Chromium acceptance pass.
The broad non-browser gate passes and both Phase 6 journeys pass inside the full Chromium run.
Full Phase 6 closure still requires remaining manual acceptance evidence and a clean rerun of the pre-existing Project Members acceptance file after its owning UI work is integrated.
