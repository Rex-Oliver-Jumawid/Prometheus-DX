# Prometheus Data Model

## 1. Purpose

This document defines the proposed relational data model for the Prometheus Centralized Workflow Management System.

The model translates the Software Requirements Specification and `user-flows.md` into persistent entities, relationships, constraints, derived values, and audit history.

This document should be finalized before `prisma/schema.prisma` is treated as stable.

The data model is designed for Supabase PostgreSQL, Prisma ORM, NestJS business logic, Supabase Auth identity, and Supabase Storage attachments.

---

# 2. Core Design Principles

1. Authentication identity and Prometheus membership are separate.
2. Organization authority, Project Lead authority, Project Member access, and Outcome Membership are independent concepts.
3. Project creation grants no continuing authority to the creator.
4. Project participation originates from Outcome Membership.
5. Project Members default to `CAN_VIEW`, while the Project Lead may grant `CAN_EDIT`.
6. Outcome Membership is permanent once created.
7. Each Outcome has one shared submission history.
8. Multiple submissions may be under review simultaneously.
9. Outcome acceptance applies to the Outcome rather than to one submission.
10. Historical acceptance and credit must remain reconstructable after reopening.
11. Departments provide organization and responsibility context, not access control.
12. Historical business events should be appended rather than silently overwritten.
13. Lifecycle state, review state, and dependency state must not be conflated.
14. Timestamps are stored in UTC and converted for display.

---

# 3. High-Level Relationship Model

```text
Supabase Auth
      |
      | auth_user_id
      v
    Member
      |
      +------------------------+
      |                        |
      | created_by             | lead
      v                        v
    Project ---------------- Member
      |
      +----< ProjectMember >---- Member
      |
      +----< ProjectDepartment >---- Department
      |
      +----< Stage
                |
                +----< Outcome
                         |
                         +----< OutcomeMember >---- Member
                         |
                         +----< OutcomeDepartment >---- Department
                         |
                         +----< AcceptanceCriterion
                         |
                         +----< Feature
                         |       |
                         |       +----< Task
                         |
                         +----< OutcomeDependency
                         |
                         +----< OutcomeSubmission
                         |       |
                         |       +----< SubmissionAttachment
                         |       +----< SubmissionReview
                         |
                         +----< OutcomeRevisionRequest
                         |
                         +----< OutcomeAcceptance
                                 |
                                 +----< OutcomeAcceptanceMember
```

Project Membership is created automatically when a member joins their first Outcome in a Project.

Outcome Membership remains the source of participation.

---

# 4. Authentication and Member Model

Supabase Auth is responsible for authentication credentials and sessions.

Prometheus does not store passwords.

```text
Supabase auth.users.id
        |
        v
Member.auth_user_id
```

A successfully authenticated account without a matching active Prometheus `Member` record does not receive workspace access.

Every protected backend request must verify that the associated Prometheus Member remains `ACTIVE`.

---

# 5. Member

```text
Member
------
id
auth_user_id
email
full_name
department_id
position
workspace_role
status
profile_image_path
invitation_sent_at
deactivated_at
created_at
updated_at
```

## `workspace_role`

```text
ADMINISTRATOR
MEMBER
```

Project Lead must not appear in this field.

## `status`

```text
INVITED
ACTIVE
DEACTIVATED
```

## `department_id`

A Member has one primary organizational Department.

```text
Member.department_id
-> Department.id
```

The primary Department is used for organization and reporting and does not restrict which Projects or Outcomes the Member may access.

## `invitation_sent_at`

Nullable UTC timestamp recording the latest invitation or account-setup email that the configured transactional email service accepted for delivery.

This timestamp is delivery evidence only.

It does not activate the Member and does not prove that authentication setup is complete.

Only a successfully authenticated, confirmed Supabase identity linked authoritatively by the backend may move an eligible invited Member to `ACTIVE`.

## `deactivated_at`

Nullable UTC timestamp recording when workspace access was deactivated.

