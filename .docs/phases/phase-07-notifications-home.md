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

## Notifications Database Foundation

The `Notification` Prisma model and migration `20260922010000_phase_07_notifications` have been added.
The user ran `pnpm prisma:validate && pnpm prisma:generate` successfully on 2026-09-22.
Prisma reported the schema valid and generated Prisma Client v6.19.3.
The user ran `pnpm prisma:migrate:deploy` on 2026-09-22; it failed with Prisma `P3018` and PostgreSQL `42710` because type `NotificationType` already exists in the target database.
That first deployment did not apply the migration.
Repository migration history contains no earlier `NotificationType` declaration.
The user's read-only inspection confirmed a pre-existing `notifications` table using `NotificationType` with four values: `OUTCOME_JOINED`, `SUBMISSION_CREATED`, `REVISION_REQUESTED`, and `OUTCOME_ACCEPTED`.
The legacy table lacked the new `data` column, and the first attempt left a failed `_prisma_migrations` record.
The second read-only inspection found zero rows, no duplicate event keys, active row-level security, and compatible existing foreign keys and uniqueness.
The earlier table came from applied migration `20260918020000_phase_07_notifications`, which is absent from this branch's tracked history.
The current migration now adopts that table additively while also creating the complete schema on a fresh database.
The user then ran `pnpm prisma:validate`, `pnpm prisma:generate`, `pnpm exec prisma migrate resolve --rolled-back 20260922010000_phase_07_notifications`, and `pnpm prisma:migrate:deploy` successfully on 2026-09-22.
Prisma reported the revised schema valid, generated Prisma Client v6.19.3, marked the failed attempt rolled back, and applied `20260922010000_phase_07_notifications`.
The model relates each notification to its recipient and optional actor, Project, and Outcome.
It stores type, a stable event key, small JSON display metadata, creation time, and a nullable read time.
The unique recipient and event-key pair prevents duplicate delivery of one source event to one recipient.
Indexes support newest-first inbox retrieval, unread filtering, and relation lookups.
The migration enables row-level security and revokes direct `anon` and `authenticated` table access, following existing protected-table conventions.

## Domain Event Mapping

The source transactions and intended recipients were inspected before the schema was added.
The eight listed events are now wired into their authoritative service transactions.
Focused backend event verification passed after the one timed-out remote integration case was narrowed and rerun successfully.

| Event | Authoritative operation and source identity | Intended recipient |
| --- | --- | --- |
| Project Lead assigned | `ProjectsService.createProject`; new Project ID | New Project Lead, unless the creator is the Lead |
| Project Member access changed | `ProjectWorkflowService.updateProjectMemberAccess`; new access-history ID | Affected Project Member, unless they are the actor |
| Outcome joined | `ProjectWorkflowService.joinOutcome`; Outcome ID plus joining Member ID | Project Lead, unless they joined themselves |
| Submission created | `OutcomeDeliveryService.submit`; new Submission ID and existing request ID | Project Lead, unless they submitted themselves |
| Revision requested | `OutcomeDeliveryService.requestRevision`; new revision-request ID | Current Outcome Members, excluding the Lead actor |
| Outcome accepted | `OutcomeDeliveryService.accept`; new acceptance ID | Members in the acceptance snapshot, excluding the Lead actor |
| Outcome reopened | `OutcomeDeliveryService.reopen`; reopened acceptance ID | Current Outcome Members, excluding the Lead actor |
| Dependency unlocked | `OutcomeDeliveryService.accept` or `overrideDependency`; triggering acceptance or override ID plus dependent Outcome ID | Current members of the dependent Outcome, excluding the actor |

