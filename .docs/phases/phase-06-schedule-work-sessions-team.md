# Phase 6 - Schedule, Work Sessions, and Team

## Status

In progress in parallel with the formal Phase 5 acceptance and regression work.
Schedule Slice 1 implements F6-01 through F6-09.
Phase 6 is not complete because Work Sessions and Team remain deferred.

## Objective

Deliver planned recurring Member availability without mixing it with actual Work Sessions or realtime presence.

## Scope Delivered

Schedule Slice 1 adds `/schedule`, Team Schedule, Shifts, and Configure My Schedule.
Active Members can view shared recurring availability and can create, edit, or remove only their own schedule blocks.
The UI includes loading, error with retry, no-schedule, configuration, save-pending, and teammate-availability states.
Choosing Configure My Schedule from Shifts returns to the Team Schedule configuration context.

## Architecture and Data Flow

TanStack Query owns server schedule state.
React Hook Form owns temporary configuration input.
Shared Zod contracts validate request and response boundaries.
NestJS authenticates the caller and enforces schedule ownership.
Prisma persists schedules and schedule blocks in PostgreSQL.

The implementation treats recurring schedule clock values as local wall-clock values for `Asia/Manila`.
It does not apply event-timestamp timezone conversion to these values.

## Database Changes

Migration `20260918000000_phase_06_schedule` adds the `Weekday` enum, `member_schedules`, and `schedule_blocks`.
Each Member can have at most one `MemberSchedule`.
Schedule blocks require `start_time < end_time`.
Identical blocks are prevented by a unique index.
Member deletion cascades to the schedule and schedule deletion cascades to its blocks.
Schedule replacement updates the parent and replaces child blocks in one Prisma transaction.

`ScheduleOverride` is intentionally deferred because F6-01 through F6-09 do not require date-specific overrides.
Work Session models are intentionally deferred to the next Phase 6 slice.

## API Changes

- `GET /api/schedule/team` returns active Registry Members with Department, position, and permitted schedule data.
- `GET /api/schedule/me` returns the authenticated Member's schedule.
- `PUT /api/schedule/me` replaces the authenticated Member's schedule.
- `PUT /api/schedule/members/:memberId` permits only the same authenticated Member identity.

Team Schedule ordering is deterministic by Member name, creation time, and Member ID.
Schedule blocks are returned in weekday, start-time, end-time, and block-ID order.

## Security and Authorization

The existing `SupabaseAuthGuard` resolves an active `CurrentMember` for every endpoint.
Deactivated Members are rejected by the shared authentication boundary.
Schedule write authority is based only on equality with the authenticated Member ID.
Administrator role does not grant cross-Member schedule write authority.
Project Lead status does not grant cross-Member schedule write authority.
The backend enforces ownership independently of UI visibility.

## Environment and Configuration

No production configuration was added.
The committed machine-specific `playwright.phase6.config.ts` was removed because it was a temporary alternate-port configuration for concurrent worktrees.
The normal portable `playwright.config.ts` remains the repository standard.

## Testing and Acceptance Result

Focused contract tests cover malformed weekdays, malformed times, equal and reversed ranges, same-day overlap, adjacent blocks, duplicates, the 28-block maximum, and weekly-target bounds.
Service and controller tests cover ownership denial, atomic replacement behavior, malformed request rejection, active-Member filtering, Registry identity fields, and deterministic query ordering.
Database integration coverage exercises create, edit, removal, fresh reads, Administrator and Project Lead denial, active-Member visibility, Registry Department and position data, PostgreSQL time ordering, and overlap rejection without changing the prior saved schedule.
React component coverage exercises the empty state, teammate visibility, Shifts-to-configuration transition, saving, and clearing stale mutation errors when configuration is reopened.
The focused Chromium journey covers opening Schedule, no-schedule state, teammate visibility, create, refresh persistence, edit, removal, and the Shifts transition.

Database integration, migration status, and the focused Chromium journey require environment credentials that are not configured in the current worktree session.
Their latest execution status must remain recorded as unverified until those commands run successfully.

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

## Known Limitations

Date-specific schedule overrides are not implemented.
Work Sessions, Time In, Time Out, weekly actual history, Working Now, and Team scheduled-versus-actual metrics are not implemented.
The Schedule page does not claim actual-work functionality.
Live database and authenticated browser verification remain environment-dependent.

## Technical Debt

No Schedule-specific technical debt is accepted for F6-01 through F6-09.
The full Phase 6 data model and UI will expand in later slices without changing Schedule ownership.

## Lessons

Recurring availability and actual recorded work need separate contracts, persistence, and tests from the first slice.
Permission evidence belongs below the browser even when a browser journey also demonstrates the user experience.

## Recommendations and Next Approach

After Schedule Slice 1 is verified in an environment with database and E2E credentials, the next Phase 6 slice should add persistent `WorkSession` Time In and Time Out behavior.
That slice should enforce one unresolved session per Member at the database boundary and preserve UTC event timestamps.
Do not start Team actual-work metrics until Work Session persistence is authoritative.

## Phase Exit Result

Phase 6 remains in progress.
Schedule Slice 1 and the audit changes are safe to commit based on all verification available in this worktree.
Formal live-database and authenticated-browser acceptance remain pending and must not be claimed as passed.