Historical project, Outcome, submission, credit, activity, and work-session records remain linked to the Member after deactivation.

---

# 6. Member Deactivation

Only an Administrator may deactivate a Member.

A Member who currently leads any non-archived Project must not be deactivated until an active replacement Project Lead is selected for every such Project.

The deactivation flow is:

```text
Administrator requests deactivation
        |
        v
Does Member lead non-archived Projects?
        |
     +--+--+
     |     |
    No    Yes
     |     |
     |     v
     |   Require replacement Lead
     |   for every affected Project
     |     |
     +-----+
        |
        v
Member.status = DEACTIVATED
Member.deactivated_at = now()
        |
        v
Existing Prometheus sessions become unusable
because backend authorization rejects non-active Members
```

The authentication layer should also revoke or invalidate active authentication sessions when practical.

Deactivation does not delete or rewrite:

- Outcome Memberships.
- Accepted Outcome credit.
- Project Member records.
- Submissions.
- Submission reviews.
- Project creation history.
- Activity logs.
- Schedule history.
- Work sessions.

Any historical `CAN_EDIT` record becomes ineffective while the Member is deactivated.

---

# 7. Department

```text
Department
----------
id
name
short_label
description
created_at
updated_at
```

Departments are organizational and reporting metadata rather than security boundaries.

`short_label` is a compact display label of at most 12 characters used where the full Department name does not fit.

The semantics are:

```text
Member
-> Primary Department

Project
-> Associated Departments

Outcome
-> Responsible Departments
```

A Member from one Department may view and join Outcomes associated with another Department.

Department relationships may be used for filtering, dashboards, reports, capacity analysis, and responsibility context.

Department relationships must not independently grant or deny Project or Outcome access.

---

# 8. Project

```text
Project
-------
id
name
description
status
created_by_member_id
lead_member_id
assistant_lead_member_id
done_at
archived_at
created_at
updated_at
```

## `created_by_member_id`

```text
Project.created_by_member_id
-> Member.id
```

This field exists for audit purposes only.

The creator receives no special authority because of project creation.

## `lead_member_id`

```text
Project.lead_member_id
-> Member.id
```

Project Lead authority comes from this relationship.

Administrator status does not automatically grant Project Lead authority.

## `assistant_lead_member_id`

Optional relationship retained for the current interface concept.

Assistant Lead permissions remain intentionally undefined until explicitly planned.

Assistant Lead must not automatically inherit Project Lead authority.

## `status`

```text
PLANNING
IN_PROGRESS
DONE
ARCHIVED
```

`PLANNING`, `IN_PROGRESS`, and `DONE` are manually configurable.

`ARCHIVED` is system-managed.

## `done_at`

UTC timestamp indicating when the Project most recently entered `DONE`.

If the Project leaves `DONE` before automatic archival, `done_at` becomes `NULL`.

If it enters `DONE` again, `done_at` receives a new timestamp.

## `archived_at`

UTC timestamp when automatic archival occurs.

```text
status = DONE
AND
done_at <= now() - 14 days

-> ARCHIVED
```

The archive timer must not use `updated_at`.

---

# 9. Project Status History

```text
ProjectStatusHistory
--------------------
id
project_id
from_status
to_status
changed_by_member_id
change_source
created_at
```

## `change_source`

```text
USER
SYSTEM
```

`changed_by_member_id` is nullable for system-generated transitions such as automatic archival.

Every Project status change must create a history row.

---

# 10. Project Department

```text
ProjectDepartment
-----------------
project_id
department_id
created_at
```

Constraint:

```text
UNIQUE(project_id, department_id)
```

These are Associated Departments and do not control visibility or authorization.

---

# 11. Project Member

A Project Member is a Member who belongs to at least one Outcome in the Project.

Project Members are not manually added.

```text
ProjectMember
-------------
project_id
member_id
access_level
created_at
updated_at
```

Constraint:

```text
UNIQUE(project_id, member_id)
```

## `access_level`