Each listed mutation already uses a database transaction, so notification creation can join the source transaction.
The writer deduplicates recipient IDs, removes the actor, orders recipients deterministically, and uses `createMany` with `skipDuplicates` behind the unique recipient/event-key constraint.
The submission operation already uses a request ID and returns early for an identical retry.
Outcome joining now uses `createMany` with `skipDuplicates`; only a newly created membership writes activity and a notification.
Access changes use a conditional update before creating history, avoiding duplicate transition records from racing identical requests.
Dependency overrides return without a new event when already resolved.
Revision requests and acceptances have distinct history rows for legitimate repeated events.
Acceptance checks affected dependent Outcomes after the prerequisite transition and notifies only those whose final unresolved edge was resolved.
An override notifies dependent Outcome Members only when it changes that Outcome from locked to unlocked.
Dependency unlock keys distinguish the triggering acceptance from an override and include the dependent Outcome ID.

`server/notifications/notification-writer.ts` is a narrow transaction writer, not a second event store or an asynchronous event bus.
The Project, workflow, and Outcome delivery services call it before their source transactions commit.
The join operation now writes its canonical `OUTCOME_JOINED` activity record within that transaction as well.

Project status changes have no recipient rule in the initial notification-targeting table and are deferred pending a product rule.
Mentions and replies depend on Phase 9 collaboration functionality and are deferred.
Lead reassignment is documented as a future workflow but has no supported mutation in the current service surface; assignment wiring in this slice will cover Project creation.

## Notifications API

The `NotificationsModule` is registered in the NestJS application and uses the existing Supabase authentication guard and current-member resolver.
The global `/api` prefix makes its routes `GET /api/notifications`, `GET /api/notifications/unread-count`, `PUT /api/notifications/:id/read`, and `PUT /api/notifications/read-all`.
The inbox supports `filter=all` and `filter=unread`, defaults to All, and rejects extra query parameters such as a caller-supplied member ID.
The shared Zod contract returns typed notification, actor, Project, Outcome, access-change metadata, timestamps, count, and mutation response fields.
Project and Outcome context is loaded in the list query, and sorting uses `createdAt DESC, id DESC` so tied timestamps are deterministic.
All reads and mutations scope database queries to the authenticated recipient ID; administrator and Project Lead roles provide no broader inbox authority.
Marking one notification read retains its first persisted read timestamp on retries and returns not found for another member's record.
Mark all read changes only current unread rows and returns an update count, including zero when there is nothing to change.
The current API returns the full recipient list without pagination; this matches the initial inbox requirement but may need a bounded cursor as volume grows.

The API contract, controller, service, and database integration tests have been added in `shared/contracts/notification.test.ts`, `server/notifications/notifications.controller.test.ts`, `server/notifications/notifications.service.test.ts`, and `server/notifications/notifications.service.integration.test.ts`.
They cover query validation, authenticated member forwarding, recipient isolation, joined display context, deterministic tie ordering, unread counts, idempotent single and bulk reads, and zero unread state.
The user ran `RUN_DATABASE_INTEGRATION=1 pnpm exec vitest run shared/contracts/notification.test.ts server/notifications/notifications.controller.test.ts server/notifications/notifications.service.test.ts server/notifications/notifications.service.integration.test.ts` on 2026-09-22.
All four test files passed, with 12 tests passing in total.
Checkpoint D focused API verification passed at that stage; typechecking and related regressions were subsequently completed as recorded in Checkpoint H.

## Notifications Inbox UI

Figma node `11:2301` was inspected through the connected Figma integration before frontend implementation.
The existing shell already provides the glass panel, sidebar utility area, and separate Time In/Out control seen in that frame.
The `/notifications` placeholder has been replaced with a lazy-loaded React feature.
The inbox uses typed `apiFetch` responses and TanStack Query keys under `['notifications']` for All, Unread, and unread count.
Read mutations cancel notification queries, snapshot the relevant list and count caches, update those caches optimistically, restore them on failure, and invalidate only notification queries after settlement.
The inbox renders loading, populated All and Unread, empty inbox, filtered-empty Unread, failure and retry, missing linked context, and zero-unread states.
Notification rows use typed event-specific presentation copy, actor and relational Project/Outcome context, relative timestamps, a category pill, and the Figma unread accent and dot.
The three notification row icons were downloaded from the inspected Figma frame into `public/icons/notifications/`.
Clicking a linked unread row marks it read before using React Router navigation to the existing Project or Outcome route.
If that write fails, the inbox stays open and its optimistic read state is restored so the failure is visible.
A row without a linked Project remains visible and can still be marked read without inventing a destination.
The inbox uses the shell's existing responsive scroll container and includes narrow-screen row and header layouts.

