# Prometheus Derived Metrics

## Purpose

This document is the canonical definition of derived values used by Home, Projects, Reports & Analytics, Team, and VisiWork.

Derived values must be calculated from canonical persisted records.
Do not create a second manually synchronized analytics state.

When a UI label and an implementation formula disagree, update the implementation or this document deliberately.
Do not let the same metric acquire different formulas in different screens.

## Shared Project Metrics

### Total Outcomes

```text
Total Outcomes
= count of Outcomes across every Stage in the Project
```

### Accepted Outcomes

```text
Accepted Outcomes
= count of Project Outcomes where lifecycle_status = ACCEPTED
```

### Open Outcomes

```text
Open Outcomes
= Total Outcomes - Accepted Outcomes
```

`NEEDS_REVISION` remains open.

### Active Stages

A Stage is active when it contains at least one Outcome whose lifecycle status is not `ACCEPTED`.

```text
Active Stages
= count of Stages with one or more non-accepted Outcomes
```

### Project Progress

The canonical Project summary uses:

```text
if Project.status = DONE:
    Project Progress = 100
else if Total Outcomes = 0:
    Project Progress = 0
else:
    Project Progress = round(Accepted Outcomes / Total Outcomes * 100)
```

This intentionally allows a Project manually marked `DONE` to display 100 percent even when not every Outcome is accepted because Project status and Outcome acceptance are separate concepts.

Reports uses the canonical Project progress when no Department filter is active.
When a Department filter is active, Reports recomputes progress from only the Outcomes owned by that Department.

## Home Metrics

Home is a command-center projection over Projects, WorkSessions, Schedule, and Outcome review state.

### Working Now

Before aggregation, stale WorkSessions are refreshed through the WorkSession service.

```text
Working Now
= distinct ACTIVE Members
  with WorkSession.status = OPEN
  and WorkSession.time_out IS NULL
```

WorkSession is authoritative.
VisiWork presence never creates Working Now state.

### Active Projects

```text
Active Projects
= Projects where status is PLANNING or IN_PROGRESS
```

`DONE` and `ARCHIVED` are not counted as active.

### Total Projects

```text
Total Projects
= number of Projects returned by the canonical Project listing
```

### Awaiting Review

For the signed-in Member:

```text
Awaiting Review
= non-accepted Outcomes
  in Projects where current Member is Project Lead
  with at least one Submission whose review_status = FOR_REVIEW
```

### Revision Requests

For the signed-in Member:

```text
Revision Requests
= Outcomes where lifecycle_status = NEEDS_REVISION
  and current Member is an Outcome Member
  and an unresolved OutcomeRevisionRequest exists
```

### My Week - Actual

```text
My Week Actual
= total duration of the signed-in Member's persisted WorkSessions
  in the current WorkSession history week
```

The WorkSession service owns the week boundary and duration calculation.

### My Week - Planned

```text
My Week Planned
= MemberSchedule.target_weekly_minutes
```

If no schedule exists, planned minutes are zero.

### Leading Projects

```text
Leading
= Projects where Project.lead_member_id = current Member
```

### Participating Projects

```text
Participating
= Projects where the current Member has derived Project Membership
  and is not the Project Lead
```

Project Membership is derived from Outcome Membership.

### Needs Attention

Home combines two actionable sets for the signed-in Member:

1. Review items from `Awaiting Review`.
2. Unresolved revision items where the current Member is an Outcome Member.

The combined list is ordered newest-first by the relevant Outcome update or revision-request timestamp, with stable ID ordering as the tie-breaker.

Home does not persist a separate attention table.

## Reports & Analytics

Reports is a derived client read model over canonical Project workflow and Team work-summary data.

### Filter Scope

Project filter:

```text
include only the selected Project
```

Department filter:

```text
include Projects associated with the selected Department
and, inside those Projects,
include only Outcomes associated with the selected Department
```

Team capacity rows are filtered by each Member's canonical Department.

### Project Health

For each scoped Project:

```text
accepted = scoped accepted Outcomes
total = scoped Outcomes
```

Without a Department filter, progress uses the canonical Project progress metric.

With a Department filter:

```text
progress =
  0 when total = 0
  otherwise min(100, round(accepted / total * 100))
```

### Overall Project Progress

Reports displays the arithmetic mean of the scoped Project progress percentages.

