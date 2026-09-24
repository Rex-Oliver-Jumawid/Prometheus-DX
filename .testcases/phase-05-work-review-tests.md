# Phase 5 Manual Test Cases - Outcome Work, Submission, Review, and Dependencies

## Release Closure Disposition - 2026-09-25

This file remains a repeatable manual regression checklist.

The owning phase has been closed for the current release using the accumulated implementation evidence, automated service/component/integration coverage, recorded browser evidence, and current repository-wide regression.

A checkbox marked complete below records the release closure disposition.
It does not mean a credential-gated browser case was executed in an environment where its credentials were unavailable.

Future changes to the covered behavior should reuse the relevant cases.

## Phase Context

Phase 5 completes the primary Prometheus project-delivery workflow.

Outcome Members may create permitted features and tasks, complete work, and submit outputs.

Each outcome has one shared submission history.

Multiple submissions may be under review simultaneously.

The Project Lead or a Project Member with `CAN_EDIT` may review submissions, request or resolve revision, accept or reopen an Outcome, and override dependencies.

Acceptance applies to the outcome as a whole.

All current Outcome Members receive accepted-outcome credit.

## Required Pages and Interfaces

- Outcome work area
- Features
- Tasks
- Output submission
- Shared submission history
- Review interface
- Revision feedback
- Acceptance
- Reopening
- Dependency states

## Required Test Accounts

- Project Lead
- Outcome Member A
- Outcome Member B
- Authorized viewer who has not joined
- Administrator who is not Project Lead


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


## Feature and Task Tests

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F5-01 | Outcome Member creates feature | Create feature inside joined outcome. | Feature appears and persists. |
| F5-02 | Viewer creates feature | Attempt without joining. | Denied. |
| F5-03 | Outcome Member creates task | Add task under permitted feature/outcome. | Task appears and persists. |
| F5-04 | Edit task | Modify permitted task fields. | Changes persist. |
| F5-05 | Complete task | Mark task complete. | Completion persists and progress updates. |
| F5-06 | Reopen task if supported | Reopen completed task. | Progress recalculates correctly. |
| F5-07 | Concurrent member work | Member A and B make permitted updates. | Data remains consistent and no changes are silently lost. |
| F5-08 | Invalid task | Submit missing required task data. | Validation prevents creation. |

## Submission Tests

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F5-09 | Valid submission | Outcome Member submits valid output. | Entry appears in shared history. |
| F5-10 | Viewer submission | Non-member attempts submission. | Denied. |
| F5-11 | Invalid submission | Submit missing required content. | Validation prevents submission. |
| F5-12 | Refresh history | Refresh outcome. | Submission remains. |
| F5-13 | Submitter attribution | Member A submits. | Member A is recorded as submitter. |
| F5-14 | Parallel submissions | Member A submits and remains under review, then Member B submits. | Both submissions coexist. |
| F5-15 | Ordering | Add several submissions. | Timestamps and ordering are correct. |
| F5-16 | Double submit | Rapidly press Submit twice. | Only one intended submission is created. |

## CAN_EDIT Project Editor Tests

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F5-E01 | CAN_EDIT reviews submission | Grant CAN_EDIT to a Project Member and open an Outcome with submitted work. | Review controls are visible and the review mutation succeeds. |
| F5-E02 | CAN_EDIT requests revision | Editable Project Member requests revision with valid feedback. | Outcome enters NEEDS_REVISION and history records the editor. |
| F5-E03 | CAN_EDIT accepts Outcome | Editable Project Member verifies criteria and accepts the Outcome. | Outcome becomes ACCEPTED and acceptance history credits current Outcome Members. |
| F5-E04 | CAN_EDIT reopens Outcome | Editable Project Member reopens an accepted Outcome. | Outcome returns to OPEN and prior acceptance history remains preserved. |
| F5-E05 | CAN_EDIT overrides dependency | Editable Project Member provides a valid reason for one unresolved dependency. | Only that dependency edge is overridden and the audit trail records the editor. |
| F5-E06 | CAN_VIEW remains denied | Repeat Project editor mutations as CAN_VIEW. | Backend returns forbidden and no decision records are written. |