The Figma mockup includes Mentions and Projects tabs, example mention/reply records, and static counts.
This slice implements the required All and Unread filters against real records; mention and reply records depend on Phase 9 collaboration work and are deferred.
The Projects tab is deferred from this slice's initial API/UI scope; Project and Outcome event rows still appear in All and Unread.
Exact visual parity and responsive quality remain pending manual browser comparison against node `11:2301`.

`src/features/notifications/NotificationsPage.test.tsx` was added for loading, empty states, filter switching, unread treatment, navigation, read mutations, rollback, missing context, and retry.
The user ran `pnpm exec vitest run --config vitest.ui.config.ts src/features/notifications/NotificationsPage.test.tsx` on 2026-09-22.
The focused UI run passed: one test file and all nine tests passed.
Checkpoint E focused component verification is satisfied.
The browser journey, typechecking, and targeted regressions subsequently passed as recorded below; manual visual comparison remains pending.

### Loading skeleton follow-up

The centered loading spinner was replaced with a four-row notification skeleton that reuses the real card, icon, copy, and timestamp layout.
The results container retains its existing tab-panel semantics, while an accessible loading status announces the pending inbox without exposing decorative placeholder rows to screen readers.
At widths up to 520 px the placeholder list displays three rows and follows the same two-column layout and stacked timestamp treatment as real mobile notification cards.
The shimmer animation respects `prefers-reduced-motion`.
The existing component loading test now checks four skeleton rows, the busy status, absence of premature empty-state content, and removal of the placeholders once the inbox resolves.
The user pulled commit `cb9dceb` and ran `pnpm exec vitest run --config vitest.ui.config.ts src/features/notifications/NotificationsPage.test.tsx` on 2026-09-23.
The focused UI verification passed: one test file and all nine tests passed in 2.22 seconds, including the updated loading skeleton test.
Vite displayed its existing CJS Node API deprecation warning; no tests failed.
The user ran `git pull --ff-only` and `pnpm build:web` on 2026-09-23 after the focused UI test. Vite 6.4.3 completed the production web build successfully (209 modules transformed, 2.27 seconds), including `NotificationsPage-6dp1ch8h.js` (8.15 kB, gzip 2.61 kB) and `NotificationsPage-0Q2Tbf9N.css` (7.15 kB, gzip 2.01 kB). The existing 756.20 kB main JavaScript chunk warning is non-fatal and separate from this UI-only change. Throttled-network desktop/mobile visual inspection of the new skeleton remains pending.

## Sidebar Unread Badge

The existing lower-sidebar Notifications utility link now observes the same `notificationKeys.unreadCount` TanStack Query entry used by the inbox.
The badge is hidden at zero and displays the persisted unread count above zero.
The link's accessible name includes the unread count, and the badge remains positioned on the collapsed tablet sidebar while mobile navigation retains its existing open and close behavior.
The count query refetches on window focus and every 60 seconds so notifications created by another member eventually appear without adding Phase 9 realtime functionality.
Read mutations optimistically update the same count cache and then reconcile it with the server.
The existing utility navigation function still owns Registry visibility, and no top-right notification control was added.

