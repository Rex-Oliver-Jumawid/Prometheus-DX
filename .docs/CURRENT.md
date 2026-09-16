# Current Prometheus Work

This file is the lightweight handoff point for future development sessions.

Permanent implementation history belongs in `.docs/phases/`.

Canonical requirements belong in `.context/`.

## Current Phase

Phase 5 - Outcome Work, Submission, Review, and Dependencies

Status: In progress.

Formal implementation record:

`.docs/phases/phase-05-work-review.md`

## Previous Phase

Phase 4 - Project Workflow Structure

Status: Complete.

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

## Next Action

Phase 5 work, submission, review, acceptance, reopening, and dependency slices are implemented.
The initial distinct-account core browser suite passes 18/18 tests.
The latest `pnpm verify` passes 106/106 tests, typecheck, lint, and both builds.
Prisma generation/validation pass and all 13 migrations are applied.
Expanded edge-case browser coverage, final full regression, screenshot review, and formal acceptance closure remain outstanding.
The prerequisite-reopening rule is now documented in `.context/data-model.md`: unfinished dependents relock, explicit overrides remain effective, and accepted dependents retain acceptance.

Before continuing Phase 5:

1. Read `AGENTS.md`.
2. Read this file.
3. Read `.agents/skills/prometheus-phase-delivery/SKILL.md`.
4. Read `.agents/skills/prometheus-database-change/SKILL.md` before any Prisma or migration work.
5. Read `.context/phases.md`, especially Phase 5.
6. Read the Phase 5 portions of `.context/data-model.md`, `.context/user-flows.md`, and the SRS.
7. Read `.testcases/phase-05-work-review-tests.md`.
8. Read the live Phase 5 implementation journal.
9. Preserve the completed Phase 0 through Phase 4 regression baseline.

Do not treat Phase 5 as complete until all slices and the full regression/acceptance gate pass.

## Handoff Maintenance Rule

Update this file whenever the active phase changes, a major blocker changes the next action, or a session ends at a materially different point.

Keep this file concise.
