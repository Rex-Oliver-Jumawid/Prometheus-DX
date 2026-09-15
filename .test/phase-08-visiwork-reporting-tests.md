# Phase 8 Manual Test Cases - VisiWork and Reporting

## Phase Context

VisiWork and reporting should provide management visibility over canonical Prometheus data.

The exact final visual design may evolve, but reported metrics must remain traceable to their source records.

Do not create a separate manually synchronized analytics state.

## Required Pages and Interfaces

- `/visiwork` or final approved route
- Project health
- Outcome progress
- Department workload
- Member workload
- Team capacity
- Scheduled versus actual hours
- Filters
- Empty states

## Required Test Data

Prepare controlled records where expected totals can be calculated manually.

Include:

- At least two departments
- Multiple projects
- Multiple outcomes
- Accepted and non-accepted outcomes
- Multiple members
- Schedules
- Work sessions
- Outcome memberships


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


## Metric Accuracy Tests

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F8-01 | Project progress | Change tasks/outcomes that contribute to progress. | Project metric updates correctly. |
| F8-02 | Task completion | Complete a task. | Relevant progress metric recalculates. |
| F8-03 | Outcome acceptance | Accept an outcome. | Accepted outcome metrics update. |
| F8-04 | Outcome reopening | Reopen an accepted outcome. | Metrics reflect current state while preserving historical records where required. |
| F8-05 | Participation | Add a new Outcome Member. | Participation metrics update. |
| F8-06 | Department workload | Add work associated with a department. | Department workload changes correctly. |
| F8-07 | Schedule capacity | Change planned schedule. | Capacity metric reflects planned hours. |
| F8-08 | Actual work | Add completed Work Session. | Actual-hours metric updates. |
| F8-09 | Scheduled versus actual | Compare manually calculated totals. | Values match source records. |

## Filter Tests

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F8-10 | Department filter | Select Department A. | Only Department A relevant data is represented. |
| F8-11 | Project filter | Select one project. | Metrics reflect selected project only. |
| F8-12 | Combined filters | Apply multiple supported filters. | Results match intersection of filters. |
| F8-13 | Clear filters | Reset filters. | Full dataset returns. |
| F8-14 | Invalid/stale filter target | Remove underlying entity while filter state is active if supported. | UI recovers safely. |

## Edge and Visual Tests

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F8-15 | No data | Open reporting in clean/empty scope. | No misleading NaN, Infinity, or broken charts. |
| F8-16 | Zero values | Use valid dataset whose metric is zero. | Zero is distinguished from missing data. |
| F8-17 | Large values | Use enough records to create large totals. | Formatting remains readable. |
| F8-18 | Manual reconciliation | Pick one report and calculate totals directly from source records. | Report matches exactly. |
| F8-19 | Refresh | Refresh after data changes. | Metrics remain correct. |
| F8-20 | Permissions | Open reports as each supported role. | Visibility matches final approved reporting permissions. |

## Phase 8 Main E2E Flow

```text
Create controlled project data
-> Complete tasks
-> Accept outcome
-> Configure schedules
-> Record work sessions
-> Open VisiWork
-> Reconcile displayed metrics against source records
```

## Phase 8 Exit Checklist

- [ ] Every metric has a canonical source.
- [ ] Manual reconciliation succeeds.
- [ ] Filters are correct.
- [ ] Empty and zero states are distinct.
- [ ] Reopened/accepted states do not corrupt historical reporting.
- [ ] Reporting permissions match final product rules.