`src/features/shell/AppShell.notifications.test.tsx` was added to check zero and nonzero badges, Administrator and Member utility visibility, mobile navigation, individual read updates, and Mark all updates with the real shell and inbox mounted together.
The user ran `pnpm exec vitest run --config vitest.ui.config.ts src/features/shell/AppShell.notifications.test.tsx` on 2026-09-22.
The focused shell run passed: one test file and all four tests passed.
Checkpoint F focused component verification is satisfied.
Typechecking and the targeted regression suite subsequently passed as recorded below; manual visual comparison remains pending.

## Focused Browser Journey

`tests/e2e/phase7-notifications.spec.ts` now covers one isolated Chromium journey with separate authenticated Worker and Project Lead accounts.
The test creates a Project and Outcome fixture, submits output through the Worker UI, checks the Lead's unread sidebar badge and notification, opens the canonical Outcome route, uses browser Back, and reloads the inbox to confirm persisted read state.
The fixture removes its notifications before deleting its members because notification recipient and actor foreign keys intentionally restrict Member deletion.
Checkpoint G browser verification was pending at test creation; the isolated-port focused rerun below subsequently passed.
The first user invocation of `pnpm test:e2e:focused -- tests/e2e/phase7-notifications.spec.ts -g "submission notification opens Outcome"` unexpectedly selected 297 tests because the focused runner forwarded pnpm's literal leading `--` to Playwright.
That broad run reported 38 passed, 42 failed, and 217 not run; Firefox and WebKit were not installed, and several unrelated Chromium tests also failed.
The Phase 7 Chromium case failed while waiting for the unread badge.
Its retained trace showed the Lead's browser made no Notifications API request, and process inspection showed the reused Vite and API servers were running from a different Prometheus worktree.
The focused runner now removes the leading separator, and Playwright plus Vite accept explicit test ports so this worktree can start its own API and web servers without disrupting the other worktree.
The focused journey had not passed at that point, so the correction required a user rerun.
The user then invoked the isolated-port focused runner with a line break inside the quoted `-g` title.
Playwright reported `No tests found` and ran no tests because the title regex contained that line break.
The next run omitted `-g`; `tests/e2e/phase7-notifications.spec.ts` contains only the intended journey.
The user ran `E2E_API_PORT=3002 E2E_WEB_PORT=5174 pnpm test:e2e:focused -- tests/e2e/phase7-notifications.spec.ts` on 2026-09-22.
Playwright selected one test and reported `1 passed (42.5s)`.
Checkpoint G focused Chromium verification is satisfied; typechecking, regression review, and manual visual acceptance remain pending.

## Checkpoint H Diff Review

