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

The known Project Members regression remains owned by the Project UI work and should not be silently treated as a Phase 7 defect unless Phase 7 changes that surface.

## Current Testing Workflow

The repository uses layered verification rather than defaulting all behavior checks to Playwright.

Use Vitest for pure logic, validation, permissions, and service behavior.

Use Vitest with React Testing Library and jsdom for React component interaction.

Use service or API integration tests for authorization, persistence, stale-write protection, concurrency, and notification event creation where a browser is not required.

Use Playwright with Chromium for critical real user journeys that depend on browser, authentication, API, persistence, and navigation integration.

Use Firefox and WebKit only for release-level cross-browser verification unless browser compatibility is the feature under test.

Use `.testcases/phase-07-notifications-home-tests.md` as the Phase 7 acceptance gate.

## Next Action

Start the Phase 7 Notifications slice from current `main`.

Implement real notification persistence and event creation before building presentation-only state.

Implement the dedicated `/notifications` page against Figma node `11:2301`.

Preserve the Figma sidebar placement for Notifications and its unread-count treatment.

Do not add a duplicate top-right notification icon.

Keep notification state canonical and server-backed.

After the Notifications slice is stable, implement Home against Figma node `189:3` as a separate slice or branch.

Home should aggregate canonical Projects, Outcome workflow, Schedule, WorkSession, Team, and actionable review data rather than persist duplicate dashboard state.

## Handoff Maintenance Rule

Update this file whenever the active phase changes, a major blocker changes the next action, or a session ends at a materially different point.

Keep this file concise.
