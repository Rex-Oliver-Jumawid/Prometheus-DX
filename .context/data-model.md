# Prometheus Data Model

## 1. Purpose

This document defines the proposed relational data model for the Prometheus Centralized Workflow Management System.

The model translates the behavior defined in the Software Requirements Specification and `user-flows.md` into persistent entities, relationships, constraints, and derived states.

This document should be finalized before `prisma/schema.prisma` is treated as stable.

The data model is designed for:

- Supabase PostgreSQL
- Prisma ORM
- NestJS business logic
- Supabase Auth identity
- Supabase Storage attachments

---

# 2. Design Principles

The Prometheus data model follows several important principles.

1. Authentication identity and Prometheus membership are separate.
2. Organization roles are separate from project authority.
3. Project Lead is stored on the project and is not a global role.
4. Project creation grants no permanent authority to the creator.
5. Project participation originates from Outcome Membership.
6. Outcome Membership is permanent once created.
7. Project Member access is stored independently as `CAN_VIEW` or `CAN_EDIT`.
8. Outcome submissions use one shared history per outcome.
9. Multiple submissions may exist under review simultaneously.
10. Outcome acceptance applies to the outcome rather than to one individual submission.
11. Historical acceptance and credit must remain reconstructable after reopening.
12. Important history should be appended rather than overwritten whenever practical.

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
                         |       |
                         |       +----< SubmissionReview
                         |
                         +----< OutcomeAcceptance
                                 |
                                 +----< OutcomeAcceptanceMember
```

Project Membership is created automatically when a member joins their first outcome in a project.

Outcome Membership remains the source of project participation.

---

# 4. Authentication and Member Model

## 4.1 Supabase Auth

Supabase Auth remains responsible for authentication credentials and sessions.

Prometheus shall not store passwords.

The Supabase authenticated user ID is linked to the Prometheus `Member` record.

```text
Supabase auth.users.id
        |
        v
Member.auth_user_id
```

A Supabase account without a matching active Prometheus `Member` record does not receive workspace access.

---

# 5. Member

The `Member` entity represents an authorized or invited Prometheus user.

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
created_at
updated_at
```

## Fields

### `id`

Primary Prometheus member identifier.

Recommended type:

```text
UUID
```

### `auth_user_id`

Nullable Supabase Auth user identifier.

```text
UUID | NULL
```

It remains `NULL` while the member is invited but has not completed authentication.

It should be unique when populated.

### `email`

Authorized email address.

The value should be unique using normalized case-insensitive comparison.

### `full_name`

Member display name.

### `department_id`

Primary organizational department.

Foreign key:

```text
Member.department_id
-> Department.id
```

### `position`

Organizational position or job title.

### `workspace_role`

```text
ADMINISTRATOR
MEMBER
```

Project Lead must not appear in this field.

### `status`

```text
INVITED
ACTIVE
DEACTIVATED
```

### `profile_image_path`

Optional Supabase Storage reference.

---

# 6. Department

The `Department` entity represents an organizational department.

```text
Department
----------
id
name
description
created_at
updated_at
```

Examples include:

```text
Research and Development
Creatives
Sales and Marketing
```

Department association currently supports organization, filtering, reporting, and project context.

Department membership does not prevent an authorized user from joining an outcome.

More detailed department behavior remains subject to later product decisions.

---

# 7. Project

The `Project` entity represents a Prometheus software project.

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

Stores the member who originally created the project.

```text
Project.created_by_member_id
-> Member.id
```

This field exists for audit purposes.

The creator receives no special authority because of this relationship.

## `lead_member_id`

Stores the current Project Lead.

```text
Project.lead_member_id
-> Member.id
```

Project Lead authority comes from this relationship.

An Administrator receives no Project Lead authority unless their Member ID appears here.

## `assistant_lead_member_id`

Optional relationship for the Assistant Lead currently represented by the project interface.

```text
Member.id | NULL
```

Assistant Lead permissions have not yet been finalized.

Until explicit rules are defined, Assistant Lead should not automatically receive Project Lead authority.