The Notifications diff touches Prisma persistence, Project and Outcome transactions, authenticated API contracts, lazy routing, the shared shell, and isolated Playwright server configuration.
The existing browser fixtures for Project creation, Project Member access, Outcome joining, Outcome delivery, and the core workflow can now create notifications for temporary Members.
Notification recipient and actor foreign keys intentionally restrict Member deletion, so those fixtures now delete their Project's notifications before deleting the Project and temporary Members.
The core workflow fixture also uses the configured Playwright base URL instead of a hard-coded port, allowing isolated-port runs to test this worktree.
The user ran `E2E_API_PORT=3002 E2E_WEB_PORT=5174 pnpm test:e2e:focused -- tests/e2e/projects.spec.ts` on 2026-09-22.
All five Chromium Project tests passed in 1.0 minute, verifying Project creation regression and its notification-aware fixture teardown.
The user then ran `E2E_API_PORT=3002 E2E_WEB_PORT=5174 pnpm test:e2e:focused -- tests/e2e/project-member-access.spec.ts`.
All four Chromium Project Member access tests passed in 1.6 minutes, verifying access transitions, authority isolation, the main Phase 4 workflow, and its notification-aware fixture teardown.
The user then ran `E2E_API_PORT=3002 E2E_WEB_PORT=5174 pnpm test:e2e:focused -- tests/e2e/outcome-membership.spec.ts`.
All five Chromium Outcome Membership tests passed in 1.2 minutes, verifying idempotent Outcome joining, derived Project Membership, lifecycle restrictions, and the notification-aware fixture teardown.
The first focused Outcome delivery run passed seven tests before exposing an existing review-dialog race: blurring the feedback field started draft autosave, and the shared busy guard then discarded the Project Lead's revision decision without sending its request.
`OutcomeReviewDialog` now avoids blur autosave when focus moves directly to a decision and waits for any in-flight draft save before deciding.
The next run passed nine tests before exposing one stale exact-case Playwright selector, which was aligned with the current `Review outcome` accessible label.
On 2026-09-23, the user reran `E2E_API_PORT=3002 E2E_WEB_PORT=5174 pnpm test:e2e:focused -- tests/e2e/outcome-delivery.spec.ts`.
All 13 Chromium Outcome delivery tests passed in 2.8 minutes, verifying submission, revision, acceptance, reopening, dependency behavior, and the notification-aware fixture teardown.
The first complete core workflow attempt passed four tests before Core 05 timed out on stale join and Feature selectors.
The captured worker page showed that Outcome joining succeeded, so the core test was synchronized with the join response and joined UI state, current accessible Feature, Task, review, and history labels, and Task persistence.
Its context cleanup now tolerates contexts already closed after a stopped worker while continuing the notification-first database cleanup.
The user reran `E2E_API_PORT=3002 E2E_WEB_PORT=5174 pnpm test:e2e:focused -- tests/e2e/prometheus-core.spec.ts -g "Core 0[1-6]:"`.
All six selected Chromium tests passed in 51.2 seconds, directly verifying the corrected Core 05 path and adjacent Task flow.
The complete core regression next exposed stale semantic locators for the shared review-dialog close button and dependency override reason field.
The shared dialog close button now derives its accessible name from the dialog's stable `ariaLabel` when present, and the test uses the current exact override-field label.
One intervening attempt could not reach the remote Supabase pooler and did not exercise application behavior.
On 2026-09-23, the user reran `E2E_API_PORT=3002 E2E_WEB_PORT=5174 pnpm test:e2e:focused -- tests/e2e/prometheus-core.spec.ts`.
All 28 Chromium core workflow tests passed in 4.8 minutes, verifying the complete serial Project and Outcome lifecycle and notification-aware fixture cleanup.
The user ran `pnpm typecheck` on 2026-09-22.
The command completed successfully across `tsconfig.app.json`, `tsconfig.server.json`, and `tsconfig.node.json`, with no TypeScript errors reported.
The user ran `pnpm lint` on 2026-09-23.
ESLint completed successfully with no reported errors.
The user reran `pnpm typecheck` after the browser-regression fixes on 2026-09-23.
The app, server, and Node TypeScript configurations completed successfully with no errors.
The user subsequently ran `pnpm build` on 2026-09-23. Vite reported a successful production web build (209 modules transformed, 2.15 seconds), including a separate Notifications page chunk. The first API build's exit status was not captured because the terminal crashed. The user reran `pnpm build:api && echo "API BUILD PASSED"` in the clean `phase-7-notifications` worktree on 2026-09-23; `tsc -p tsconfig.build.json` completed and the explicit success marker appeared. The Vite warning about a 756.20 kB main JavaScript chunk is non-fatal and should be assessed separately as a performance concern; it is not specific to the 7.06 kB Notifications page chunk.
The GitHub branch's Vercel deployment reported success for commit `5a92b11`, which does not independently establish local API build exit status or manual Figma fidelity.
The user confirmed their local `phase-7-notifications` HEAD and `origin/phase-7-notifications` both point to `5a92b11` with a clean working tree.
The final source review found no need to repeat the successful focused tests. The local API build exit status has since been confirmed; manual browser comparison remains open.
A full browser suite is not warranted by this diff review; the accidental broad run used another worktree's servers and included uninstalled Firefox and WebKit browsers, so it is not reliable Phase 7 regression evidence.
Manual comparison against Figma node `11:2301` remains pending.