```text
CAN_VIEW
CAN_EDIT
```

Default:

```text
CAN_VIEW
```

Only the Project Lead may change a Project Member's access level.

Administrator status does not provide a project-level override.

At minimum, `CAN_EDIT` allows the Project Member to change Project status.

`CAN_EDIT` does not grant Project Lead-only operations.

When a Member joins their first Outcome in a Project, `OutcomeMember` and the missing `ProjectMember` row must be created in the same transaction.

---

# 12. Project Member Access History

```text
ProjectMemberAccessHistory
--------------------------
id
project_id
member_id
previous_access
new_access
changed_by_member_id
created_at
```

`changed_by_member_id` must be the Project Lead at the time of the change.

The history is append-only.

---

# 13. Stage

```text
Stage
-----
id
project_id
name
description
position
created_at
updated_at
```

Only the Project Lead may create and manage Stages under the current rules.

---

# 14. Outcome

```text
Outcome
-------
id
stage_id
title
description
lifecycle_status
position
created_by_member_id
accepted_at
created_at
updated_at
```

## `lifecycle_status`

Outcome lifecycle state is deliberately separate from review and dependency conditions.

```text
OPEN
NEEDS_REVISION
ACCEPTED
```

`LOCKED` is not an Outcome lifecycle status.

`FOR_REVIEW` is not an Outcome lifecycle status.

### Dependency condition

```text
is_locked =
exists unresolved OutcomeDependency
```

### Review condition

```text
has_for_review =
exists OutcomeSubmission
where review_status = FOR_REVIEW
```

### Revision condition

`NEEDS_REVISION` is an explicit Outcome lifecycle state created by a Project Lead revision request.

Submitting new work does not automatically clear `NEEDS_REVISION`.

The Project Lead may later accept the Outcome or explicitly return it to `OPEN` when revision is considered addressed.

### Reopening

When an accepted Outcome is reopened:

```text
lifecycle_status = OPEN
accepted_at = NULL
```

Previous acceptance history remains in `OutcomeAcceptance`.

---

# 15. Outcome Department

```text
OutcomeDepartment
-----------------
outcome_id
department_id
created_at
```

Constraint:

```text
UNIQUE(outcome_id, department_id)
```

These represent Responsible Departments.

They do not prevent Members of other Departments from joining the Outcome.

---

# 16. Outcome Member

```text
OutcomeMember
-------------
outcome_id
member_id
joined_at
```

Constraint:

```text
UNIQUE(outcome_id, member_id)
```

Outcome Membership is permanent.

There is no `left_at`, `removed_at`, or `removed_by` field because Outcome Members cannot leave and Project Leads cannot remove them.

Any active authorized Member may join while the Outcome is not currently `ACCEPTED`.

A Member may join while the Outcome is locked, has submissions for review, or is in `NEEDS_REVISION`.

If an accepted Outcome is reopened, new Members may join again.

---

# 17. Outcome Dependency

```text
OutcomeDependency
-----------------
id
outcome_id
prerequisite_outcome_id
override_resolved_at
override_resolved_by_member_id
override_reason
created_at
```

Constraints:

```text
UNIQUE(outcome_id, prerequisite_outcome_id)

outcome_id != prerequisite_outcome_id
```

Dependencies should reference Outcomes belonging to the same Project.

A dependency is resolved when the prerequisite is currently `ACCEPTED` or a Project Lead override has resolved the dependency.

Whether reopening an accepted prerequisite should relock dependent Outcomes remains intentionally unresolved and must be decided before the dependency API is finalized.

---

# 18. Acceptance Criterion

```text
AcceptanceCriterion
-------------------
id
outcome_id
description
position
created_at
updated_at
```

Only the Project Lead manages Acceptance Criteria under the current permission model.

---

# 19. Feature

```text
Feature
-------
id
outcome_id
title
description
position
created_by_member_id
created_at
updated_at
```

Outcome Members may create and edit Features when the Outcome workflow permits work.

---

# 20. Task