## `status`

```text
PLANNING
IN_PROGRESS
DONE
ARCHIVED
```

`PLANNING`, `IN_PROGRESS`, and `DONE` are manually configurable states.

`ARCHIVED` is system-managed.

## `done_at`

Timestamp indicating when the project most recently entered `DONE`.

This field controls automatic archiving.

Example:

```text
Project changed to DONE
-> done_at = now()
```

If the project leaves `DONE` before automatic archival:

```text
done_at = NULL
```

If it later enters `DONE` again:

```text
done_at = new timestamp
```

## `archived_at`

Timestamp when the system transitions the project to `ARCHIVED`.

The transition rule is:

```text
status = DONE
AND
done_at <= current time - 14 days

-> ARCHIVED
```

The automatic archive timer must not be calculated from `updated_at`.

---

# 8. Project Status History

Project status changes should be preserved instead of relying only on the current Project record.

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

## `changed_by_member_id`

Nullable because automatic archival is performed by the system.

## `change_source`

```text
USER
SYSTEM
```

Example:

```text
IN_PROGRESS -> DONE
changed_by_member_id = Nico
change_source = USER
```

Automatic archive:

```text
DONE -> ARCHIVED
changed_by_member_id = NULL
change_source = SYSTEM
```

---

# 9. Project Department

Projects may be associated with multiple departments.

```text
ProjectDepartment
-----------------
project_id
department_id
created_at
```

Composite uniqueness:

```text
UNIQUE(project_id, department_id)
```

This relationship does not control project visibility.

All active authorized Prometheus users may still view all projects.

---

# 10. Project Member

A Project Member represents a member who participates in at least one outcome within the project.

Project Members are not manually added.

A Project Member row is created automatically when the user joins their first outcome in that project.

```text
ProjectMember
-------------
project_id
member_id
access_level
created_at
updated_at
```

Composite primary or unique key:

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

Only the Project Lead may change this field.

Administrator status alone does not permit modification of Project Member access.

## Creation Rule

When a user joins an outcome:

```text
Create OutcomeMember
        |
        v
Does ProjectMember exist?
        |
     +--+--+
     |     |
    Yes    No
     |     |
     |     v
     |   Create ProjectMember
     |   access_level = CAN_VIEW
     |
     v
Complete join
```

Because Outcome Membership cannot be removed, Project Membership also remains valid after it is created.

---

# 11. Project Member Access History

Changes between `CAN_VIEW` and `CAN_EDIT` should be auditable.

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

`changed_by_member_id` must be the Project Lead at the time the change occurs.

---

# 12. Stage

Stages organize project outcomes.

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

Foreign key:

```text
Stage.project_id
-> Project.id
```

`position` controls ordering inside the project workflow.

Only the Project Lead may create and manage stages under the current permission model.

---

# 13. Outcome

The `Outcome` entity represents a measurable result inside a Stage.

```text
Outcome
-------
id
stage_id
title
description
status
position
created_by_member_id
accepted_at
created_at
updated_at
```

## `status`

The Outcome status should represent the main lifecycle state only.

Recommended values:

```text
OPEN
NEEDS_REVISION
ACCEPTED
```

Two concepts should not be stored as conflicting Outcome statuses:

```text
LOCKED
FOR_REVIEW
```

Instead, those should be derived separately.

### Locked

Whether an outcome is locked should be derived from unresolved dependencies.

```text
is_locked =
exists unresolved prerequisite
```

### For Review

Whether an outcome has work awaiting review should be derived from its submissions.

```text
has_for_review =
exists OutcomeSubmission
where review_status = FOR_REVIEW
```

This allows an outcome to simultaneously be:

```text
OPEN
+
has submissions FOR_REVIEW
```

without forcing unrelated workflow concepts into one status field.

## `accepted_at`

Timestamp of the current most recent acceptance.

When reopened:

```text
Outcome.status = OPEN
Outcome.accepted_at = NULL
```

Historical acceptance remains preserved in `OutcomeAcceptance`.

