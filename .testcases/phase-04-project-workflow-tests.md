# Phase 4 Manual Test Cases - Project Workflow Structure

## Phase Context

This phase implements stages, outcomes, outcome joining, derived project membership, and project-member access.

Only the Project Lead may create and manage project stages and outcomes.

Any active authorized user may join an outcome unless the outcome is accepted.

Outcome Membership is permanent.

A user becomes a Project Member after joining at least one outcome in the project.

Project Members default to `CAN_VIEW`.

Only the Project Lead may grant or revoke `CAN_EDIT`.

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


## Stage Tests

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F4-01 | Lead creates stage | Add valid stage. | Stage appears and persists. |
| F4-02 | Invalid stage | Submit missing required stage data. | Validation prevents creation. |
| F4-03 | Lead edits stage | Edit stage metadata. | Changes persist. |
| F4-04 | Non-Lead creates stage | Attempt as unrelated Member. | Denied. |
| F4-05 | Admin non-Lead creates stage | Attempt as Admin who is not Project Lead. | Denied. |
| F4-06 | Double stage submit | Rapidly submit Add Stage twice. | No duplicate stage is created. |

## Outcome Tests

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F4-07 | Lead creates outcome | Create outcome under a stage. | Outcome appears under correct stage. |
| F4-08 | Outcome metadata | Save title, description, and departments. | Data persists. |
| F4-09 | Acceptance criteria | Add criteria. | Criteria persist and remain visible. |
| F4-10 | Prerequisite | Configure another outcome as prerequisite. | Relationship persists and lock state is represented correctly. |
| F4-11 | Non-Lead creates outcome | Attempt as regular viewer. | Denied. |
| F4-12 | Admin non-Lead creates outcome | Attempt as Admin. | Denied. |
| F4-13 | Direct outcome route | Open outcome route or detail interface directly. | Correct outcome loads with correct permissions. |

## Outcome Joining Tests

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F4-14 | Join open outcome | Unrelated active member joins. | Outcome Membership is created. |
| F4-15 | Refresh after join | Refresh. | Membership remains. |
| F4-16 | Join twice | Attempt to join again. | No duplicate membership. |
| F4-17 | Join locked outcome | Join an outcome locked by dependency. | Joining is allowed. |
| F4-18 | Join For Review outcome | Join while state is `FOR_REVIEW`. | Joining is allowed. |
| F4-19 | Join Needs Revision outcome | Join while state is `NEEDS_REVISION`. | Joining is allowed. |
| F4-20 | Join accepted outcome | Attempt to join accepted outcome. | Denied. |
| F4-21 | Leave outcome | Look for or attempt leave behavior after joining. | Leaving is unavailable or backend denies it. |
| F4-22 | Lead removes Outcome Member | Attempt to remove joined member. | Removal is denied. |

## Derived Project Membership Tests

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F4-23 | First outcome join creates project participation | Join first outcome in a project. | User becomes Project Member. |
| F4-24 | Default access | Inspect new Project Member access. | Defaults to `CAN_VIEW`. |
| F4-25 | Participating classification | Open My Projects -> Participating. | Project appears. |
| F4-26 | Lead classification | Project Lead also joins an outcome. | Project remains grouped under Leading according to product rule. |
| F4-27 | Multiple outcome joins | Join multiple outcomes in same project. | Only one logical project membership exists. |

## Project Member Access Tests

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F4-28 | Lead grants CAN_EDIT | Change member from `CAN_VIEW` to `CAN_EDIT`. | Change persists. |
| F4-29 | Lead revokes CAN_EDIT | Return member to `CAN_VIEW`. | Change persists. |
| F4-30 | CAN_EDIT changes project status | Editable member changes project status. | Allowed. |
| F4-31 | CAN_VIEW changes project status | View-only member attempts status change. | Denied. |
| F4-32 | CAN_EDIT creates stage | Editable member attempts Add Stage. | Denied. |
| F4-33 | CAN_EDIT creates outcome | Editable member attempts Add Outcome. | Denied. |
| F4-34 | CAN_EDIT manages project-member access | Editable member attempts to modify access levels. | Denied. |
| F4-35 | Admin non-Lead grants CAN_EDIT | Administrator attempts access modification. | Denied. |
| F4-36 | Backend bypass attempt | Call restricted API manually as unauthorized user. | Backend returns forbidden. |

## Phase 4 Main E2E Flow

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
-> Member still cannot create stages or outcomes
```

## Phase 4 Exit Checklist

- [ ] Stage authority is Project Lead-only.
- [ ] Outcome authority is Project Lead-only.
- [ ] Outcome joining follows state rules.
- [ ] Outcome Membership cannot be removed.
- [ ] Project Membership is derived from Outcome Membership.
- [ ] Default project access is `CAN_VIEW`.
- [ ] Only Project Lead can manage `CAN_EDIT`.
- [ ] `CAN_EDIT` does not grant Project Lead actions.
- [ ] Administrator status does not override project relationships.
