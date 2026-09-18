# Current Prometheus Work

This file is the lightweight handoff point for future development sessions.

Permanent implementation history belongs in `.docs/phases/`.

Canonical requirements belong in `.context/`.

## Current Phase

Phase 6 - Schedule, Work Sessions, and Team

Status: In progress.

Formal implementation record:

`.docs/phases/phase-06-schedule-work-sessions-team.md`

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

Phase 6 Schedule Slice 1 and the integrated Work Sessions plus Team Slice 2 are implemented.

Migration `20260918010000_phase_06_work_sessions` is deployed and all 15 migrations are applied.

Live database integration passes 4 Schedule tests, 5 WorkSession tests, and 2 Team tests.

Focused component coverage passes 10 tests across Schedule, attendance, and Team.

The authenticated Phase 6 Chromium file passes both the Schedule Slice 1 journey and the integrated Schedule, Time In, refresh, Team Working Now, Time Out, and weekly-history journey.

The broad `pnpm verify` gate passes with 139 enabled Node tests, 22 component tests, and both production builds.

The final full Chromium run passed 90 tests, including both Phase 6 journeys.
One pre-existing Phase 4 Project Members test failed because the current Project page does not mount the existing `ProjectMembersPanel`, and its three serial dependents did not run.
Project UI was not changed from this branch.

Manual visual, responsive, and console acceptance must still be recorded before Phase 6 is marked complete.
The Project Members acceptance file should be rerun after its owning Project UI work is integrated.

Do not mark Phase 5 complete from this branch.
Do not add ScheduleOverride or realtime presence without a concrete acceptance requirement.

## Handoff Maintenance Rule

Update this file whenever the active phase changes, a major blocker changes the next action, or a session ends at a materially different point.

Keep this file concise.
