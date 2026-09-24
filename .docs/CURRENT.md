# Current Prometheus Work

This file is the lightweight handoff point for future development sessions.

Permanent implementation history belongs in `.docs/phases/`.

Canonical requirements belong in `.context/`.

## Current Phase State

Prometheus has reached the current release closure boundary.

Phases 0 through 9 are complete for the defined release scope.

The former open statuses for Phases 5, 7, 8, and 9 were reassessed against the integrated implementation and accumulated verification evidence.

Phase 5 is closed around the complete Project/Outcome delivery loop.

Phase 7 is closed around persisted Notifications and the canonical Home command center.

Phase 8 is closed around VisiWork operational visibility and Reports & Analytics with canonical metric definitions.

Phase 9 is closed around durable VisiWork and Project collaboration plus automatic live updates and reconnect recovery.

Binary chat attachments, a dedicated Outcome-specific discussion UI/API, and optional Supabase Realtime push transport are post-release enhancements.
They are not represented as implemented.

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
- Project Chat with replies, search, exact-message navigation, mentions, synchronized mention notifications, author edit/delete, announcements, and Project Activity.
- Automatic live Work Session refresh across Home, Team, and VisiWork.
- Home Quick Access navigation to Reports & Analytics.
- Registry department reference counts and removal diagnostics.

These integrated features are now reflected in finalized phase journals and the release closure record.

## Next Actions

There is no open implementation phase blocking the current release.

Ongoing work is now maintenance or post-release enhancement work:

1. Keep CI green on `main`.
2. Run credential-gated signed-in smoke tests when release identities are configured.
3. Apply Prisma migrations explicitly before deploying schema-dependent code.
4. Treat binary chat attachments and Outcome-specific discussion as separately scoped features if product work resumes.
5. Consider Supabase Realtime only if polling latency or scale becomes a measured problem.
6. Keep `.context/derived-metrics.md`, `.context/authorization.md`, and the deployment/environment runbooks synchronized with behavior changes.

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