### Manual visual review: desktop empty inbox (2026-09-23)

The user supplied a local Chrome responsive screenshot of `/notifications` at a 1244 × 682 viewport.
The screen renders the authenticated sidebar, Notifications utility link, page heading, Mark all as read, All/Unread tabs, zero unread count, and the intentional empty-inbox state. The shell and main-panel geometry are broadly aligned with Figma node `11:2301`; there is no visible top-right notification bell.

The screenshot does **not** establish populated-row fidelity, unread-badge appearance, read/navigation behavior, error/retry behavior, or mobile responsiveness because the inbox contains zero notifications and only desktop was shown.

Visible differences compared with the live Figma reference:
- The shared shell uses `/backgrounds/editorial-gradient.webp` (strong coral on the left and cool blue at the lower right), whereas the current Figma Notifications frame uses a substantially lighter, near-white `#f5f1ed` background with subtler warm surface tones. Treat this as an open design-fidelity decision; do not restyle the shared shell globally without checking its other approved page frames.
- The Figma frame includes a Reports & Analytics primary navigation item, currently outside this branch's Phase 7 implementation scope.
- The Figma sample contains Mentions and Projects filters and populated example rows; All/Unread only, with those additional filters intentionally deferred, is documented above.

That empty-inbox review was followed by a populated desktop screenshot and 390 × 844 responsive screenshots, recorded below.

### Manual visual review: populated inbox and mobile navigation (2026-09-23)

The user opened the Phase 7 worktree's application and created a submission using a different Member from the Project Lead.
At desktop width, the Project Lead's Notifications page displayed one unread `SUBMISSION_CREATED` item with the submitter and Outcome context, a relative timestamp, an orange unread dot and left accent, All = 1, Unread = 1, and a matching orange sidebar badge = 1.
This verifies the visible populated-row and unread presentation with a real user-generated event; it does not by itself verify Mark all as read or persistence after navigating back.

At 390 × 844, the user supplied a screenshot showing the responsive Notifications page with the menu button, a single notification row, All/Unread controls, wrapped notification copy, and the timestamp below the text.
A second screenshot shows the mobile sidebar **open**: primary navigation, Registry, the active Notifications utility item, and the profile area are present inside the drawer while the inbox remains behind it.
The developer-tools viewport was scaled to fit the desktop display, so assess native-size readability separately if necessary.
The screenshots verify that the mobile drawer opens; they do not independently prove it closes on button press, backdrop click, or navigation.

Open acceptance checks: close the mobile drawer and verify the backdrop/navigation behavior; click the actual notification, confirm correct Outcome navigation and persisted read state after Back/reload; inspect a medium-width viewport if desired; and decide whether the stronger shared-shell background is acceptable relative to Figma.
The legacy Figma mockup's Mentions and Projects tabs remain intentionally deferred as documented above.
Do not merge or mark manual visual acceptance complete until these remaining interactive checks and material visual decisions are resolved.

### Final manual acceptance checklist

- Compare the authenticated Notifications screen at the Figma reference size (1244 × 682), a medium viewport, and a narrow/mobile viewport.
- Confirm lower-sidebar Notifications placement, orange unread badge, profile placement, and no duplicate top-right notification control.
- Check the glass panel, header, All/Unread tabs, notification rows, read/unread accents, and responsive spacing against Figma.
- Exercise a real account with no notifications and one with unread records; mark one and all as read, refresh, and confirm server-backed persistence.
- Verify navigation to a Project and an Outcome, browser Back/Forward, keyboard focus, and long-name wrapping.
- Verify loading, filtered-empty, error/retry, and unavailable linked-context states without horizontal overflow or clipped controls.
- Record screenshots, browser/viewport, discrepancies, and any accessibility defects here before merging.
- Confirmed: the user reran `pnpm build:api && echo "API BUILD PASSED"` and received the explicit success marker.

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

### P7-D03 - Source-event keys and relational notification context

