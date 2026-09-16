# Current Prometheus Work

This file is the lightweight handoff point for future development sessions.

Permanent implementation history belongs in `.docs/phases/`.

Canonical requirements belong in `.context/`.

## Current Phase

Phase 4 - Project Workflow Structure

Status: In progress.

Active internal slice: Slice 4 - Project Member access management.

## Previous Phase

Phase 2 - Registry

Status: Complete

Formal closure record:

`.docs/phases/phase-02-registry-closure.md`

The older `In progress` and `Not complete` text retained in `.docs/phases/phase-02-registry.md` is historical and is superseded by the closure addendum.

## Verified Baseline

Phase 0 - Foundation: Complete.

Phase 1 - Authentication and Application Shell: Complete.

Phase 2 - Registry: Complete.

Final Phase 2 verification:

- Focused Registry Member Playwright test: 1/1 passed.
- Full Playwright suite: 15/15 passed, including the persisted non-admin Project Lead Registry regression.
- `pnpm verify`: passed with 42 unit tests and both production builds.
- `pnpm prisma migrate status`: all six migrations applied and database schema is up to date.
- Registry is Administrator-only at both frontend route/navigation and backend API boundaries.
- Member Department relationships are required and `members.department_id` is `NOT NULL`.
- Real invitation acceptance was verified through Brevo, Gmail, Google-only Gmail setup, normalized-email linkage, activation, persisted `auth_user_id`, no duplicate Member, and successful subsequent access.
- Routine E2E runs use disabled invitation delivery and the Playwright-owned API subprocess excludes every `BREVO_*` environment variable.

## Completed Phase 3 Slice 1

Project persistence and authorization are implemented without changing the Projects placeholder UI.

The `Project`, `ProjectDepartment`, and `ProjectStatusHistory` foundations now persist separate creator and Lead relationships, Department associations, and canonical status values.

`GET /api/projects`, `POST /api/projects`, and `GET /api/projects/:projectId` require an active authorized Member.

Every active authorized Member can list and create Projects, while the server derives the creator from the authenticated Member and validates the selected Lead and Departments.

F2-21 passed with a persisted active `MEMBER` Project Lead who was denied Registry navigation, direct route access, and Registry API access.

## Phase 3 Goal

Create project discovery, creation, ownership relationships, and the project overview.

Required Phase 3 interfaces include:

- `/projects`
- All Projects
- My Projects
- Leading
- Participating
- Create Project modal or drawer
- `/projects/:projectId`
- Project Overview
- Project status control
- Project Lead display
- Department associations

## Phase 3 Core Rules

- All active authorized Prometheus users may view all Projects.
- Any active authorized user may create a Project.
- Project creator and Project Lead are different concepts.
- Project Lead is project-specific and is not a workspace or organization role.
- Creating a Project grants no special authority by itself.
- Administrator status grants no Project Lead authority by itself.
- `created_by_member_id` and `lead_member_id` must remain separate relationships.
- Only active authorized Members may be selected as Project Lead.

## Recommended First Vertical Slice

Start with Project persistence and backend authorization before implementing the full Projects UI.

The first slice should establish:

1. Prisma `Project` persistence with separate creator and Lead relationships.
2. Project-to-Department associations required by the canonical model.
3. Project status persistence and any required status-history model already defined by the canonical data model.
4. Authenticated Project list, create, and detail APIs.
5. Validation that the selected Lead is an active authorized Member.
6. Visibility that allows every active authorized Member to view Projects.
7. Creation permission for every active authorized Member.
8. No automatic Lead authority for the creator or for Administrators.
9. Focused backend and persistence tests before the production Projects UI replaces the placeholder.
10. Immediate execution of deferred F2-21 once the first real non-admin Project Lead fixture exists.

Do not begin Stage, Outcome, Outcome Membership, or Project Membership work in this slice.

Those belong to Phase 4.

## Required Session Startup

Before changing Phase 3 implementation:

1. Read `AGENTS.md`.
2. Read this file.
3. Read `.agents/skills/prometheus-phase-delivery/SKILL.md`.
4. Read `.agents/skills/prometheus-database-change/SKILL.md` before Prisma or migration changes.
5. Read `.context/phases.md`, especially Phase 3.
6. Read `.context/data-model.md` Project-related sections.
7. Read `.context/user-flows.md` Project creation and access sections.
8. Read `.context/tech-stack.md` where relevant.
9. Read `.testcases/phase-03-project-core-tests.md`.
10. Inspect the current Prisma schema, project placeholder route, authentication model, Member model, and API authorization patterns.
11. Inspect `.model/finalmodel.html` before substantial Project UI work.
12. Use Figma as the visual source of truth when implementing the user-facing Projects experience.

## Completed Phase 3 Slice 2

The `/projects` placeholder is now a real Project list and Create Project flow.

`GET /api/projects/create-options` is available to every active authorized Member and returns only active selectable Leads plus persisted Department display data.

The Projects UI uses real list, creation-options, and create APIs with loading, empty, error, and refresh states.

The Create Project dialog validates required details, selects a real active Member as Lead, supports multiple persisted Departments, and blocks duplicate submits.

All Projects is functional.

Leading is derived from the persisted Lead relationship.

My Projects is explicitly limited to the currently persisted creator-or-Lead relationships and does not infer authority from creation.

Participating is intentionally unavailable until Phase 4 can derive it from Outcome Membership.

No migration was added.

Prisma generation and validation, focused Projects browser acceptance, the full `pnpm test:e2e` suite, and `pnpm verify` all passed after database connectivity recovered.

The full Playwright suite passed 16/16 tests, including the Project creation transaction and Registry Member Edit Escape path.

`pnpm verify` passed with 44 unit tests and both production builds.

The earlier transient Project transaction expiration and Registry Escape assertion did not reproduce in the final full regression.

## Completed Phase 3 Slice 3

The Project Overview, direct Project routes, Lead-only status control, controlled not-found behavior, `doneAt`, and Project status history are verified.

The direct-detail loading hang previously reported could not be reproduced under a Playwright-owned API lifecycle.

The focused Projects suite passed 5/5, F2-21 passed, and the full Playwright suite passed 20/20.

`pnpm prisma migrate status` reported all six migrations applied and the schema up to date.

`pnpm verify` passed with 54 unit tests and both production builds.

The Projects E2E fixture prefix is `phase3-slice3-` and list/detail React Query keys are separate so status mutation invalidates only the list query.

## Next Action

Complete the Project Members UI, Lead-only `CAN_VIEW` and `CAN_EDIT` management, Project status authorization expansion, and direct API authority non-leakage checks.

Then run the full Phase 4 acceptance gate and previous-phase regression before formal closure.

## Handoff Maintenance Rule

Update this file whenever the active phase changes, a major blocker changes the next action, or a session ends at a materially different point.

Keep this file concise.