---

# 14. Outcome Department

An outcome may be associated with one or more departments.

```text
OutcomeDepartment
-----------------
outcome_id
department_id
created_at
```

Composite uniqueness:

```text
UNIQUE(outcome_id, department_id)
```

Department association does not prevent members of other departments from joining the outcome.

---

# 15. Outcome Member

`OutcomeMember` is the primary participation relationship for project work.

```text
OutcomeMember
-------------
outcome_id
member_id
joined_at
```

Composite uniqueness:

```text
UNIQUE(outcome_id, member_id)
```

## Rules

Outcome Membership is permanent.

There is no:

```text
left_at
removed_at
removed_by
```

because users cannot leave an outcome and Project Leads cannot remove them.

Any active authorized Prometheus user may join an outcome when joining is allowed by the current lifecycle.

Users may join while an outcome is:

```text
OPEN
NEEDS_REVISION
FOR_REVIEW
LOCKED
```

`FOR_REVIEW` and `LOCKED` are derived conditions rather than the main Outcome status.

Users may not newly join while the outcome is currently:

```text
ACCEPTED
```

If the Project Lead reopens the outcome, joining becomes available again.

---

# 16. Outcome Dependency

An outcome may require another outcome to be resolved first.

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

## Meaning

```text
outcome_id
```

is the outcome being blocked.

```text
prerequisite_outcome_id
```

is the prerequisite.

Constraint:

```text
outcome_id != prerequisite_outcome_id
```

Recommended uniqueness:

```text
UNIQUE(outcome_id, prerequisite_outcome_id)
```

Dependencies should normally reference outcomes belonging to the same Project.

## Derived Lock

An Outcome is locked when at least one dependency is unresolved.

Conceptually:

```text
dependency resolved if:

prerequisite is ACCEPTED

OR

override_resolved_at is not NULL
```

The exact behavior when an accepted prerequisite is later reopened remains a product decision to finalize.

---

# 17. Acceptance Criterion

Acceptance Criteria define the conditions a Project Lead considers when determining whether an outcome is complete.

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

Foreign key:

```text
AcceptanceCriterion.outcome_id
-> Outcome.id
```

Only the Project Lead should manage criteria under the current permission model.

If criterion-level historical verification becomes necessary, it can later be added through acceptance snapshots rather than overwriting historical evidence.

---

# 18. Feature

Features organize work inside an Outcome.

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

Foreign key:

```text
Feature.outcome_id
-> Outcome.id
```

Outcome Members may create and edit features when workflow rules permit work on the Outcome.

---

# 19. Task

Tasks represent actionable work under a Feature.

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

Recommended initial values:

```text
TODO
DONE
```

Task assignment to specific individuals is not currently required by the finalized Outcome Membership model.

Outcome Members collaborate on the shared Outcome workspace.

---

# 20. Outcome Submission

Each Outcome has one shared submission history.

Every submitted entry becomes a separate `OutcomeSubmission` record.

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

Foreign keys:

```text
outcome_id
-> Outcome.id

submitted_by_member_id
-> Member.id
```

## `review_status`

Recommended values:

```text
FOR_REVIEW
REVIEWED
```

Acceptance should not be stored as:

```text
Submission = ACCEPTED
```

because acceptance applies to the entire Outcome rather than one individual submission.

## Submission Rules

Only Outcome Members may submit.

Multiple submissions may exist simultaneously with:

```text
review_status = FOR_REVIEW
```

Example:

```text
Outcome A

Submission 1
Member A
FOR_REVIEW

Submission 2
Member B
FOR_REVIEW

Submission 3
Member C
FOR_REVIEW
```

A new submission does not invalidate or replace older submissions.

Submission records should be append-only whenever practical.

---

# 21. Submission Attachment

Files associated with a submission should be stored in Supabase Storage rather than inside PostgreSQL.

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

Foreign key:

```text
submission_id
-> OutcomeSubmission.id
```

The data model can later be extended to support external URLs or other artifact types if needed.

---

# 22. Submission Review

