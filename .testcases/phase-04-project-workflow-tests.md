# Phase 4 Manual Test Cases - Project Workflow Structure

## Phase Context

This phase implements stages, outcomes, outcome joining, derived project membership, and project-member access.

The Project Lead or a Project Member with `CAN_EDIT` may create and manage project stages and outcomes.

Any active authorized user may join an outcome unless the outcome is accepted.

Outcome Membership is permanent.

A user becomes a Project Member after joining at least one outcome in the project.

Project Members default to `CAN_VIEW`.

Only the Project Lead may grant or revoke `CAN_EDIT`.

Current permission amendment:
`CAN_EDIT` grants Project editor authority for Project status plus Stage and Outcome management.
Project Member access management remains Project Lead-only.

## Required Pages and Interfaces

- Project Workspace
- Stage UI
- Add/Edit Stage
- Outcome cards
- Add/Edit Outcome
- Outcome Details
- Join Outcome
- Project Members
- Access level management

## Required Test Accounts

- Project Lead
- Administrator who is not Project Lead
- Unrelated Member
- Project Member with `CAN_VIEW`
- Project Member with `CAN_EDIT`
- Outcome Member

## How to Execute These Tests

Execute the tests from the browser using real application routes and API behavior.

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

## Final Verification Record

Phase 4 final acceptance completed on 2026-09-16.

- `pnpm test:e2e`: 35/35 passed.
- `pnpm prisma migrate status`: seven migrations found; database schema is up to date.
- `pnpm verify`: passed.
- Unit tests: 84/84 passed across 13 test files.
- Typecheck: passed.
- Web and API production builds: passed.
- Lint: zero errors with one pre-existing `RegistryPage.tsx` hook-dependency warning.
- F2-21 previous-phase authorization regression: passed.
- Canonical Phase 4 main E2E flow: passed.

Primary automated evidence:

- `tests/e2e/project-workflow.spec.ts` covers Stage/Outcome workflow, direct routing, permissions, persistence, and narrow viewport behavior.
- `tests/e2e/outcome-membership.spec.ts` covers joining, idempotence, permanent membership, derived Project Membership, and Participating classification.
- `tests/e2e/project-member-access.spec.ts` covers `CAN_VIEW` / `CAN_EDIT`, status authority, access history, and authority non-leakage.
- `tests/e2e/auth-shell.spec.ts` preserves F2-21 and authentication/authorization regressions.
- `tests/e2e/projects.spec.ts` preserves Phase 3 Project regressions.

## Global Visual and Interaction Checks

Final status: `PASS` within the exercised Phase 4 browser paths.

- No blocking overlapping elements were observed.
- No clipped Phase 4 controls or text were observed in acceptance coverage.
- Narrow Project Workspace coverage passed without horizontal overflow.
- Modal/dialog positioning and interaction passed focused browser coverage.
- Loading, empty, and error states are implemented for the Phase 4 interfaces.
- Keyboard and guarded-submit behavior passed focused workflow coverage.
- Refresh preserves server-backed state.
- Browser Back and Forward behave correctly on direct Outcome navigation.
- Direct URL navigation works.
- No unexplained console error blocked Phase 4 acceptance.

## Stage Tests

| ID | Test | Expected Result | Status |
| --- | --- | --- | --- |
| F4-01 | Lead creates stage | Stage appears and persists. | PASS |
| F4-02 | Invalid stage | Validation prevents creation. | PASS |
| F4-03 | Lead edits stage | Changes persist. | PASS |
| F4-04 | Non-Lead creates stage | Denied. | PASS |
| F4-05 | Admin non-Lead creates stage | Denied. | PASS |
| F4-06 | Double stage submit | No duplicate stage is created. | PASS |

## Outcome Tests

