# Phase 3 Manual Test Cases - Project Core

## Phase Context

All active authorized Prometheus users may view all projects.

Any active authorized user may create a project.

The creator and Project Lead are separate relationships.

Project Lead is project-specific and is not an organization role.

Administrator status does not automatically grant project authority.

Phase 3 must also execute the deferred Phase 2 F2-21 regression as soon as a persisted non-admin Project Lead fixture exists.

## Required Pages and Interfaces

- `/projects`
- All Projects
- My Projects
- Leading
- Participating
- Create Project modal or drawer
- `/projects/:projectId`
- Project Overview
- Project status control

## Required Test Accounts

- Administrator
- Member A
- Member B
- Member C with no project relationship
- Inactive member

## How to Execute These Tests

Execute the tests manually from the browser using real application routes and API behavior.

Mark each case as:

- `PASS`
- `FAIL`
- `BLOCKED`

When a case fails, record:

- Browser and viewport
- User account and role
- Exact steps performed
- Expected result
- Actual result
- Screenshot or screen recording when useful
- Browser console error
- Network request and response status when relevant
- Related database record when relevant

Do not mark a test as passed only because the interface looks correct.

Permission-sensitive tests must be verified against backend behavior as well.

## Deferred Phase 2 Regression

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F2-21 | Non-admin Project Lead cannot access Registry | Create or use a persisted Project whose Lead is an active `MEMBER`, sign in as that Lead, verify Registry navigation is absent, open `/registry` directly, and call a Registry API. | Project Lead status grants no Registry authority: navigation is absent, direct route is denied, and Registry API returns forbidden. |

Status: `PASS` on 2026-09-16 through `tests/e2e/auth-shell.spec.ts` with a persisted active `MEMBER` Project Lead fixture.

The verified browser result was absent Registry navigation, denied direct `/registry` access, and `403` from the Registry API.

Do not convert Project Lead into a workspace or organization role to satisfy this regression.

## Global Visual and Interaction Checks

Apply these checks to every page in this phase:

- No overlapping elements.
- No clipped controls or text.
- No accidental page-level horizontal scrollbar.
- No unexpected vertical scrollbar inside fixed layouts.
- Modal and drawer positioning is correct.
- Long names and descriptions do not destroy the layout.
- Loading states do not cause major layout jumps.
- Empty states are intentional.
- Error states are understandable.
- Keyboard focus is visible.
- Buttons cannot be accidentally triggered twice.
- Refresh preserves server-backed state.
- Browser Back and Forward behave naturally.
- Direct URL navigation works.
- There are no unexplained console errors.

## Project Listing Tests

Slice 2 automated coverage status on 2026-09-16:

- F3-01, F3-07 through F3-15 were exercised by `tests/e2e/projects.spec.ts` against real routes, APIs, and persistence.
- The test covers active Member access, required client validation, selecting the current Member and another active Member as Lead, multiple Departments, the safe request body, persistence of separate creator and Lead records, refresh, duplicate-submit prevention, narrow viewport overflow, and browser console errors.
- F3-05 is implemented from the persisted Lead relationship.
- F3-04 is deliberately limited in Slice 2 to current creator-or-Lead relationships only, and must be revisited once canonical participation exists.
- F3-06 remains deferred to Phase 4 because participation must originate from Outcome Membership.

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F3-01 | All Projects | Open `/projects`. | All company-visible projects appear. |
| F3-02 | No project empty state | Use clean environment with no projects. | Intentional empty state is displayed. |
| F3-03 | Many projects | Seed enough projects to require scrolling. | Layout remains usable. |
| F3-04 | My Projects | Open My Projects. | Only relevant Leading or Participating projects appear. |
| F3-05 | Leading | Open Leading. | Projects where current user is Project Lead appear. |
| F3-06 | Participating | Open Participating. | Projects derived from Outcome Membership appear when applicable. |