```text
Task
----
id
feature_id
title
description
status
position
created_by_member_id
completed_by_member_id
completed_at
created_at
updated_at
```

## `status`

```text
TODO
DONE
```

Task assignment to individual Members is not required by the current Outcome Membership model.

Outcome Members collaborate on the shared Outcome workspace.

---

# 21. Outcome Submission

Each Outcome has one shared submission history.

```text
OutcomeSubmission
-----------------
id
outcome_id
submitted_by_member_id
note
review_status
created_at
```

## `review_status`

```text
FOR_REVIEW
REVIEWED
```

Outcome acceptance must not be represented as `Submission = ACCEPTED` because acceptance applies to the Outcome as a whole.

Only Outcome Members may submit.

Multiple submissions may simultaneously be `FOR_REVIEW`.

A new submission does not replace or invalidate older submissions.

Outcome Members may continue adding submissions while the Outcome is not accepted and submission is not blocked by dependency rules.

Submission records should be append-only whenever practical.

---

# 22. Submission Attachment

```text
SubmissionAttachment
--------------------
id
submission_id
storage_path
file_name
mime_type
size_bytes
created_at
```

File bytes are stored in Supabase Storage.

PostgreSQL stores metadata and the Storage reference.

---

# 23. Submission Review

```text
SubmissionReview
----------------
id
submission_id
reviewed_by_member_id
review_note
created_at
```

Only the Project Lead may create review records.

Reviewing a Submission may change its `review_status` to `REVIEWED` without accepting the Outcome.

Reviewed and unreviewed Submissions may coexist in the same Outcome history.

---

# 24. Outcome Revision Request

```text
OutcomeRevisionRequest
----------------------
id
outcome_id
requested_by_member_id
message
created_at
resolved_at
resolved_by_member_id
```

Only the Project Lead may request or resolve a revision state.

Creating an unresolved request sets:

```text
Outcome.lifecycle_status = NEEDS_REVISION
```

Outcome Members may continue joining, working, and submitting while revision is required, subject to dependency rules.

Submitting new work does not automatically resolve the revision request.

When the Project Lead marks the revision addressed without accepting the Outcome:

```text
resolved_at = now()
resolved_by_member_id = Project Lead
Outcome.lifecycle_status = OPEN
```

---

# 25. Outcome Acceptance

```text
OutcomeAcceptance
-----------------
id
outcome_id
accepted_by_member_id
accepted_at
reopened_by_member_id
reopened_at
```

Every acceptance creates a new row.

When the Project Lead accepts an Outcome:

```text
Create OutcomeAcceptance
Outcome.lifecycle_status = ACCEPTED
Outcome.accepted_at = now()
```

New Outcome Members and new Submissions stop while the Outcome remains accepted.

When the Project Lead reopens the Outcome:

```text
latest OutcomeAcceptance.reopened_at = now()
latest OutcomeAcceptance.reopened_by_member_id = Project Lead
Outcome.lifecycle_status = OPEN
Outcome.accepted_at = NULL
```

Reopening does not remove existing Outcome Members, submissions, or previous acceptance history.

---

# 26. Outcome Acceptance Member

```text
OutcomeAcceptanceMember
-----------------------
acceptance_id
member_id
```

Constraint:

```text
UNIQUE(acceptance_id, member_id)
```

When an Outcome is accepted, the system snapshots every current Outcome Member into this table.

This preserves historical credit if additional Members join after a later reopen.

No contribution threshold is required for inclusion in the acceptance snapshot.

---

# 27. Project Participation and My Projects

There is no manually assigned Project Participant relationship.

Participation exists when a `ProjectMember` record exists, which originates from Outcome Membership.

**Leading** is derived from:

```text
Project.lead_member_id = current Member
```

**Participating** is derived from:

```text
ProjectMember.member_id = current Member
AND
Project.lead_member_id != current Member
```

A Project Lead may also be an Outcome Member inside the same Project.

The interface may show such a Project only under **Leading** to avoid duplication.

