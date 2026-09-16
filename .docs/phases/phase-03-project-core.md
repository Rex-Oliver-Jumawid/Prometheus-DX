# Phase 3 - Project Core

## Status

**Ready to start**

No Phase 3 implementation has been completed yet.

Phase 2 - Registry is complete.

Its formal closure record is `.docs/phases/phase-02-registry-closure.md`.

## Objective

Create project discovery, creation, ownership relationships, and the project overview while preserving the distinction between organization authority and project-specific authority.

## Canonical Scope

Required interfaces:

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

## Core Rules

1. All active authorized Prometheus users may view all Projects.
2. Any active authorized user may create a Project.
3. Project creator and Project Lead are separate concepts.
4. Project Lead is project-specific and is not an organization role.
5. Project creation grants no special authority by itself.
6. Administrator status grants no Project Lead authority by itself.
7. Only eligible active authorized Members may be selected as Project Lead.
8. Project-specific authorization must be enforced by the backend and not inferred from frontend visibility.

## Deferred Regression From Phase 2

F2-21 must run as soon as a persisted Project Lead relationship exists.

The fixture must be a Project Lead whose workspace role is `MEMBER`, not `ADMINISTRATOR`.

Expected result:

- Registry navigation is absent.
- Direct `/registry` access is denied.
- Direct Registry API access is forbidden.

This regression is tracked in `.testcases/phase-03-project-core-tests.md`.

## Recommended Implementation Order

### Slice 1 - Persistence and authorization foundation

Establish the Project data model and protected backend behavior first.

Required outcomes:

- Project persistence exists.
- `created_by_member_id` and `lead_member_id` are separate relationships.
- Project-to-Department associations persist according to the canonical data model.
- Project status persists according to the canonical data model.
- Project list, create, and detail APIs exist.
- Every active authorized Member can view Projects.
- Every active authorized Member can create a Project.
- Lead assignment validates an active authorized Member.
- Creator status does not grant Lead authority.
- Administrator status does not grant Lead authority.
- Focused service/API tests cover these rules.
- F2-21 is executed once a non-admin Lead fixture exists.

Do not implement Stage, Outcome, Outcome Membership, or Project Membership in this slice.

Those belong to Phase 4.

### Slice 2 - Project discovery and creation UI

After Slice 1 is verified, replace the `/projects` placeholder with the real project list and Create Project experience.

Use `.model/finalmodel.html` for interaction behavior and Figma for visual presentation.

Keep All Projects, My Projects, Leading, and Participating behavior aligned with canonical rules.

Participating may remain empty or intentionally unavailable until the Phase 4 relationship that derives participation exists, but the UI and documentation must not fabricate participation records.

### Slice 3 - Project overview and status

Implement `/projects/:projectId`, Project Overview, Lead display, Department associations, and status controls after list/create persistence is stable.

Backend authorization must remain authoritative for project-specific actions.

## Required Verification Strategy

After each meaningful change, run the smallest relevant check first.

For the persistence slice:

- Prisma validation and generation.
- Migration inspection and status.
- Focused Project service/controller tests.
- Typecheck and lint.
- Focused browser tests only after the corresponding UI exists.

Before Phase 3 exit:

- `pnpm verify`
- `pnpm test:e2e`
- `pnpm prisma migrate status`
- Complete `.testcases/phase-03-project-core-tests.md`
- Confirm deferred F2-21 passes with a real non-admin Project Lead.

## Source Ownership

- `.context/phases.md` defines Phase 3 scope and exit milestone.
- `.context/data-model.md` defines Project persistence relationships.
- `.context/user-flows.md` defines Project workflows and authorization behavior.
- `.model/finalmodel.html` defines intended interaction behavior.
- Figma defines visual presentation.
- Current code defines implementation reality to evolve.

## First Action

Read the canonical Project model and flows, inspect the existing Prisma schema and `/projects` placeholder, then design the smallest additive Prisma migration and backend vertical slice for Project list/create/detail with separate creator and Lead relationships.