| ID | Test | Expected Result | Status |
| --- | --- | --- | --- |
| F4-07 | Lead creates outcome | Outcome appears under correct stage. | PASS |
| F4-08 | Outcome metadata | Data persists. | PASS |
| F4-09 | Acceptance criteria | Criteria persist and remain visible. | PASS |
| F4-10 | Prerequisite | Relationship persists and lock state is represented correctly. | PASS |
| F4-11 | Non-Lead creates outcome | Denied. | PASS |
| F4-12 | Admin non-Lead creates outcome | Denied. | PASS |
| F4-13 | Direct outcome route | Correct outcome loads with correct permissions. | PASS |

## Outcome Joining Tests

| ID | Test | Expected Result | Status |
| --- | --- | --- | --- |
| F4-14 | Join open outcome | Outcome Membership is created. | PASS |
| F4-15 | Refresh after join | Membership remains. | PASS |
| F4-16 | Join twice | No duplicate membership. | PASS |
| F4-17 | Join locked outcome | Joining is allowed. | PASS |
| F4-18 | Join For Review outcome | Joining is allowed. | PASS |
| F4-19 | Join Needs Revision outcome | Joining is allowed. | PASS |
| F4-20 | Join accepted outcome | Denied. | PASS |
| F4-21 | Leave outcome | Leaving is unavailable or backend denies it. | PASS |
| F4-22 | Lead removes Outcome Member | Removal is denied. | PASS |

## Derived Project Membership Tests

| ID | Test | Expected Result | Status |
| --- | --- | --- | --- |
| F4-23 | First outcome join creates project participation | User becomes Project Member. | PASS |
| F4-24 | Default access | Defaults to `CAN_VIEW`. | PASS |
| F4-25 | Participating classification | Project appears under Participating. | PASS |
| F4-26 | Lead classification | Project remains grouped under Leading according to product rule. | PASS |
| F4-27 | Multiple outcome joins | Only one logical Project Membership exists. | PASS |

## Project Member Access Tests

| ID | Test | Expected Result | Status |
| --- | --- | --- | --- |
| F4-28 | Lead grants CAN_EDIT | Change persists. | PASS |
| F4-29 | Lead revokes CAN_EDIT | Change persists. | PASS |
| F4-30 | CAN_EDIT changes project status | Allowed. | PASS |
| F4-31 | CAN_VIEW changes project status | Denied. | PASS |
| F4-32 | CAN_EDIT creates stage | Allowed under the current Project editor rule. | REVALIDATE |
| F4-33 | CAN_EDIT creates outcome | Allowed under the current Project editor rule. | REVALIDATE |
| F4-34 | CAN_EDIT manages project-member access | Denied. | PASS |
| F4-35 | Admin non-Lead grants CAN_EDIT | Denied. | PASS |
| F4-36 | Backend bypass attempt | Backend returns forbidden. | PASS |

## Phase 4 Main E2E Flow

Final status: `PASS`.

```text
Lead opens project
-> Creates stage
-> Creates outcome
-> Member opens project
-> Member joins outcome
-> Member becomes Project Member
-> Access defaults to CAN_VIEW
-> Lead grants CAN_EDIT
-> Member can change project status
-> Member can create and manage stages and outcomes
```

The final browser suite includes a dedicated test for this complete flow and verifies that Lead-only authority remains isolated after `CAN_EDIT` is granted.

## Phase 4 Exit Checklist

- [ ] Stage authority allows Project Lead or CAN_EDIT Project Member and requires revalidation.
- [ ] Outcome authority allows Project Lead or CAN_EDIT Project Member and requires revalidation.
- [x] Outcome joining follows state rules.
- [x] Outcome Membership cannot be removed.
- [x] Project Membership is derived from Outcome Membership.
- [x] Default project access is `CAN_VIEW`.
- [x] Only Project Lead can manage `CAN_EDIT`.
- [ ] `CAN_EDIT` grants Project editor workflow actions but not Project Member access management; revalidation required.
- [x] Administrator status does not override project relationships.

## Phase Exit

`PASS` - F4-01 through F4-36 are verified and Phase 4 is complete.