---

# 28. Effective Permission Evaluation

Effective authorization is determined by combining independent relationships.

```text
Member.workspace_role
        +
Project.lead_member_id
        +
ProjectMember.access_level
        +
OutcomeMember membership
        =
Effective permissions
```

Examples:

```text
Registry access
-> workspace_role = ADMINISTRATOR

Project Lead operations
-> Project.lead_member_id = current Member

Project status edit
-> Project Lead OR ProjectMember.access_level = CAN_EDIT

Outcome work/submission
-> OutcomeMember exists and Outcome workflow permits work
```

Administrator status does not override Project or Outcome permissions.

---

# 29. Notification

```text
Notification
------------
id
member_id
type
entity_type
entity_id
data
read_at
created_at
```

`data` may use PostgreSQL `JSONB` for notification-specific display metadata.

Initial in-app notification targeting is:

| Event | Recipients |
| --- | --- |
| Project Lead assigned | New Project Lead |
| `CAN_EDIT` granted or revoked | Affected Project Member |
| Member joins Outcome | Project Lead |
| Submission created | Project Lead |
| Revision requested | All current Outcome Members |
| Outcome accepted | All current Outcome Members |
| Outcome reopened | All current Outcome Members |
| Dependency unlocked | Outcome Members of the dependent Outcome |
| User mentioned | Mentioned Member |
| Message reply | Member being replied to |
| Project automatically archived | Project Lead and Project Members |

Normal project notifications are initially in-app notifications.

Brevo remains intended for invitation and account-setup email rather than routine project notifications.

---

# 30. Project Communication

```text
ProjectMessage
--------------
id
project_id
outcome_id
member_id
parent_message_id
body
created_at
edited_at
```

`outcome_id` is nullable.

`parent_message_id` is nullable and supports replies.

Read permissions:

```text
All active authorized Prometheus Members
-> may read company-visible Project communication
```

Write permissions for general Project chat:

```text
Project Lead
OR
Project Member
-> may write
```

Write permissions for Outcome-specific discussion:

```text
Project Lead
OR
Outcome Member of that Outcome
-> may write
```

An authorized user who is only browsing a Project may read but does not gain chat write permission until they become a Project Member.

---

# 31. Progress and Dashboard Derivations

Progress formulas must be canonical so every screen displays the same values.

## Project Progress

```text
accepted current Outcomes
------------------------- x 100
total Outcomes
```

Project status remains independent from Project progress.

A Project may therefore be `DONE` while Project progress is below 100 percent.

If a previously accepted Outcome is reopened, it is no longer counted as currently accepted and Project progress may decrease.

If a Project has no Outcomes, progress should be represented as unavailable rather than inventing a percentage.

## Stage Progress

```text
accepted current Outcomes in Stage
---------------------------------- x 100
total Outcomes in Stage
```

## Outcome Work Progress

For a non-accepted Outcome with Tasks:

```text
completed Tasks
--------------- x 100
total Tasks
```

If an Outcome has no Tasks, work progress is unavailable.

If the Outcome is `ACCEPTED`, Outcome completion is displayed as 100 percent regardless of the Task ratio.

## Working Now

```text
Member has a WorkSession
where time_out IS NULL
```

## Member Workload

Initial workload is defined as:

```text
COUNT of non-accepted Outcomes
where Member has OutcomeMembership
```

No weighted workload score is required for the initial implementation.

## Needs Attention

For a Project Lead, Needs Attention may include:

- Submissions currently awaiting review.
- Open revision workflows requiring Lead action.
- Blocked Outcomes requiring a dependency decision.

For an Outcome Member, Needs Attention may include:

- Revision requested on an Outcome they joined.
- A previously blocked joined Outcome becoming available.

---

# 32. Activity Log

`ActivityLog` is append-only.

```text
ActivityLog
-----------
id
actor_member_id
project_id
outcome_id
entity_type
entity_id
action
metadata
created_at
```

`actor_member_id` is nullable for system-generated events.

