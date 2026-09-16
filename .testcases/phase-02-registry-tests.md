# Phase 2 Manual Test Cases - Registry

## Phase Context

Registry is the organization-level administration area.

Only `ADMINISTRATOR` may access it.

Registry manages departments, members, organization roles, workspace access, and authentication status.

Project Lead status alone does not grant Registry access.

Frontend hiding is not sufficient.

Backend Registry endpoints must enforce the same rule.

## Required Pages and Interfaces

- `/registry`
- Members view
- Departments view
- Add Member
- Edit Member
- Department create/edit
- Activation/deactivation controls
- Authentication status

## Required Test Accounts

- Administrator
- Regular Member
- Project Lead who is not Administrator
- Invited Member
- Active Member
- Deactivated Member

## How to Execute These Tests

Execute the tests manually from the browser using real application routes and API behavior.

Mark each case as:

- `PASS`
- `FAIL`
- `BLOCKED`
- `DEFERRED` only when the literal fixture depends on a later canonical phase and the dependency is recorded explicitly

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

## Department Tests

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F2-01 | Create department | Add a valid department. | Department appears and persists after refresh. |
| F2-02 | Blank department | Submit blank name. | Validation prevents creation. |
| F2-03 | Duplicate department | Create an existing department name if duplicates are forbidden. | Duplicate is rejected clearly. |
| F2-04 | Edit department | Rename a department. | Change persists. |
| F2-05 | Department member relationship | Open a department with assigned members. | Correct members are associated. |

## Member Tests

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F2-06 | Add valid member | Add name, email, department, position, and role. | Member record is created with expected initial status. |
| F2-07 | Invalid email | Add member using malformed email. | Validation prevents creation. |
| F2-08 | Duplicate email | Add another member with the same email. | Duplicate membership is rejected. |
| F2-09 | Assign department | Assign or change department. | Relationship persists after refresh. |
| F2-10 | Set Member role | Assign `MEMBER`. | Role is stored correctly. |
| F2-11 | Set Administrator role | Assign `ADMINISTRATOR`. | Administrator privileges become available after expected refresh/session behavior. |
| F2-12 | Edit member profile metadata | Change name or position. | Changes persist. |
| F2-13 | Deactivate member | Deactivate active member. | Member loses workspace access. |
| F2-14 | Reactivate member | Reactivate member. | Member regains workspace eligibility. |
| F2-15 | Invited authentication status | Inspect invited member before account setup. | UI shows the expected invited/setup-pending state. |
| F2-16 | Activate invited account | Complete authentication for invited member. | Member becomes active and auth identity is linked. |
| F2-17 | Long names and positions | Create or edit with long but valid values. | Layout remains usable. |

## Authorization Tests

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F2-18 | Member navigation | Sign in as Member. | Registry nav item is absent. |
| F2-19 | Member direct route | Enter `/registry` manually as Member. | Access denied. |
| F2-20 | Member direct API | Call a Registry API as Member. | Backend returns forbidden. |
| F2-21 | Non-admin Project Lead | Sign in as a Project Lead who is not Admin and open Registry. | Access denied. |
| F2-22 | Admin access | Sign in as Administrator. | Registry is accessible. |
| F2-23 | Role downgrade during session | Remove Administrator role from current admin using another admin, then refresh. | Registry access is removed according to current role. |
| F2-24 | Deactivation during session | Deactivate a currently signed-in member using another admin, then refresh protected app. | Workspace access is denied. |

## Final Acceptance Record

- F2-01, F2-02, F2-04 through F2-20, and F2-22 through F2-24: `PASS`.
- F2-03: `N/A` because duplicate Department names are not forbidden by canonical requirements.
- F2-16: `PASS` with real Registry invitation delivery, Gmail receipt, Google-only Gmail setup, normalized-email linkage, activation, persisted `auth_user_id`, no duplicate Member, and successful subsequent access.
- F2-21: `DEFERRED` to Phase 3 because a persisted Project Lead relationship does not exist before Project Core.

The F2-21 deferral does not change the Phase 2 security rule.

Registry remains Administrator-only at both route and API boundaries.

The literal F2-21 regression must execute as soon as Phase 3 creates a real Project with a non-admin Project Lead.

## Phase 2 Main E2E Flow

```text
Administrator signs in
-> Opens Registry
-> Creates department
-> Adds member
-> Assigns member to department
-> Member completes account setup
-> Member signs in
-> Member cannot access Registry
```

## Phase 2 Exit Checklist

- [x] Departments persist.
- [x] Members persist.
- [x] Duplicate and invalid membership data are rejected.
- [x] Activation and deactivation affect workspace access.
- [x] Authentication linkage is visible and correct.
- [x] Administrator authorization is enforced by frontend and backend.
- [x] Phase 2 canonical exit milestone is satisfied: Administrators can manage organization data and Members cannot access Registry through navigation, direct URL, or API.
- [x] F2-21 is explicitly transferred to Phase 3 as a required regression once a persisted non-admin Project Lead fixture exists.

Phase 2 is complete.

The deferred F2-21 regression is tracked in the Phase 3 acceptance file and must not be dropped.