The Project Lead may review individual submissions without accepting the entire Outcome immediately.

```text
SubmissionReview
----------------
id
submission_id
reviewed_by_member_id
review_note
created_at
```

Foreign keys:

```text
submission_id
-> OutcomeSubmission.id

reviewed_by_member_id
-> Member.id
```

After review, the corresponding submission may be marked:

```text
REVIEWED
```

Several reviewed and unreviewed submissions may coexist in the same shared history.

Only the Project Lead may create submission reviews.

---

# 23. Outcome Revision Request

A revision request applies to the Outcome workflow.

```text
OutcomeRevisionRequest
----------------------
id
outcome_id
requested_by_member_id
message
created_at
resolved_at
```

Foreign keys:

```text
outcome_id
-> Outcome.id

requested_by_member_id
-> Member.id
```

Creating an unresolved revision request sets:

```text
Outcome.status = NEEDS_REVISION
```

Outcome Members may continue working and submitting additional entries.

Other authorized users may still join the Outcome while it is in this state.

---

# 24. Outcome Acceptance

Every acceptance should create a separate historical record.

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

Foreign keys:

```text
outcome_id
-> Outcome.id

accepted_by_member_id
-> Member.id

reopened_by_member_id
-> Member.id
```

## Acceptance

When the Project Lead accepts an Outcome:

```text
Create OutcomeAcceptance
Outcome.status = ACCEPTED
Outcome.accepted_at = now()
```

New Outcome Members and submissions stop while accepted.

## Reopen

When the Project Lead reopens the Outcome:

```text
OutcomeAcceptance.reopened_at = now()
OutcomeAcceptance.reopened_by_member_id = Project Lead
Outcome.status = OPEN
Outcome.accepted_at = NULL
```

Existing Outcome Memberships remain unchanged.

Previous submissions remain unchanged.

Previous acceptance history remains unchanged.

When the Outcome is accepted again, a new `OutcomeAcceptance` row is created.

Example:

```text
Acceptance #1
accepted Sep 1
reopened Sep 5

Acceptance #2
accepted Sep 10
```

---

# 25. Outcome Acceptance Member

The members receiving credit for an accepted Outcome should be snapshotted for each acceptance.

```text
OutcomeAcceptanceMember
-----------------------
acceptance_id
member_id
```

Composite uniqueness:

```text
UNIQUE(acceptance_id, member_id)
```

When an Outcome is accepted, one record is created for every current Outcome Member.

Example:

```text
Acceptance #1

Member A
Member B
```

The Outcome is reopened.

Member C joins.

The Outcome is accepted again.

```text
Acceptance #2

Member A
Member B
Member C
```

This prevents later membership changes from rewriting historical credit.

It also satisfies the rule that everyone belonging to the Outcome at acceptance receives credit regardless of individual contribution amount.

---

# 26. Project Participation Derivation

There is no manually assigned Project Participant relationship.

A member participates in a Project when at least one `OutcomeMember` relationship exists for an Outcome belonging to that Project.

Conceptually:

```sql
Member participates in Project
IF EXISTS (
    OutcomeMember
    -> Outcome
    -> Stage
    -> Project
)
```

The `ProjectMember` record provides the persistent project-level `CAN_VIEW` or `CAN_EDIT` access level.

It should be created automatically during the same transaction that creates the first Outcome Membership for that Project.

---

# 27. My Projects Derivation

The **Leading** view is derived from:

```text
Project.lead_member_id = current member
```

The **Participating** view is derived from:

```text
ProjectMember.member_id = current member
AND
Project.lead_member_id != current member
```

A Project Lead may also be an Outcome Member within the same Project.

The interface may choose to show that Project only under **Leading** to prevent duplication.

---

# 28. Project Permission Evaluation

Project permissions should be computed from separate relationships.

```text
Organization role
        +
Project Lead relationship
        +
Project Member access level
        +
Outcome Membership
        =
Effective permissions
```

Example:

```text
Member:
workspace_role = ADMINISTRATOR

Project A:
lead_member_id = member.id

Project B:
ProjectMember.access_level = CAN_VIEW

Project C:
ProjectMember.access_level = CAN_EDIT

Outcome B1:
OutcomeMember exists
```

The effective permissions are:

```text
Registry
-> allowed because ADMINISTRATOR

Project A management
-> allowed because PROJECT LEAD

Project B project editing
-> denied because CAN_VIEW

Project C allowed project edits
-> allowed because CAN_EDIT

Outcome B1 work
-> allowed because OutcomeMember exists
```

Administrator status does not automatically override Project B or Project C permissions.

---

# 29. Notification

The initial generic notification model may be:

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

The final event matrix remains subject to later product decisions.

---

# 30. Project Message

Project communication may use:

```text
ProjectMessage
--------------
id
project_id
member_id
parent_message_id
body
created_at
edited_at
```

`parent_message_id` is nullable and may support replies.

Exact communication visibility and write permissions may be refined later.

---

# 31. Activity Log

The Activity Log should be append-only.

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

## `actor_member_id`

Nullable for system-generated events.

Examples of events worth recording include:

```text
PROJECT_CREATED
PROJECT_LEAD_CHANGED
PROJECT_MEMBER_ACCESS_CHANGED
PROJECT_STATUS_CHANGED
PROJECT_ARCHIVED
OUTCOME_CREATED
OUTCOME_JOINED
SUBMISSION_CREATED
SUBMISSION_REVIEWED
REVISION_REQUESTED
OUTCOME_ACCEPTED
OUTCOME_REOPENED
DEPENDENCY_OVERRIDDEN
MEMBER_INVITED
MEMBER_DEACTIVATED
```

`metadata` may use `JSONB` for event-specific context.

The Activity Log should not replace proper relational history tables such as `ProjectStatusHistory` or `OutcomeAcceptance`.

It complements them.

---

# 32. Schedule

Schedule details remain partially subject to later product decisions.

The baseline model may include:

```text
MemberSchedule
--------------
id
member_id
target_weekly_minutes
created_at
updated_at
```

One active schedule should normally exist per member.

---

# 33. Schedule Block

Recurring weekly work periods may use:

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

Example:

```text
Monday
09:00
15:00
```

---

# 34. Schedule Override

Date-specific schedule changes may use:

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

Exact override rules remain subject to later schedule decisions.

---

# 35. Work Session

Actual Time In and Time Out records may use:

```text
WorkSession
-----------
id
member_id
time_in
time_out
created_at
updated_at
```

`time_out` is nullable while the member is currently working.

Detailed correction, forgotten Time Out, cross-midnight, and administrative adjustment rules remain deferred until those product decisions are finalized.

---

# 36. Recommended Enums

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

## OutcomeStatus

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

## StatusChangeSource

```text
USER
SYSTEM
```

---

# 37. Derived Values

The following values should generally be calculated rather than stored independently.

## Project Participation

```text
ProjectMember exists
```

which originates from Outcome Membership.

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

## Project Auto Archive Eligibility

```text
Project.status = DONE
AND
Project.done_at <= now() - 14 days
```

## Outcome Member Count

```text
COUNT(OutcomeMember)
```

## Project Member Count

```text
COUNT(ProjectMember)
```

---

# 38. Important Database Constraints

The database should enforce important structural invariants where possible.

```text
Member.email
UNIQUE
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

The backend must still enforce business rules that cannot reasonably be represented by simple relational constraints.

---

# 39. Transaction Boundaries

Certain operations should be executed atomically.

## Join Outcome

The following should occur in one transaction:

```text
Validate member ACTIVE
Validate outcome joinability
Create OutcomeMember
Create ProjectMember if missing
Create ActivityLog
```

## Accept Outcome

The following should occur in one transaction:

```text
Validate current user is Project Lead
Create OutcomeAcceptance
Snapshot all OutcomeMembers into OutcomeAcceptanceMember
Set Outcome.status = ACCEPTED
Set Outcome.accepted_at
Create ActivityLog
```

## Reopen Outcome

The following should occur in one transaction:

```text
Validate current user is Project Lead
Update latest OutcomeAcceptance.reopened_at
Update latest OutcomeAcceptance.reopened_by_member_id
Set Outcome.status = OPEN
Clear Outcome.accepted_at
Create ActivityLog
```

## Change Project Status

The following should occur in one transaction:

```text
Validate Project Lead OR ProjectMember CAN_EDIT

