# Phase 7 - Notifications and Home

## Status

In progress.

Current slice: Notifications.

Phase 7 starts from the Phase 6-complete `main` baseline while Phase 5 final acceptance and regression remain open on their own line of work.

This journal records only work and decisions that belong to Phase 7.

## Objective

Connect canonical Prometheus events into actionable notifications and build a Home command center over existing project, review, schedule, work-session, and team data.

Do not create duplicate client-only or manually synchronized business state for either Notifications or Home.

## Current Scope

Phase 7 is split into two implementation slices:

1. Notifications
2. Home

Notifications is the current slice.

Home should be implemented separately after the Notifications slice is stable enough to integrate against canonical notification and workflow behavior.

## UI Reference

The current Prometheus Figma file is the source of truth for Phase 7 layout and visual design.

Figma file key:

`8zgQ4pcWtku7rSWzjlP9K9`

Phase 7 frames:

- Notifications: node `11:2301`
- Home: node `189:3`

Use `.context/ui-reference.md` for the repository-wide UI ownership and conflict-resolution rules.

The HTML prototypes remain interaction references only where a Figma frame does not fully specify behavior.

## Phase 7 Shell Decision

The current Figma shell places Notifications in the lower sidebar utility area.

The Notifications utility item may display an unread-count badge.

Do not add a separate global top-right notification bell, notification icon, or notification control unless a newer explicit product decision changes the layout.

The same shell treatment should be preserved across the Home and Notifications pages.

## Notifications Planned Scope

The Notifications slice should implement:

- persisted notifications created from real domain events
- recipient ownership
- notification type and context
- actor information where relevant
- Project and Outcome references where relevant
- read and unread state
- unread count
- All and Unread filters
- Mark all as read
- context navigation
- intentional loading, empty, filtered-empty, and error states
- responsive layout matching Figma node `11:2301`

Notification creation must happen at reliable domain boundaries rather than being inferred from presentation state.

The inbox must remain server-backed and refresh-persistent.

## Home Planned Scope

The Home slice should implement:

- My Project Summary
- Working Now
- Needs Attention
- Quick Access
- fixed-height internal scrolling where shown by the approved design
- responsive layout matching Figma node `189:3`

Home should aggregate canonical records from existing modules.

Working Now must derive from WorkSessions rather than presence or client-only state.

Needs Attention should derive from actionable workflow records rather than a separately maintained dashboard table.

## Architecture and Data Flow

TanStack Query should own server-managed notification and Home query state.

NestJS should expose narrow authenticated read and mutation boundaries.

Prisma and PostgreSQL should own persisted notification state.

Domain event creation should remain colocated with the transaction or service boundary that makes the underlying event authoritative where practical.

Optimistic read-state updates are acceptable if they preserve rollback and reconciliation with the server.

Home aggregation endpoints may provide stable UI contracts, but they must derive their values from canonical source records.

## Security and Authorization

A user may only read or mutate their own notifications unless a future canonical rule explicitly defines broader authority.

Notification navigation must still respect Project, Outcome, Registry, and other existing authorization boundaries.

Administrator or Project Lead authority in one domain must not implicitly grant access to another member's notification inbox.

Home data visibility must preserve the existing authorization model of the source records it aggregates.

## Testing and Acceptance

Use `.testcases/phase-07-notifications-home-tests.md` as the Phase 7 acceptance gate.

Use the lowest reliable test layer for each requirement:

- Vitest for pure logic and validation
- service or database integration tests for event creation, persistence, idempotency, ownership, and read-state behavior
- React Testing Library for inbox and Home component interaction
- focused Chromium Playwright journeys for notification navigation and the Phase 7 main end-to-end flow
- manual browser comparison against the current Figma frames for visual fidelity and responsive behavior

Do not default every Phase 7 acceptance case to Playwright.

## Decision and Challenge Log

### P7-D01 - Figma owns Phase 7 layout and visual design

**Status:** Accepted

**Area:** Product / Frontend

**Impact:** High

#### What gave us a hard time

Older repository guidance treated `.model/finalmodel.html` as the primary application-experience source and Figma as a supporting helper.

That policy could cause agents to recreate older shell layouts even when the current Figma file contains the approved interface.

#### Root cause / constraint

The product design has evolved after some prototype and Phase 1 documentation was written.

Keeping the older hierarchy would make documentation contradict the current product decision.

#### Decision

Use the current Figma file as the source of truth for UI layout and visual design.

Use HTML prototypes only for interaction and workflow detail that the target Figma frame does not fully express.

Canonical requirements and user flows continue to own functionality, workflow rules, authorization, persistence, and security.

#### Result

Repository UI guidance, phase planning, acceptance tests, and agent instructions now point implementation toward the current Figma design.

#### Next approach

Record the exact Figma node used for substantial future UI slices so later developers can reproduce the intended design without guessing.

### P7-D02 - Notifications live in the sidebar utility area

**Status:** Accepted

**Area:** Product / Frontend

**Impact:** Medium

#### What gave us a hard time

Earlier Phase 1 planning referenced a generic notification button placeholder, and a previous Phase 7 implementation experimented with a separate top-right notification icon.

