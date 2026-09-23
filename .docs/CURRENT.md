# Current Prometheus Work

This file is the lightweight handoff point for future development sessions.

Permanent implementation history belongs in `.docs/phases/`.

Canonical requirements belong in `.context/`.

## Current Phase

Phase 7 - Notifications and Home

Status: In progress.

Current slice: Notifications.

Formal implementation record:

`.docs/phases/phase-07-notifications-home.md`

## Current Product Decision

Phase 7 implementation starts with Notifications on its own branch.

Home should be implemented as a separate Phase 7 slice or branch so both surfaces can be developed and verified independently before integration.

The current Prometheus Figma file is the source of truth for UI layout and visual design.

Phase 7 visual references:

- Notifications: Figma node `11:2301`
- Home: Figma node `189:3`

Notifications are accessed through the lower sidebar utility area with an unread-count badge when applicable.

Do not add a separate top-right notification bell or notification control.

Use `.context/ui-reference.md` for the complete UI source-of-truth policy.

## Previous Phase

Phase 6 - Schedule, Work Sessions, and Team

Status: Complete.

Phase 6 is already present on `main`.

Phase 5 - Outcome Work, Submission, Review, and Dependencies remains in progress on its own line of work because final acceptance and regression are still pending.

Do not mark Phase 5 complete from Phase 7 work.

## Verified Baseline

Phase 0 - Foundation: Complete.

Phase 1 - Authentication and Application Shell: Complete.

Phase 2 - Registry: Complete.

Phase 3 - Project Core: Complete.

Phase 4 - Project Workflow Structure: Complete.

Phase 6 - Schedule, Work Sessions, and Team: Complete.

Phase 6 provides the canonical Schedule, WorkSession, and Team data that Phase 7 Home may aggregate.

The Project Members workspace wiring was restored on `main` at `b4d2827` before this Notifications branch started.

## Current Testing Workflow

The repository uses layered verification rather than defaulting all behavior checks to Playwright.

Use Vitest for pure logic, validation, permissions, and service behavior.

Use Vitest with React Testing Library and jsdom for React component interaction.

Use service or API integration tests for authorization, persistence, stale-write protection, concurrency, and notification event creation where a browser is not required.

Use Playwright with Chromium for critical real user journeys that depend on browser, authentication, API, persistence, and navigation integration.

Use Firefox and WebKit only for release-level cross-browser verification unless browser compatibility is the feature under test.

Use `.testcases/phase-07-notifications-home-tests.md` as the Phase 7 acceptance gate.

## Next Action

The `phase-7-notifications` branch started clean from `main` at `b4d2827`.

The Notification Prisma model and additive migration have been prepared after inspecting the authoritative event transactions.

The user ran Prisma validation and client generation successfully on 2026-09-22.

Migration application failed with `P3018` / PostgreSQL `42710` because the target database already has a legacy `NotificationType` enum and `notifications` table.

The existing table has zero rows and an applied earlier Phase 7 migration absent from this branch.

The new migration supports both fresh and legacy databases.

On 2026-09-22, the user revalidated the schema, regenerated Prisma Client, marked the failed attempt rolled back, and deployed the revised migration successfully.

Notification creation is now wired into the existing Project and Outcome transactions with focused tests prepared.

The first focused backend run passed 91 tests and timed out one remote-database integration case at Vitest's 5-second default.

That test has been narrowed to one real submission because retry behavior is covered separately.

The user reran the narrowed submission integration case successfully: one test passed, and three were skipped by the title filter.

Checkpoint C backend event verification is satisfied.

The authenticated Notifications API, shared contracts, and focused API/service/database tests are now prepared.

The user ran the four focused Checkpoint D API/contract/service/database test files on 2026-09-22.

All four files and 12 tests passed.

Checkpoint D focused API verification is satisfied; typechecking and broader regression remain pending.

Figma node `11:2301` was inspected, and the dedicated `/notifications` page, TanStack Query state, event presentation, lazy route, and focused component tests are prepared.

