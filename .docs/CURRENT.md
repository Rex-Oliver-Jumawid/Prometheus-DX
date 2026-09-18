# Current Prometheus Work

This file is the lightweight handoff point for future development sessions.

Permanent implementation history belongs in `.docs/phases/`.

Canonical requirements belong in `.context/`.

## Current Phase

Phase 7 - Notifications and Home

Status: In progress.

The notification backend and persistence foundation, Notifications UI, notification navigation, and shell bell/unread integration are delivered.
Phase 7 is not complete.

Formal implementation record:

`.docs/phases/phase-07-notifications-home.md`

## Previous Phase

Phase 5 - Outcome Work, Submission, Review, and Dependencies

Status: In progress on its own branch and not marked complete here.

## Verified Baseline

Phase 0 - Foundation: Complete.

Phase 1 - Authentication and Application Shell: Complete.

Phase 2 - Registry: Complete.

Phase 3 - Project Core: Complete.

Phase 4 - Project Workflow Structure: Complete.

Final Phase 4 verification on 2026-09-16:

- Full Playwright suite: 35/35 passed.
- The full suite includes F2-21, the Phase 4 Stage and Outcome workflow, Outcome joining and permanent membership, derived Project Membership, Project Member access management, the canonical Phase 4 main E2E flow, Phase 3 Project regressions, and Registry regressions.
- `pnpm prisma migrate status`: seven migrations found and the database schema is up to date.
- `pnpm verify`: passed.
- Unit tests: 84/84 passed across 13 test files.
- Typecheck: passed.
- Production web and API builds: passed.
- Lint: zero errors with one pre-existing `RegistryPage.tsx` React Hook dependency warning.

## Phase 4 Delivered Scope

Phase 4 now provides persisted ordered Stages and Outcomes, responsible Departments, Acceptance Criteria, same-Project prerequisites, direct Outcome access, permanent Outcome Membership, derived Project Membership, Participating classification, a Project Members interface, and persisted `CAN_VIEW` / `CAN_EDIT` access management.

Only the persisted Project Lead may create or manage Stages and Outcomes or change Project Member access.

Project Leads and Project Members with `CAN_EDIT` may change Project status.

`CAN_EDIT` does not grant Stage, Outcome, Project Member access-management, Registry, or Project Lead authority.

Administrator role and Project creator history remain separate from project-specific authority.

Outcome Membership remains permanent and is the source of Project participation.

## Current Testing Workflow

The repository now uses layered verification rather than defaulting all behavior checks to Playwright.

Use Vitest for pure logic, validation, permissions, and service behavior.

Use Vitest with React Testing Library and jsdom for React component interaction.

Use service or API integration tests for authorization, persistence, stale-write protection, and concurrency where a browser is not required.

Use Playwright with Chromium for critical real user journeys that depend on browser, authentication, API, and persistence integration.

Use Firefox and WebKit only for release-level cross-browser verification unless browser compatibility is the feature under test.

Use `.testcases/` for the phase acceptance requirements and preserve manual visual or UX checks where human judgment is intentional.

The normal broad gates are `pnpm verify`, `pnpm verify:e2e`, and `pnpm verify:release`.

## Next Action

Implement Home aggregation and Home UI as the next bounded Phase 7 slice.

Migration `20260918020000_phase_07_notifications` is deployed and all 16 migrations are applied.
The four required notification events, authenticated inbox APIs, idempotency constraint, Notifications UI, shell unread indicators, persisted read behavior, and focused Chromium notification journey pass.

Do not start Home aggregation or Home UI in the notification UI slice.
Do not mark Phase 5 complete from this branch.
Do not add Chat, realtime messaging, presence, attachments, announcements, or Phase 9 behavior.

## Handoff Maintenance Rule

Update this file whenever the active phase changes, a major blocker changes the next action, or a session ends at a materially different point.

Keep this file concise.