`metadata` may use `JSONB` and should include previous and new values for sensitive changes when applicable.

Recommended events include:

```text
MEMBER_INVITED
MEMBER_ACTIVATED
MEMBER_DEACTIVATED

PROJECT_CREATED
PROJECT_LEAD_CHANGED
PROJECT_MEMBER_ACCESS_CHANGED
PROJECT_STATUS_CHANGED
PROJECT_ARCHIVED

STAGE_CREATED
STAGE_UPDATED

OUTCOME_CREATED
OUTCOME_JOINED
OUTCOME_UPDATED
OUTCOME_DEPENDENCY_OVERRIDDEN

FEATURE_CREATED
TASK_CREATED
TASK_COMPLETED

SUBMISSION_CREATED
SUBMISSION_REVIEWED
REVISION_REQUESTED
REVISION_RESOLVED
OUTCOME_ACCEPTED
OUTCOME_REOPENED

SCHEDULE_UPDATED

WORK_SESSION_STARTED
WORK_SESSION_ENDED
WORK_SESSION_FLAGGED_FOR_CORRECTION
WORK_SESSION_CORRECTED
```

Ordinary read actions such as opening a Project do not require audit records.

The Activity Log complements dedicated relational history tables rather than replacing them.

---

# 33. Member Schedule

```text
MemberSchedule
--------------
id
member_id
target_weekly_minutes
created_at
updated_at
```

One active schedule should normally exist per Member.

---

# 34. Schedule Block

```text
ScheduleBlock
-------------
id
schedule_id
weekday
start_time
end_time
created_at
updated_at
```

Schedule times describe planned local working periods.

Persistent event timestamps are still stored in UTC.

---

# 35. Schedule Override

```text
ScheduleOverride
----------------
id
member_id
date
start_time
end_time
is_rest_day
created_at
updated_at
```

Detailed override behavior may be refined later without changing the core authorization model.

---

# 36. Work Session

```text
WorkSession
-----------
id
member_id
time_in
time_out
status
created_at
updated_at
```

## `status`

```text
OPEN
COMPLETED
NEEDS_CORRECTION
```

All `time_in`, `time_out`, and correction timestamps are stored in UTC.

The initial workspace display timezone is configured as:

```text
Asia/Manila
```

The timezone is a presentation/configuration concern and is not baked into stored UTC timestamps.

Only one unresolved WorkSession may exist for a Member at a time.

Conceptually:

```text
UNIQUE active session per member
where time_out IS NULL
```

A Member may not Time In again while an existing session has no valid Time Out.

Cross-midnight WorkSessions are valid and remain one WorkSession.

A session that remains open beyond the configured maximum-session threshold is marked `NEEDS_CORRECTION` rather than being silently auto-closed.

A Member with a `NEEDS_CORRECTION` open session must correct that session before starting another.

Project Leads and Administrators do not receive automatic authority to edit another Member's WorkSessions.

---

# 37. Work Session Correction

```text
WorkSessionCorrection
---------------------
id
work_session_id
member_id
previous_time_in
previous_time_out
new_time_in
new_time_out
reason
created_at
```

Members may correct their own WorkSessions and must provide a reason.

The correction record preserves the previous and new values.

The original history must not be silently overwritten without this record.

After a valid correction closes a `NEEDS_CORRECTION` WorkSession:

```text
WorkSession.status = COMPLETED
```

If future HR or timekeeping override authority is required, it must be introduced as an explicit permission rather than assumed from Administrator or Project Lead status.

---

# 38. Recommended Enums

## WorkspaceRole

```text
ADMINISTRATOR
MEMBER
```

## MemberStatus

```text
INVITED
ACTIVE
DEACTIVATED
```

## ProjectStatus

```text
PLANNING
IN_PROGRESS
DONE
ARCHIVED
```

## ProjectAccessLevel

```text
CAN_VIEW
CAN_EDIT
```

## OutcomeLifecycleStatus