```text
Overall Project Progress
= round(sum(Project Health progress) / number of scoped Projects)
```

It is not weighted by each Project's Outcome count.

If there are no scoped Projects, the value is zero.

### Outcome Pipeline

Each scoped Outcome belongs to one current pipeline bucket.

```text
Accepted
= lifecycle_status = ACCEPTED

Needs revision
= lifecycle_status = NEEDS_REVISION

For review
= lifecycle_status = OPEN
  and has_for_review = true

Locked
= lifecycle_status = OPEN
  and has_for_review = false
  and is_locked = true

Planned
= lifecycle_status = OPEN
  and has_for_review = false
  and is_locked = false
  and owning Project.status = PLANNING

In progress
= lifecycle_status = OPEN
  and has_for_review = false
  and is_locked = false
  and owning Project.status != PLANNING
```

### Scheduled Hours

For a Team Member:

```text
Scheduled Seconds
= scheduled_minutes * 60
```

The Team work-summary contract owns `scheduled_minutes`.

### Actual Hours

```text
Actual Seconds
= persisted WorkSession duration from the Team work summary
```

### Member Capacity Used

```text
if Scheduled Seconds = 0:
    Capacity Used = 0
else:
    Capacity Used = min(100, round(Actual Seconds / Scheduled Seconds * 100))
```

The displayed percentage is intentionally capped at 100 even when actual work exceeds scheduled work.
The raw actual and planned values remain available separately.

### Overall Capacity Used

```text
Overall Capacity Used
= min(100, round(sum Actual Seconds / sum Scheduled Seconds * 100))
```

If total scheduled time is zero, the value is zero.

### Department Workload

For each Department in the scoped Outcome set:

```text
total
= number of Outcome-to-Department ownership relationships

open
= number of those relationships whose Outcome is not ACCEPTED
```

An Outcome associated with multiple Departments contributes once to each owning Department.

Department share is:

```text
Department Share
= min(100, round(Department total / all Department ownership rows * 100))
```

This is a share of ownership relationships, not a unique-Outcome percentage.

## VisiWork Derived State

VisiWork is an operational projection.
It does not own separate Project, WorkSession, Department, or Schedule truth.

### Project Participants

```text
Project Participants
= unique(Project Lead + every Outcome Member across the Project)
```

### Project Working Members

A Project participant appears as working on a Project when:

```text
Team Member.working_now = true
AND
focused Department is associated with the Project
```

Focused Department is:

```text
Member.visiwork_department_id when present
otherwise Member.department_id
```

### VisiWork Project Progress

Use the canonical Project progress metric when available.

Fallback:

```text
DONE Project -> 100
otherwise -> 0
```

### Current Stage

```text
Current Stage
= first Stage in workflow order containing a non-accepted Outcome
```

If every Stage is complete, use the last Stage.
If no Stage exists, the value is null.

### Department Member List

A Member appears in a VisiWork Department when either:

```text
Member.department_id = Department
OR
Member.visiwork_department_id = Department
```

### Department Working Members

```text
Department Working Members
= Department Members where Team Member.working_now = true
  and focused Department = that Department
```

### Department Projects

```text
Department Projects
= non-ARCHIVED Projects associated with that Department
```

Project grouping is by `PLANNING`, `IN_PROGRESS`, and `DONE`.

## Zero, Missing, and Empty Semantics

Use zero only when the underlying scope is valid and the calculated quantity is zero.

Use an intentional empty state when no records exist.

Do not display `NaN`, `Infinity`, fabricated sample metrics, or stale fallback totals as real business values.

A failed request is an error state, not a zero metric.

## Refresh and Consistency

Home, Team, VisiWork, Project Chat, and Reports may use query invalidation or polling to refresh derived views.

Refresh mechanisms do not change the source of truth.

```text
Persistent domain record
-> canonical service/read model
-> derived metric
-> UI
```

Never reverse this flow by treating the displayed metric as authoritative business state.

## Implementation References

Current formula ownership is concentrated in:

- `server/projects/projects.service.ts`
- `server/home/home.service.ts`
- `src/features/reports/reports-model.ts`
- `src/features/visiwork/visiwork-model.ts`
- WorkSession and Team services/contracts for scheduled and actual time

Changes to those formulas should update this document in the same change.