The current Figma design does not use that duplicate global control.

#### Decision

Notifications are accessed from the lower sidebar utility area.

Keep the unread badge there when applicable.

Do not add a separate top-right notification bell or notification control.

#### Result

Phase 7 requirements and acceptance documentation now match the current Figma shell.

#### Related references

- Figma Notifications node `11:2301`
- Figma Home node `189:3`
- `.context/ui-reference.md`
- `.context/phases.md`
- `.testcases/phase-07-notifications-home-tests.md`

## Home Branch Delivery - feat/homepage-figma

The Home slice has been implemented independently on `feat/homepage-figma` against Figma node `189:3`.

The branch replaces the root placeholder with the real Company Command Center while preserving the existing authenticated shell, sidebar utility placement, profile control, and attendance control.

Home now exposes a narrow authenticated `GET /api/home` read model.

The read model derives project relationships and progress from the existing Projects service, actual weekly work from WorkSession history, planned commitment from the member schedule, active workers from open WorkSession records, and attention items from canonical submission and revision records.

No dashboard persistence table or duplicated business state was added.

Review attention is restricted to projects where the signed-in member is the Project Lead and a non-accepted Outcome has a `FOR_REVIEW` submission.

Revision attention is restricted to `NEEDS_REVISION` Outcomes where the signed-in member is an Outcome Member and an unresolved revision request exists.

This keeps another member's non-actionable workflow details out of the Home aggregation.

The UI implements the four Figma summary cards, Leading and Participating project groups, project status and progress, fixed-height Working Now and Needs Attention lists with internal scrolling, and Quick Access for Projects, Schedule, and Team.

The Figma Reports shortcut remains visible but disabled because this baseline does not contain an implemented Reports route.

No fake Reports destination was introduced.

Responsive rules preserve the desktop composition at the Figma reference size and progressively reflow summary cards, the main dashboard columns, and side panels for narrower screens.

Intentional loading, error with retry, and per-section empty states are included.

Focused Home service and React Testing Library coverage was added for project grouping, summary values, authorization-shaped attention queries, empty states, error handling, and navigation targets.

The Treehouse worktree path supplied for the implementation session was not available in the execution environment, so implementation was performed through the connected GitHub repository rather than a local checkout.

Focused local verification was subsequently run by the user from the supplied Treehouse worktree after generating the Prisma Client.

Verification evidence:

- `pnpm exec vitest run server/home/home.service.test.ts`: 2/2 Home service tests passed.
- `pnpm exec vitest run src/features/home/HomePage.test.tsx --config vitest.ui.config.ts`: 4/4 Home React Testing Library tests passed.
- `pnpm typecheck`: passed after `pnpm prisma:generate`.
- The earlier Prisma import failures were caused by a missing generated Prisma Client in the worktree rather than by the Home implementation.

Live Chromium and Figma comparison remain to be verified at 1244x682, 1440x900, 900x900, and 390x844.

Notifications remains a separate parallel slice and is not implemented or assumed by this Home branch.

### P7-D03 - Home uses a narrow derived read model

**Status:** Accepted

**Area:** Backend / Frontend

**Impact:** High

#### Root cause / constraint

The Figma Home screen combines Projects, WorkSessions, Schedule, and review workflow data.

Fetching every Project workflow independently from the browser would create N+1 requests and would make it easy to expose review or revision details that are not actionable for the current member.

#### Decision

Expose one authenticated `GET /api/home` endpoint whose response is derived from canonical records and existing Projects and WorkSession service logic.

Do not persist Home-specific counters, project summaries, work-presence state, or attention rows.

#### Authorization decision

Pending review items are selected only from Projects led by the current member.

Pending revision items are selected only from Outcomes joined by the current member.

The endpoint remains guarded by the existing Supabase authentication guard.

#### Result

The browser receives one stable Home contract while PostgreSQL and existing domain services remain the source of truth.

Working Now continues to mean an active WorkSession rather than realtime presence.

Actual weekly hours remain distinct from the schedule's planned weekly commitment.

#### Integration note

The separate Notifications branch may later add unread-count behavior to the shared sidebar.

Home does not import, duplicate, or depend on unmerged Notifications implementation.


## Known Limitations

No Phase 7 implementation should be considered delivered merely because this journal and the Figma references exist.

Implementation and acceptance evidence must be added here as each slice is completed.

Phase 5 remains independently open for final acceptance and regression.

## Technical Debt

None introduced by the Phase 7 planning and UI-source-of-truth update.

Any notification event that cannot be created atomically with its source domain transition should be documented explicitly when implemented.

## Recommendations and Next Approach

Start with the Notifications backend foundation and event creation.

Then implement the Figma-aligned Notifications inbox and sidebar unread state.

Verify notification navigation and read-state persistence before beginning the Home slice.

After Notifications is stable, build Home as an aggregation surface over canonical data and compare it directly against Figma node `189:3`.

## Phase Exit Result

Not yet complete.

Phase 7 may be marked complete only after Notifications and Home satisfy the acceptance gate, visual verification, required regression checks, and final implementation documentation.
