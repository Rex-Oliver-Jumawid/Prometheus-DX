# Prometheus Data Model

## 1. Purpose

This document defines the canonical relational data model for the Prometheus Centralized Workflow Management System and distinguishes implemented release entities from explicitly planned extensions.

The model translates the Software Requirements Specification and `user-flows.md` into persistent entities, relationships, constraints, derived values, and audit history.

The implemented schema is represented by `prisma/schema.prisma` and tracked migrations.

The data model is designed for Supabase PostgreSQL, Prisma ORM, NestJS business logic, Supabase Auth identity, and optional Supabase Storage for future file-bearing flows.

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
                         |       +----< SubmissionReview
                         |       +----< SubmissionAttachment [planned extension]
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

## Department deletion and reference diagnostics

A Department with zero Members is not necessarily deletable.

Deletion is blocked while relational references still exist, including current references from:

- Members.
- Project-to-Department associations.
- Outcome-to-Department associations.

Registry should expose reference counts so the Administrator can distinguish an empty Department from a referenced Department.

```text
0 Members
!=
0 Department references
```

The backend remains authoritative.
If a relational foreign key still references the Department, deletion must fail rather than orphan business records.

Before deleting a referenced Department, reassign Members and remove or change the applicable Project/Outcome associations deliberately.

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

`CAN_EDIT` grants Project editor authority to change Project status, manage Stages and Outcomes, review submissions, manage revision decisions, accept or reopen Outcomes, and override dependencies.

`CAN_EDIT` does not grant authority to manage another Project Member's access level and does not make the Member the Project Lead.

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

The Project Lead or a Project Member with `CAN_EDIT` may create and manage Stages.

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
Outcome.lifecycle_status != ACCEPTED
AND exists unresolved OutcomeDependency
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

A dependency is resolved when the prerequisite is currently `ACCEPTED` or a Project editor override has resolved the dependency.

Reopening an accepted prerequisite relocks unfinished dependent Outcomes unless their dependency edge has an explicit Project editor override.
Accepted dependent Outcomes retain their acceptance and credit history; reopening a prerequisite never automatically reopens them.
If an accepted dependent Outcome is itself later reopened, its unresolved prerequisites block execution and submission again.
Overrides apply to individual dependency edges and do not change the prerequisite Outcome's lifecycle.

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

The Project Lead or a Project Member with `CAN_EDIT` may manage Acceptance Criteria as part of Outcome editing.

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

As demonstrated by the canonical prototype, an unresolved dependency allows Outcome Members to plan Features and Tasks.
It blocks Task completion changes and Output submission until resolved.
Accepted Outcomes are closed to Feature and Task mutations until reopened.
Edits carry the last observed `updated_at`; a stale edit is rejected rather than overwriting another Member's work.

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
content
note
review_status
request_id
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

`content` stores the required output name, text, or HTTP(S) link demonstrated by the prototype, separately from optional `note`.
`request_id` is a client-generated UUID scoped uniquely to the Outcome and submitter, so retrying the same intended submission cannot append duplicate history.
Reusing a request ID with different content is rejected.
Version labels are derived from deterministic chronological history ordering rather than stored as another mutable sequence.

### Outcome Output Draft

`OutcomeOutputDraft` stores `outcome_id`, `member_id`, `content`, `note`, and `updated_at`.
Its primary key is `(outcome_id, member_id)`.
This implements the prototype's Save draft control with PostgreSQL persistence rather than local storage.
Only the owning Outcome Member reads or changes their draft.
Submitting appends to the one shared Outcome history and clears that member's draft atomically.
Draft edits carry the last observed update timestamp to reject stale overwrites.

---

# 22. Submission Attachment - Planned Extension

`SubmissionAttachment` is a canonical future extension for binary Outcome submission evidence.

It is **not** part of the current release Prisma schema.

The current Outcome submission flow stores output text/name or HTTP(S) link plus optional note.

When binary submission attachments are implemented, use the following model shape:

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
criteria_snapshot
created_at
```

The Project Lead or a Project Member with `CAN_EDIT` may create review records.

Reviewing a Submission may change its `review_status` to `REVIEWED` without accepting the Outcome.

Reviewed and unreviewed Submissions may coexist in the same Outcome history.

`criteria_snapshot` preserves the criterion descriptions and verification decisions at review time, even if the Lead later edits the Outcome criteria.

### Outcome Review Draft

`OutcomeReviewDraft` stores `outcome_id`, `member_id`, `criterion_ids`, `note`, and `updated_at`, uniquely per Outcome and reviewing Lead.
It persists the prototype's review checklist and feedback as unfinished review preparation.
It grants no authority and does not change submission status or Outcome lifecycle.
The current Project Lead or a Project Member with `CAN_EDIT` may read or change their own review preparation.
Acceptance revalidates the current criteria, Outcome version, and submission set against canonical records.

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

The Project Lead or a Project Member with `CAN_EDIT` may request or resolve a revision state.

Creating an unresolved request sets:

```text
Outcome.lifecycle_status = NEEDS_REVISION
```

Outcome Members may continue joining, working, and submitting while revision is required, subject to dependency rules.

Submitting new work does not automatically resolve the revision request.

When the Project Lead marks the revision addressed without accepting the Outcome:

```text
resolved_at = now()
resolved_by_member_id = Project Lead or CAN_EDIT Project Member
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
feedback
criteria_snapshot
```

Every acceptance creates a new row.

Acceptance requires at least one shared submission and verification of every current Acceptance Criterion against the combined submissions.
It does not require every Task to be complete.
`feedback` and `criteria_snapshot` preserve the Lead's decision and the criteria evaluated at acceptance time.
Acceptance resolves outstanding revision requests and marks pending submissions reviewed atomically with the acceptance event and membership credit snapshot.
Revision requests require feedback and at least one shared submission.
They preserve existing submission content while recording the Lead's review of currently pending submissions.

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
recipient_member_id
actor_member_id (nullable)
project_id (nullable)
outcome_id (nullable)
type
event_key
data
read_at
created_at
```

