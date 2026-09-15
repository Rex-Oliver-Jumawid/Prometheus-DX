# Phase 6 Manual Test Cases - Schedule, Work Sessions, and Team

## Phase Context

Prometheus distinguishes planned schedule from actual work sessions.

Schedule represents expected availability or planned work.

Work Sessions record actual Time In and Time Out.

Presence is a separate realtime concept and must not replace persistent work sessions.

Members primarily manage their own schedules and record their own work sessions.

## Required Pages and Interfaces

- `/schedule`
- Team Schedule
- Shifts
- Configure My Schedule
- Time In
- Time Out
- Weekly history
- `/team`

## Required Test Accounts

- Member A
- Member B
- Administrator
- Member with no configured schedule
- Member with no work-session history


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


## Schedule Tests

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F6-01 | Open Team Schedule | Open `/schedule`. | Team Schedule loads correctly. |
| F6-02 | Configure own schedule | Add planned hours for current user. | Schedule persists after refresh. |
| F6-03 | Edit own schedule | Modify planned hours. | Updated schedule persists. |
| F6-04 | Remove own schedule entry if supported | Delete or clear an entry. | Schedule updates correctly. |
| F6-05 | View another member | Inspect another member's availability. | Shared visibility works according to product rule. |
| F6-06 | Edit another member | Attempt to modify another member's schedule. | Denied unless an explicit future rule permits it. |
| F6-07 | No schedule | Open schedule for member with no configuration. | Intentional empty/configure state appears. |
| F6-08 | Overlap handling | Create overlapping own schedule entries. | System handles according to defined rule without corrupting data. |
| F6-09 | Configure from Shifts view | Use Configure My Schedule while currently viewing Shifts. | UI returns to Team Schedule configuration context as intended. |

## Work Session Tests

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F6-10 | Time In | Start a work session. | Active session begins with correct timestamp. |
| F6-11 | Refresh while timed in | Refresh. | Active session remains active. |
| F6-12 | Duplicate Time In | Attempt another Time In while active. | Duplicate active session is prevented. |
| F6-13 | Time Out | End active session. | Session closes with correct timestamp. |
| F6-14 | Time Out without session | Attempt Time Out with no active session. | Prevented. |
| F6-15 | Duration | Compare start/end times with displayed duration. | Duration is correct. |
| F6-16 | Weekly history | Open weekly history after completed session. | Session appears correctly. |
| F6-17 | Multiple sessions | Record multiple sessions in a week. | Totals and rows remain correct. |
| F6-18 | Schedule versus actual | Configure six planned hours but work five actual hours. | Planned and actual values remain distinct. |
| F6-19 | Cross-midnight session if supported | Time In before midnight and Time Out after midnight. | Duration and date grouping remain correct. |

## Team Tests

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F6-20 | Team member list | Open `/team`. | Authorized members appear. |
| F6-21 | Working Now | Time In as Member A, then inspect Team. | Member A shows as Working Now. |
| F6-22 | Time Out update | Time Out and refresh Team. | Working state updates. |
| F6-23 | Scheduled hours | Compare Team scheduled hours to Schedule records. | Values match. |
| F6-24 | Actual hours | Compare Team actual hours to Work Session records. | Values match. |
| F6-25 | Empty member values | Inspect member with no schedule/history. | UI handles missing values cleanly. |
| F6-26 | Department and position | Compare Team identity fields with Registry. | Values match Registry source. |

## Phase 6 Main E2E Flow

```text
Member configures own schedule
-> Member Time In
-> Refresh
-> Active session remains
-> Member Time Out
-> Weekly history updates
-> Team shows scheduled and actual hours
```

## Phase 6 Exit Checklist

- [ ] Planned schedule and actual work sessions are distinct.
- [ ] Members can manage their own schedule.
- [ ] Unauthorized schedule edits are blocked.
- [ ] Duplicate active work sessions are prevented.
- [ ] Time In and Time Out survive refresh.
- [ ] Team derives data from Registry, Schedule, and Work Sessions.