**Status:** Implemented and focused backend event verification passed.
**Area:** Database / Backend.
**Impact:** High.

#### What gave us a hard time

Some operations have a dedicated history row, while Outcome joining is represented by a composite membership key and dependency unlocking is derived from more than one edge.

#### Root cause / constraint

Notification retries must not duplicate an event, but distinct revisions, acceptances, reopenings, and later unlocks must remain visible.

#### Options considered

1. Use rendered text or a timestamp as the deduplication key.
2. Build a second generic event store.
3. Use a stable key derived from the authoritative operation and enforce uniqueness per recipient.

#### Proposed solution

Store an `event_key` beside typed and relational notification context, and derive its value at each existing transaction boundary.

#### Decision

Use the third option with `UNIQUE(recipient_member_id, event_key)`.

#### Why we chose it

Existing source records already distinguish most repeated domain events, and the remaining composite identities can be encoded without a duplicate state machine.

#### Result

The Prisma model passed validation, and the migration was applied after recovery from the legacy database state.

#### What we learned

The source operation, rather than notification copy, must define event identity.

#### Next approach

Verify the authenticated API and then connect the inbox UI to the resulting typed contract.

#### Related changes

`prisma/schema.prisma`, `prisma/migrations/20260922010000_phase_07_notifications/migration.sql`, and `.context/data-model.md`.

### P7-D04 - Adopt a legacy notification table without losing data

**Status:** Resolved.
**Area:** Database.
**Impact:** High.

#### What gave us a hard time

The target database contained a `NotificationType` enum and `notifications` table from applied migration `20260918020000_phase_07_notifications`, even though the current branch started from `main` without Phase 7 source code or that migration file.
The first deployment failed before applying the new migration.

#### Root cause / constraint

The database and tracked migration history differ because an earlier Phase 7 branch had been applied to this database.
The old table is empty but has a compatible event-key uniqueness constraint and row-level security.

#### Options considered

1. Drop the legacy table and enum, then run a fresh-only migration.
2. Reuse the old branch migration and implementation.
3. Make this branch's migration create the schema on a fresh database and adopt the old table when present.

#### Proposed solution

Use the third option, adding missing enum values and display metadata, making Project context nullable, and aligning indexes and foreign-key deletion behavior within one database transaction.

#### Decision

The tracked migration now supports both database states without dropping notification rows or reviving old application code.
The event-key length is 200 characters, matching the legacy table and avoiding a narrowing conversion.

#### Why we chose it

This keeps the new implementation independent from the old branch while preserving any notification rows in another environment with the same legacy schema.

#### Result

The user revalidated the schema, regenerated Prisma Client, marked the failed attempt rolled back, and deployed the revised migration successfully.

#### What we learned

A clean Git branch does not imply a clean target database.

#### Next approach

Inspect database state before modifying a migration that collides with untracked objects, then verify recovery and deployment before wiring domain events.

#### Related changes

`prisma/schema.prisma` and `prisma/migrations/20260922010000_phase_07_notifications/migration.sql`.

### P7-D05 - Preserve review decisions across draft autosave

**Status:** Resolved and browser-verified.
**Area:** Frontend / Testing.
**Impact:** Medium.

#### What gave us a hard time

Focused Outcome delivery regression timed out after the Project Lead entered revision feedback and clicked the revision decision.
No revision request reached the API.

#### Root cause / constraint

Moving focus from the feedback field to the decision button triggered blur autosave first.
The review dialog used one busy guard for autosave and decisions, so the decision handler silently returned while the draft mutation was active.

#### Options considered

1. Increase the Playwright timeout or retry the click.
2. Remove feedback autosave.
3. Prevent decision-button focus changes from starting redundant autosave and serialize decisions behind an already-running save.

#### Proposed solution

Use the third option so draft persistence remains available without losing an explicit Project Lead decision.

#### Decision