`recipient_member_id` owns the inbox, independently of organization role or Project Lead authority.

`actor_member_id`, `project_id`, and `outcome_id` are relational references to canonical entities, not identifiers hidden inside `data`.

`data` is PostgreSQL `JSONB` for small event-specific display details, such as a changed access level.

`event_key` identifies one authoritative source event and is unique with `recipient_member_id`.

The producer uses stable source identity, such as a Project, access-history row, submission, revision request, or acceptance, so retrying the same operation cannot create a duplicate notification.

`read_at` is null until the recipient marks the notification read.

List ordering uses `created_at DESC, id DESC` so equal timestamps still have a stable order.

Project and Outcome references become null if a linked resource is deleted, preserving the inbox record without granting access to missing context.

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
deleted_at
```

`outcome_id` is nullable.

A null `outcome_id` represents general Project Chat.

A non-null `outcome_id` is reserved for Outcome-specific discussion and must reference an Outcome in the same Project when that interface is implemented.

`parent_message_id` is nullable and supports replies.

`deleted_at` implements soft deletion so conversation position, reply references, and deep links can remain stable without exposing removed content as an active message.

```text
ProjectMessageMention
---------------------
message_id
member_id
```

The pair `(message_id, member_id)` is unique.

Mention relationships are durable identity references rather than presentation-only parsing.

General Project Chat mentions may target active Project participants represented by the Project Lead or Project Membership.

Mention notifications must be synchronized when mentions are added, retained, removed, or deleted.

```text
ProjectAnnouncement
-------------------
id
project_id
member_id
title
body
pinned_at
created_at
updated_at
```

Project announcements are Project-scoped, readable with normal Project communication, and posted by the Project Lead or a Project Member.

Only the Project Lead may pin or unpin an announcement.

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

Only the message author may edit or delete their message.

Archived Projects are read-only for Project Chat and announcement mutations.

## VisiWork messages

VisiWork collaboration uses separate persistent room-scoped records:

```text
VisiWorkMessage
---------------
id
department_id
member_id
body
edited_at
deleted_at
created_at
```

`department_id = NULL` represents General Chat.

A non-null `department_id` represents that Department's VisiWork room.

```text
VisiWorkMessageMention
----------------------
message_id
member_id
```

The pair `(message_id, member_id)` is unique.

VisiWork deletion is soft deletion.

Deleting a message preserves its identity and chronological position while replacing active content with a tombstone and clearing mention relationships.

General Chat is readable and writable by every active authorized Member.

Department Chat is company-readable.
Department Chat writes require the Member's home Department or current `visiwork_department_id` to match the room.

Search is room-scoped and excludes deleted content.

Exact-message context reads surrounding messages only from the target message's room.

## Collaboration attachment release scope

The current release does not persist binary attachments on Project Chat or VisiWork messages.

The existing `SubmissionAttachment` concept belongs to Outcome submission evidence and must not be treated as implemented chat attachment support.

If chat attachments are added later, storage-object references and authorization context must be persisted and checked server-side.
Possession of a storage URL alone must never grant access.

---

# 31. Progress and Dashboard Derivations

The canonical formula reference is `.context/derived-metrics.md`.

This section defines persistence relationships while `derived-metrics.md` owns exact cross-screen calculations.

## Project Progress

Current Project summary behavior is:

```text
if Project.status = DONE:
    progress = 100
else if total Outcomes = 0:
    progress = 0
else:
    progress = round(current accepted Outcomes / total Outcomes * 100)
```

Project status remains a separate concept from Outcome acceptance.

If a previously accepted Outcome is reopened, accepted-Outcome counts decrease and any progress derived from accepted Outcomes may decrease unless the Project is explicitly `DONE`.

Home, Reports & Analytics, Team, and VisiWork must not redefine this metric independently.
See `.context/derived-metrics.md` for filtered-report and dashboard formulas.

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
if Outcome.lifecycle_status != ACCEPTED and unresolved OutcomeDependency exists
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
Validate current Member is Project Lead OR ProjectMember CAN_EDIT
Create OutcomeAcceptance
Snapshot all current OutcomeMembers into OutcomeAcceptanceMember
Set Outcome.lifecycle_status = ACCEPTED
Set Outcome.accepted_at = now()
Create ActivityLog
```

## Reopen Outcome

```text
Validate current Member is Project Lead OR ProjectMember CAN_EDIT
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

Notification(recipient_member_id, created_at, id)
Notification(recipient_member_id, read_at, created_at, id)
Notification(recipient_member_id, event_key) UNIQUE

ProjectMessage(project_id, created_at)
ProjectMessage(outcome_id, created_at)
ProjectMessageMention(member_id)
ProjectAnnouncement(project_id, pinned_at, created_at)

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
SubmissionReview
OutcomeRevisionRequest
OutcomeAcceptance
OutcomeAcceptanceMember

Notification
ProjectMessage
ProjectMessageMention
ProjectAnnouncement
VisiWorkMessage
VisiWorkMessageMention
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

Project Member access determines project-level editing capability.
A Project Member with `CAN_EDIT` is a Project editor for the actions defined in `.context/authorization.md`.

Project Lead determines the remaining Lead-only authority, including Project Member access management and announcement pinning.

Administrator determines organization-level administrative authority.

Department does not determine authorization.

---

# 47. Decisions Still Intentionally Deferred

The following topics remain unresolved and should be decided before the affected API contracts are treated as final:

- Assistant Lead permissions.
- Whether an archived Project can be restored and who may restore it.
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
