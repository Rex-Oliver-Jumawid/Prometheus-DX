# Current Prometheus Work

This file is the lightweight handoff point for future development sessions.

Permanent implementation history belongs in `.docs/phases/`.

Canonical requirements belong in `.context/`.

## Current Phase State

Prometheus now has active work across the remaining open phases rather than one isolated current slice.

Phase 5 - Outcome Work, Submission, Review, and Dependencies - remains in progress because final acceptance and regression closure are still pending.

Phase 7 - Notifications and Home - has both Notifications and Home implemented and integrated on `main`.
It remains open for the remaining phase-level acceptance, visual verification, regression, and documentation closure.

Phase 8 - VisiWork and Reports & Analytics - is in progress.
Both VisiWork and Reports & Analytics are implemented on `main`, but the formal Phase 8 implementation journal and acceptance closure are still required.

Phase 9 - Collaboration, Realtime, and Attachments - is in progress.
VisiWork collaboration already includes persisted General and Department chat, search with message deep links, mentions and mention notifications, message editing and deletion, and automatic refresh behavior.
Project Chat, final realtime transport and reconnect behavior, attachments, and Phase 9 acceptance remain pending.

## Canonical Status

Use `.docs/phases/README.md` as the canonical high-level phase status index.

Use these implementation journals for the active later phases:

- `.docs/phases/phase-07-notifications-home.md`
- `.docs/phases/phase-08-visiwork-reporting.md`
- `.docs/phases/phase-09-collaboration.md`

Use these acceptance gates:

- `.testcases/phase-05-work-review-tests.md`
- `.testcases/phase-07-notifications-home-tests.md`
- `.testcases/phase-08-visiwork-reporting-tests.md`
- `.testcases/phase-09-collaboration-tests.md`

## Current Product Decisions

The current Prometheus Figma file remains the source of truth for UI layout and visual design.

Canonical requirements, user flows, and backend authorization remain the source of truth for product behavior and permissions.

Home, Reports & Analytics, VisiWork, notifications, and collaboration views must derive their business state from canonical persisted records rather than maintain duplicate manually synchronized state.

Work Session state remains the source of truth for Time In and Time Out.
Live presence or polling must not replace Work Sessions.

Collaboration messaging is now broader than Project Chat alone.
Phase 9 covers VisiWork General and Department chat together with Project Chat, search and deep links, mentions, message mutation behavior, realtime delivery, reconnect behavior, notifications, and attachments.

## Recent Integrated Work

The recent `main` baseline includes:

- Figma-aligned Home.
- Figma-aligned Reports & Analytics.
- Figma-aligned VisiWork views.
- VisiWork project disclosure controls.
- VisiWork message search and exact-message navigation.
- @mention persistence and Notifications integration.
- VisiWork message editing and soft deletion.
- Automatic live Work Session refresh across Home, Team, and VisiWork.
- Registry department reference counts and removal diagnostics.

These features being present on `main` do not by themselves mark their phases complete.
Phase completion still requires the matching acceptance gate, required regression, and finalized phase journal.

## Next Actions

1. Finish Phase 7 manual visual and acceptance closure and reconcile the journal with the integrated Home and Notifications state.
2. Re-enable or otherwise reconcile the Home Reports Quick Access control now that `/reports` exists.
3. Execute the Phase 8 acceptance checklist against the integrated VisiWork and Reports & Analytics implementation, then record the actual evidence in the Phase 8 journal.
4. Continue Phase 9 with Project Chat and the remaining realtime and attachment scope while preserving the already delivered VisiWork collaboration behavior.
5. Keep Phase 5 independently open until its own final acceptance and regression work is complete.

## Current Testing Workflow

Use Vitest for pure logic, validation, permissions, and service behavior.

Use Vitest with React Testing Library and jsdom for React component interaction.

Use service or API integration tests for authorization, persistence, stale-write protection, concurrency, and event creation where a browser is not required.

Use Playwright with Chromium for critical real user journeys that depend on browser, authentication, API, persistence, and navigation integration.

Use Firefox and WebKit only for release-level cross-browser verification unless browser compatibility is the feature under test.

Do not infer phase completion from passing focused tests alone.

## Handoff Maintenance Rule

Update this file whenever the active phase state changes, a major blocker changes the next action, or a session ends at a materially different point.

Keep this file concise.