## Review and Revision Tests

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F5-17 | Lead opens history | Project Lead opens submission history. | All shared submissions are visible. |
| F5-18 | Non-editor review | Member without CAN_EDIT attempts a Project review action. | Denied. |
| F5-19 | Admin non-editor review | Admin who is neither Lead nor CAN_EDIT attempts review. | Denied. |
| F5-20 | Request revision | Lead requests revision with feedback. | Outcome enters `NEEDS_REVISION` and feedback is preserved. |
| F5-21 | Member reads feedback | Outcome Member opens outcome. | Review feedback is visible. |
| F5-22 | New submission during revision | Member submits revised work. | New entry is added to same history. |
| F5-23 | Another member joins during revision | New authorized user joins. | Joining succeeds because outcome is not accepted. |

## Acceptance and Reopening Tests

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F5-24 | Accept outcome | Lead accepts outcome. | Outcome becomes accepted. |
| F5-25 | Member credit | Inspect accepted member set/history. | All current Outcome Members receive credit. |
| F5-26 | Submit after acceptance | Existing member attempts new submission. | Denied. |
| F5-27 | Join after acceptance | New user attempts join. | Denied. |
| F5-28 | Reopen outcome | Lead reopens accepted outcome. | Outcome becomes active again. |
| F5-29 | Preserve members | Inspect members after reopening. | Existing members remain. |
| F5-30 | Preserve submissions | Inspect history after reopening. | Previous submissions remain. |
| F5-31 | Preserve acceptance history | Inspect previous acceptance event. | Historical acceptance remains recorded. |
| F5-32 | Join after reopen | New user joins reopened outcome. | Allowed. |
| F5-33 | Submit after reopen | Existing or new member submits. | Submission is added to same shared history. |
| F5-34 | Accept again | Lead accepts reopened outcome. | New acceptance event preserves current member set. |

## Dependency Tests

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F5-35 | Locked dependent outcome | Configure unresolved prerequisite. | Dependent outcome visibly locks. |
| F5-36 | Join locked outcome | Join the locked dependent outcome. | Joining succeeds. |
| F5-37 | Blocked work or submission | Attempt action that dependency rule blocks. | Action is denied with understandable state. |
| F5-38 | Resolve prerequisite | Resolve or accept prerequisite according to rule. | Dependent outcome unlocks. |
| F5-39 | Refresh unlock state | Refresh. | Unlock remains correct. |
| F5-40 | Non-editor resolves dependency | User without Project editor authority attempts dependency override. | Denied. |

## Critical Prometheus Core E2E Test

Run this manually from a clean-enough state:

```text
Administrator creates or authorizes Member A and Member B
-> Member A signs in
-> Member A creates project
-> Member A is Project Lead
-> Lead creates stage
-> Lead creates outcome
-> Member B signs in
-> Member B joins outcome
-> Member B creates feature
-> Member B creates tasks
-> Member B completes tasks
-> Member B submits output
-> Member A reviews
-> Member A requests revision
-> Member B revises and resubmits
-> Member A accepts outcome
-> Accepted state survives refresh
```

## Phase 5 Exit Checklist

- [x] Only Outcome Members can perform Outcome Member work.
- [x] Shared submission history behaves correctly.
- [x] Multiple submissions can be under review simultaneously.
- [x] Project review authority is enforced for Project Lead and CAN_EDIT Project Members while CAN_VIEW/non-editor users remain denied.
- [x] Revision flow works.
- [x] Acceptance blocks new joins and submissions.
- [x] Reopening preserves history and memberships.
- [x] Dependencies lock and unlock correctly.
- [x] The complete Prometheus Core E2E workflow has recorded signed-in acceptance evidence.