The dialog skips blur autosave when focus moves into its decision actions, tracks the active draft-save promise, and awaits that promise before a decision proceeds.

#### Why we chose it

The fix preserves both behaviors and addresses the real browser event order rather than masking it in the test.

#### Result

The original revision-request journey passed on the next run.
After correcting one separate stale exact-case selector, all 13 Outcome delivery Chromium tests passed in 2.8 minutes.

#### What we learned

Autosave and explicit workflow decisions need coordination beyond a shared boolean guard because blur can run before click.

#### Next approach

When a form autosaves on blur, treat navigation and decision controls as coordinated transitions and verify their real browser event order.

#### Related changes

`src/features/projects/OutcomeReviewDialog.tsx` and `tests/e2e/outcome-delivery.spec.ts`.

### P7-D06 - Synchronize the core journey with current semantic UI contracts

**Status:** Resolved and browser-verified.
**Area:** Testing / Frontend.
**Impact:** Medium.

#### What gave us a hard time

The serial core workflow repeatedly timed out after earlier steps had succeeded.
The captured pages showed the intended product state, but several test locators still described older visible labels or did not wait for the authoritative mutation response.

#### Root cause / constraint

The Phase 7 branch baseline did not include later Phase 5 regression fixes that synchronized the core journey with the current Outcome workspace.
Because the suite intentionally builds one long workflow, each stale step prevented all later steps from running.

#### Options considered

1. Increase timeouts or use broad text matching.
2. Skip the affected core steps.
3. Align exact accessible locators with current UI contracts and wait for source mutations before asserting dependent state.

#### Proposed solution

Use the third option while retaining the serial acceptance journey and notification-aware cleanup.

#### Decision

The test now waits for Outcome joining and Task creation, uses current Feature, Task, review, history, and override labels, and tolerates browser contexts already closed after a stopped worker.
The shared dialog close action uses the stable dialog `ariaLabel` when present.

#### Why we chose it

This preserves meaningful accessibility-based assertions and deterministic workflow sequencing without weakening product behavior or hiding failures with retries.

#### Result

The focused Core 01-06 rerun passed six tests in 51.2 seconds.
After the remaining semantic locators were reconciled, the complete 28-test Chromium core workflow passed in 4.8 minutes.

#### What we learned

Serial browser journeys require explicit synchronization at every state-changing boundary, and accessible names function as test contracts that must follow intentional UI changes.

#### Next approach

When current UI and a long acceptance test diverge, inspect the captured page first, then update exact semantic locators and mutation waits together before rerunning the full journey.

#### Related changes

`src/features/projects/ProjectDialog.tsx` and `tests/e2e/prometheus-core.spec.ts`.

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

A subsequent desktop visual review identified two layout issues in the first Home rendering: the main glass workspace started 6px lower than the sidebar, and the right-side Working Now / Needs Attention / Quick Access stack stayed at fixed compact heights on taller viewports.

The shell now uses the same 12px top and bottom inset for both sidebar and main workspace.

Home now fills the available desktop workspace height.

The main dashboard grid stretches vertically, Working Now and Needs Attention use flexible rows with internally scrolling content, Quick Access remains compact, and taller desktop viewports increase the inter-card gaps without changing the fixed-height scrolling behavior at the Figma reference size.

A later visual refinement established one shared desktop Home right-edge gutter for the header, summary row, and lower dashboard so the My Week card and the three right-column panels stay on the same vertical boundary while clearing the outer glass edge and attendance handle.

The Home loading state now renders a layout-preserving dashboard skeleton instead of a centered loading card.

The skeleton mirrors the final header, four summary cards, project panel, Working Now, Needs Attention, and Quick Access geometry without displaying fake statistics.

The Home query now forwards TanStack Query's AbortSignal to the API request so abandoned Home requests can be cancelled cleanly.

Notifications remains a separate parallel slice and is not implemented or assumed by this Home branch.

### P7-D07 - Home uses a narrow derived read model

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