## Create Project Tests

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F3-07 | Member creates project | Sign in as regular Member and create project. | Creation succeeds. |
| F3-08 | Self as Lead | Select current user as Project Lead. | Project is created with current user as Lead. |
| F3-09 | Another user as Lead | Assign another active authorized user. | Lead relationship is saved correctly. |
| F3-10 | Inactive user as Lead | Attempt to select an inactive user. | Inactive user is unavailable or rejected. |
| F3-11 | Required fields | Submit without required fields. | Validation prevents creation. |
| F3-12 | Multiple departments | Associate multiple departments. | Relationships persist. |
| F3-13 | Creator and Lead differ | Member A creates project with Member B as Lead. | `created_by` is A and `lead` is B. |
| F3-14 | Refresh after creation | Refresh project page. | Project persists. |
| F3-15 | Double submit | Rapidly click Create twice. | Only one project is created. |

## Visibility and Permission Tests

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F3-16 | Unrelated member views project | Sign in as Member C and open project. | Project is visible. |
| F3-17 | Unrelated member edit attempt | Attempt a Lead-only action if available. | Denied. |
| F3-18 | Admin without Lead role | Sign in as Admin who is not Lead and open project. | Admin does not receive Project Lead powers. |
| F3-19 | Creator without Lead role | Project creator who assigned another Lead opens project. | Creator receives no special authority from creation alone. |
| F3-20 | Direct route | Enter `/projects/:projectId` directly. | Correct project loads. |
| F3-21 | Invalid project ID | Enter nonexistent project ID. | Not-found state is controlled. |

## Project Status Tests

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F3-22 | Lead sets In Progress | Lead changes `PLANNING` to `IN_PROGRESS`. | Status persists. |
| F3-23 | Lead sets Done | Lead changes status to `DONE`. | Status persists with done timestamp if required. |
| F3-24 | Unauthorized viewer status change | Viewer attempts status update through UI or API. | Denied. |
| F3-25 | Refresh after status change | Refresh project. | Correct status remains. |
| F3-26 | Archived status manual selection | Attempt to manually choose `ARCHIVED`. | Not offered or rejected because it is system-managed. |

## Phase 3 Main E2E Flow

```text
Member A signs in
-> Opens Projects
-> Creates project
-> Assigns Member B as Lead
-> Opens project
-> Member B signs in
-> Project appears under Leading
-> Member B cannot access Registry unless separately an Administrator
-> Member C signs in
-> Project is still visible
-> Member C cannot perform Lead-only edits
```

## Phase 3 Exit Checklist

- [x] Deferred F2-21 Registry regression passes with a persisted non-admin Project Lead.
- [x] All projects are visible to authorized users.
- [x] Regular members can create projects.
- [x] Creator and Lead are stored separately.
- [x] Creator does not gain authority automatically.
- [x] Administrator does not gain Project Lead authority automatically.
- [x] Status permissions are correct.
- [x] Direct project routes and refresh work.

## Slice 3 Browser Verification - 2026-09-16

F3-16 through F3-26 are `PASS` through `tests/e2e/projects.spec.ts` under the Playwright-owned API lifecycle.

F3-16 verifies an unrelated active Member can load a persisted Project.

F3-17 and F3-24 verify the same unrelated Member receives `403` from the status API.

F3-18 and F3-19 verify an Administrator and creator without the Project Lead relationship receive no status control or API authority.

F3-20 verifies direct `/projects/:projectId` navigation loads the correct Project.

F3-21 verifies nonexistent and malformed IDs show the controlled not-found state.

F3-22, F3-23, and F3-25 verify Lead changes to `IN_PROGRESS` and `DONE`, persistence after refresh, and a non-null `doneAt` with the expected status history.

F3-26 verifies `ARCHIVED` is not available for manual selection.

The focused Projects suite passed 5/5.

F2-21 passed separately in `tests/e2e/auth-shell.spec.ts` with absent Registry navigation, denied direct route, and `403` Registry API response for a persisted non-admin Project Lead.

The full Playwright regression passed 20/20.