```text
OPEN
NEEDS_REVISION
ACCEPTED
```

## SubmissionReviewStatus

```text
FOR_REVIEW
REVIEWED
```

## TaskStatus

```text
TODO
DONE
```

## WorkSessionStatus

```text
OPEN
COMPLETED
NEEDS_CORRECTION
```

## StatusChangeSource

```text
USER
SYSTEM
```

---

# 39. Derived Values

The following values should be calculated rather than maintained as competing stored states.

## Project Participation

```text
ProjectMember exists
```

## Outcome Locked

```text
TRUE
if unresolved OutcomeDependency exists
```

## Outcome Has Work For Review

```text
TRUE
if OutcomeSubmission.review_status = FOR_REVIEW exists
```

## Outcome Has Open Revision

```text
TRUE
if unresolved OutcomeRevisionRequest exists
```

## Project Auto Archive Eligibility

```text
Project.status = DONE
AND
Project.done_at <= now() - 14 days
```

## Working Now

```text
WorkSession.time_out IS NULL
AND
WorkSession.status = OPEN
```

---

# 40. Important Database Constraints

Recommended constraints include:

```text
Member.email
UNIQUE using normalized case-insensitive comparison
```

```text
Member.auth_user_id
UNIQUE when not NULL
```

```text
ProjectMember
UNIQUE(project_id, member_id)
```

```text
OutcomeMember
UNIQUE(outcome_id, member_id)
```

```text
ProjectDepartment
UNIQUE(project_id, department_id)
```

```text
OutcomeDepartment
UNIQUE(outcome_id, department_id)
```

```text
OutcomeDependency
UNIQUE(outcome_id, prerequisite_outcome_id)
```

```text
OutcomeDependency.outcome_id
!=
OutcomeDependency.prerequisite_outcome_id
```

```text
OutcomeAcceptanceMember
UNIQUE(acceptance_id, member_id)
```

PostgreSQL should enforce at most one WorkSession with `time_out IS NULL` per Member through a partial unique index when practical.

NestJS must still enforce business rules that cannot be represented safely by simple relational constraints.

---

# 41. Transaction Boundaries

## Join Outcome

```text
Validate Member ACTIVE
Validate Outcome is not ACCEPTED
Create OutcomeMember
Create ProjectMember if missing with CAN_VIEW
Create ActivityLog
```

These operations occur atomically.

## Accept Outcome

```text
Validate current Member is Project Lead
Create OutcomeAcceptance
Snapshot all current OutcomeMembers into OutcomeAcceptanceMember
Set Outcome.lifecycle_status = ACCEPTED
Set Outcome.accepted_at = now()
Create ActivityLog
```

## Reopen Outcome

```text
Validate current Member is Project Lead
Update latest OutcomeAcceptance.reopened_at
Update latest OutcomeAcceptance.reopened_by_member_id
Set Outcome.lifecycle_status = OPEN
Clear Outcome.accepted_at
Create ActivityLog
```

## Change Project Status

```text
Validate Project Lead OR ProjectMember CAN_EDIT
Update Project.status

If entering DONE:
    Project.done_at = now()

If leaving DONE before archive:
    Project.done_at = NULL

Create ProjectStatusHistory
Create ActivityLog
```

## Deactivate Member

```text
Validate current Member is Administrator
Find non-archived Projects led by target Member
Require active replacement Lead for every affected Project
Reassign those Project leads
Set target Member.status = DEACTIVATED
Set target Member.deactivated_at = now()
Create ActivityLog entries
```

Lead reassignment and deactivation should occur atomically when practical.

## Correct Work Session

```text
Validate Member owns WorkSession
Validate corrected timestamps
Create WorkSessionCorrection with previous/new values and reason
Update WorkSession
Create ActivityLog
```

---

# 42. Indexing Recommendations

Recommended indexes include:

```text
Member(email)
Member(auth_user_id)
Member(status)

Project(lead_member_id)
Project(status)
Project(done_at)

ProjectMember(member_id)
ProjectMember(project_id)

Stage(project_id)

Outcome(stage_id)
Outcome(lifecycle_status)

OutcomeMember(member_id)
OutcomeMember(outcome_id)

OutcomeSubmission(outcome_id, created_at)
OutcomeSubmission(review_status)

OutcomeAcceptance(outcome_id, accepted_at)

Notification(member_id, read_at, created_at)

ProjectMessage(project_id, created_at)
ProjectMessage(outcome_id, created_at)

ActivityLog(project_id, created_at)
ActivityLog(outcome_id, created_at)
ActivityLog(actor_member_id, created_at)

WorkSession(member_id, time_in)
WorkSession(member_id, status)
```

Exact indexes should be validated against real query patterns once implementation begins.

---

# 43. Records That Should Not Be Hard Deleted

Historical business records should normally not be hard deleted after meaningful activity exists.

This includes:

```text
Member
Project
ProjectStatusHistory
ProjectMember
ProjectMemberAccessHistory
Outcome
OutcomeMember
OutcomeSubmission
SubmissionReview
OutcomeRevisionRequest
OutcomeAcceptance
OutcomeAcceptanceMember
ActivityLog
WorkSession
WorkSessionCorrection
```

Where removal from the active product is required, deactivation, archival, or another explicit lifecycle state should generally be preferred.

---

# 44. Tables Not Required

A separate `ProjectLead` table is not required because the current Lead is stored directly on `Project`.

A manually assigned `ProjectParticipant` table is not required because participation originates from Outcome Membership.

The old `OutcomeAssignment` model is not required because users join Outcomes through `OutcomeMember`.

---

# 45. Current Core Schema

```text
Member
Department

Project
ProjectStatusHistory
ProjectDepartment
ProjectMember
ProjectMemberAccessHistory

Stage

Outcome
OutcomeDepartment
OutcomeMember
OutcomeDependency
AcceptanceCriterion

Feature
Task

OutcomeSubmission
SubmissionAttachment
SubmissionReview
OutcomeRevisionRequest
OutcomeAcceptance
OutcomeAcceptanceMember

Notification
ProjectMessage
ActivityLog

MemberSchedule
ScheduleBlock
ScheduleOverride
WorkSession
WorkSessionCorrection
```

---

# 46. Canonical Participation Model

```text
ACTIVE PROMETHEUS MEMBER
        |
        v
Can view every Project
        |
        v
Can view every Outcome
        |
        v
Joins an Outcome
        |
        +-> OutcomeMember created
        |
        +-> ProjectMember created if missing
                |
                v
          access = CAN_VIEW
                |
                v
Project Lead may grant CAN_EDIT
```

Outcome Membership determines where a Member may work.

Project Member access determines additional project-level editing capability.

Project Lead determines Project-management authority.

Administrator determines organization-level administrative authority.

Department does not determine authorization.

---

# 47. Decisions Still Intentionally Deferred

The following topics remain unresolved and should be decided before the affected API contracts are treated as final:

- Assistant Lead permissions.
- Whether an archived Project can be restored and who may restore it.
- Whether reopening an accepted prerequisite automatically relocks dependent Outcomes.
- The exact maximum duration used to automatically flag an open WorkSession as `NEEDS_CORRECTION`.
- Detailed data-retention duration if Prometheus later requires deletion or compliance policies.

The major Department, deactivation, notification, communication, progress, time-tracking, and audit-history semantics are no longer deferred.

---

# 48. Data Model Principle

The central authorization rule is:

```text
Organization authority
!=
Project authority
!=
Project edit access
!=
Outcome participation
```

Effective authorization is determined from:

```text
Member.workspace_role
        +
Project.lead_member_id
        +
ProjectMember.access_level
        +
OutcomeMember membership
```

The central state-modeling rule is:

```text
Lifecycle state
!=
Review state
!=
Dependency state
```

This separation must remain intact throughout PostgreSQL, Prisma, NestJS, and the React frontend.