Update Project.status

If entering DONE:
    Project.done_at = now()

If leaving DONE:
    Project.done_at = NULL

Create ProjectStatusHistory
Create ActivityLog
```

---

# 40. Indexing Recommendations

Indexes should exist for frequent relationship and feed queries.

Recommended examples:

```text
Member(email)
Member(auth_user_id)

Project(lead_member_id)
Project(status)
Project(done_at)

ProjectMember(member_id)
ProjectMember(project_id)

Stage(project_id)

Outcome(stage_id)
Outcome(status)

OutcomeMember(member_id)
OutcomeMember(outcome_id)

OutcomeSubmission(outcome_id, created_at)
OutcomeSubmission(review_status)

OutcomeAcceptance(outcome_id, accepted_at)

Notification(member_id, read_at, created_at)

ActivityLog(project_id, created_at)
ActivityLog(outcome_id, created_at)

WorkSession(member_id, time_in)
```

Exact indexes should be validated against actual query patterns once implementation begins.

---

# 41. Records That Should Not Be Hard Deleted

Historical project records should generally be preserved.

The following records should normally not be hard deleted after meaningful activity exists:

```text
Member
Project
ProjectMember
Outcome
OutcomeMember
OutcomeSubmission
SubmissionReview
OutcomeAcceptance
OutcomeAcceptanceMember
ProjectStatusHistory
ActivityLog
WorkSession
```

Where removal from the active product is required, status fields, archival, or deactivation should generally be preferred.

Exact deletion policy will be finalized later.

---

# 42. Tables Not Required

The current model does not require a separate:

```text
ProjectLead
```

table because each Project stores its current Lead directly.

It also does not require a manually assigned:

```text
ProjectParticipant
```

table because Project participation is derived from Outcome Membership.

The old:

```text
OutcomeAssignment
```

model is also no longer required.

Users join Outcomes through:

```text
OutcomeMember
```

---

# 43. Current Core Schema

The main implementation path is therefore:

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
```

---

# 44. Canonical Participation Model

The final participation model is:

```text
ACTIVE PROMETHEUS MEMBER
        |
        v
Can view every project
        |
        v
Can view every outcome
        |
        v
Joins an outcome
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

Outcome Membership determines where a member may work.

Project Member access determines additional project-level editing capability.

Project Lead determines project-management authority.

Administrator determines organization-level administrative authority.

These concepts must remain independent in the database.

---

# 45. Decisions Intentionally Deferred

The current schema supports the rules already finalized without forcing unresolved product decisions.

The following areas should be revisited after the remaining planning questions are answered:

- Final department responsibility semantics.
- Project Lead replacement when a member is deactivated.
- Full notification event matrix.
- Exact project and outcome progress formulas.
- Reporting and team-capacity formulas.
- Work-session correction rules.
- Forgotten Time Out behavior.
- Cross-midnight work sessions.
- Detailed audit-retention policy.
- Final project-chat write permissions.
- Assistant Lead permissions.
- Reopening or restoring archived projects.
- Behavior of dependent outcomes when an accepted prerequisite is reopened.

These should be resolved before the affected database constraints or API contracts are considered final.

---

# 46. Data Model Principle

The central rule of the Prometheus data model is:

```text
Organization authority
!=
Project authority
!=
Project edit access
!=
Outcome participation
```

A user's capabilities are determined by combining these independent relationships.

```text
Member.workspace_role
        +
Project.lead_member_id
        +
ProjectMember.access_level
        +
OutcomeMember membership
        =
Effective authorization
```

This separation should remain intact throughout PostgreSQL, Prisma, NestJS, and the React frontend.