The user ran the focused Notifications page component file on 2026-09-22.

All nine tests passed.

Checkpoint E focused UI verification is satisfied.

The lower-sidebar Notifications unread badge and focused shell/inbox component tests are now prepared.

The user ran the focused shell and inbox component file on 2026-09-22.

All four tests passed.

Checkpoint F focused component verification is satisfied.

The first Checkpoint G command accidentally ran the broad suite because the focused runner forwarded pnpm's leading `--`.

The Phase 7 browser case failed while using servers from another worktree on the default ports; its trace had no Notifications API request.

The runner separator handling and isolated Playwright ports are prepared.

The isolated-port rerun with `-g` ran no tests because a line break entered the quoted title.

The user ran the single-spec focused command without a title filter on 2026-09-22.

Playwright selected one Chromium test and reported one pass in 42.5 seconds.

Checkpoint G is satisfied.

Checkpoint H diff review found that several existing browser fixtures must delete notifications before removing temporary Members; those fixture teardowns have been updated and await verification.

The user ran `pnpm typecheck` on 2026-09-22; it completed successfully with no TypeScript errors.

The user ran the focused Project creation regression on isolated ports 3002 and 5174.

All five Chromium tests in `tests/e2e/projects.spec.ts` passed in 1.0 minute, including the notification-aware fixture teardown.

The user ran the focused Project Member access regression on isolated ports 3002 and 5174.

All four Chromium tests in `tests/e2e/project-member-access.spec.ts` passed in 1.6 minutes, including the notification-aware fixture teardown.

The user ran the focused Outcome Membership regression on isolated ports 3002 and 5174.

All five Chromium tests in `tests/e2e/outcome-membership.spec.ts` passed in 1.2 minutes, including idempotent Outcome joining and the notification-aware fixture teardown.

The first focused Outcome delivery run exposed an existing review-dialog race where feedback blur autosave could consume the Project Lead's revision decision.

The dialog now avoids starting that autosave when focus moves to a decision and waits for any existing draft save before deciding.

A later run exposed one stale exact-case Playwright selector, which was aligned with the current `Review outcome` accessible label.

On 2026-09-23, all 13 Chromium tests in `tests/e2e/outcome-delivery.spec.ts` passed in 2.8 minutes, including the notification-aware fixture teardown.

The first core workflow run passed four tests before stale join/feature selectors timed out in Core 05.

The core test now waits for the join response and joined state, uses the current accessible feature, task, review, and history labels, waits for task persistence, and tolerates browser contexts already closed after a stopped worker while preserving database cleanup.

The user reran Core 01-06 with a title filter on isolated ports 3002 and 5174.

All six selected Chromium tests passed in 51.2 seconds.

The complete core regression then exposed two additional stale semantic locators: the shared review dialog close action and the dependency override reason field.

The shared dialog now derives its close-button accessible name from its stable `ariaLabel` when provided, and the core test uses the current exact override-field label.

One intervening attempt could not reach the remote Supabase pooler and did not exercise application behavior.

On 2026-09-23, the final isolated-port rerun passed all 28 Chromium tests in `tests/e2e/prometheus-core.spec.ts` in 4.8 minutes.

The user ran `pnpm lint` on 2026-09-23; ESLint completed successfully with no reported errors.

The user reran `pnpm typecheck` after the regression fixes on 2026-09-23; all three TypeScript configurations completed successfully with no errors.

Build and manual visual acceptance remain pending.

Preserve the Figma sidebar placement for Notifications and its unread-count treatment.

Do not add a duplicate top-right notification icon.

Keep notification state canonical and server-backed.

After the Notifications slice is stable, implement Home against Figma node `189:3` as a separate slice or branch.

Home should aggregate canonical Projects, Outcome workflow, Schedule, WorkSession, Team, and actionable review data rather than persist duplicate dashboard state.

## Handoff Maintenance Rule

Update this file whenever the active phase changes, a major blocker changes the next action, or a session ends at a materially different point.

Keep this file concise.
