# Software Requirements Specification

## Prometheus Centralized Workflow Management System

**Version:** 1.0 - Current Release  
**Release Status:** Current release scope complete as of 2026-09-25  
**Organization:** Prometheus Software Company  
**Document Type:** Software Requirements Specification

---

# 1. Introduction

## 1.1 Purpose

This Software Requirements Specification defines the functional and non-functional requirements for the Prometheus Centralized Workflow Management System.

Prometheus is an internal web-based platform for project delivery, project collaboration, scheduling, work tracking, output review, notifications, reporting, and administrative management.

The canonical `user-flows.md` document defines the expected user interaction and access-control behavior of the system.

`finalmodel.html` is an interaction prototype and shall not be treated as the production authorization specification.

## 1.2 Core Model

Prometheus separates four concepts:

- Organization role.
- Project Lead authority.
- Project Member access level.
- Outcome Membership.

These concepts may exist simultaneously for the same user and shall not be conflated.

---

# 2. User Classes and Relationships

## 2.1 Administrator

An Administrator manages organization-level information and workspace access.

Administrators may:

- Access Registry.
- Add and edit members.
- Manage departments.
- Assign organization roles.
- Activate or deactivate workspace access.
- View authentication status.

Administrator authority does not automatically grant project-level authority.

An Administrator may perform Project Lead actions only when explicitly assigned as the Project Lead of that project.

## 2.2 Member

A Member is an active authorized Prometheus user.

Members may:

- View all projects and outcomes.
- Create projects.
- Assign themselves or another active authorized user as Project Lead during project creation.
- Join outcomes according to outcome-state rules.
- Become Outcome Members.
- Become Project Members through Outcome Membership.
- Work on joined outcomes.
- Submit outputs for joined outcomes.
- Receive accepted-outcome credit.
- Manage their own schedule and work sessions.

## 2.3 Project Lead

Project Lead is a project-specific responsibility.

A Member or Administrator may be a Project Lead.

The Project Lead controls the project they lead and may:

- View Project Members.
- Grant or revoke `CAN_EDIT` for Project Members.
- Change project status.
- Create and manage stages.
- Create and manage outcomes.
- Define acceptance criteria.
- Configure dependencies.
- Review shared outcome submission histories.
- Request revisions.
- Accept outcomes.
- Reopen accepted outcomes.
- Resolve dependencies.
- View project-wide management activity.

Project Lead authority applies only to projects where the user is assigned as lead.

## 2.4 Project Creator

Project creator is an audit relationship only.

Creating a project shall not grant permanent or special project authority.

If the creator is also the Project Lead, the creator receives Project Lead authority because of that assignment rather than because they created the project.

## 2.5 Project Member

A user becomes a Project Member when the user is an Outcome Member of at least one outcome in that project.

Project Membership is derived from Outcome Membership.

Each Project Member has one project access level:

```text
CAN_VIEW
CAN_EDIT
```

`CAN_VIEW` is the default.

Only the Project Lead may grant or revoke `CAN_EDIT` for Project Members.

Administrator status does not grant the ability to manage project-member access unless that Administrator is also the Project Lead.

`CAN_EDIT` does not make a user the Project Lead.

## 2.6 Outcome Member

Any active authorized Prometheus user may become an Outcome Member by joining an outcome according to its state rules.

Outcome Membership is permanent once created.

Outcome Members cannot leave an outcome.

Project Leads cannot remove Outcome Members.

Outcome Membership does not grant Administrator or Project Lead authority.

---

# 3. Authentication and Workspace Authorization

## FR-01 Authentication

The system shall support secure authentication through configured authentication providers.

Initial authentication methods shall include:

- Email and password.
- Continue with Google.

A successful authentication shall not automatically grant Prometheus workspace access.

## FR-02 Workspace Authorization

An authenticated identity must match an active authorized Prometheus member record.

If no authorized active member record matches the authenticated identity, workspace access shall be denied.

Authentication and Prometheus authorization shall be separate checks.

## FR-03 Member Invitation

Only an Administrator may authorize a new Prometheus member.

When an Administrator adds a member:

- A Prometheus member record shall be created.
- The initial account status may be `INVITED`.
- An invitation or account setup email shall be sent through the configured transactional email service.
- After successful authentication, the authentication identity shall be linked to the authorized member record.

## FR-03A Password Recovery

The system shall provide password recovery for configured email/password authentication.

The recovery request shall use a generic response that does not disclose whether an account exists.

A valid Supabase recovery session shall allow the user to choose a new password and then return to normal sign-in.

Password recovery shall not bypass Prometheus workspace authorization.

Recovery redirect URLs must be configured for the deployed and supported local application origins.

---

# 4. Registry

## FR-04 Registry Access

Registry shall be visible and accessible only to Administrators.

Non-Administrators shall not see the Registry navigation item.

Direct Registry route access and Registry API calls shall also enforce Administrator authorization.

Project Lead status does not grant Registry access.

---

# 5. Project Visibility and Creation

## FR-05 Project Visibility

All active authorized Prometheus users shall be able to view all projects.

All active authorized Prometheus users shall be able to view project stages, outcomes, Outcome Members, project status, Project Lead, progress, and other company-visible project information.

Viewing a project shall not automatically create Project Membership or edit authority.

## FR-06 Project Creation

Any active authorized Prometheus user may create a project.

The creator shall be able to assign themselves or another active authorized user as Project Lead.

The system shall store at least:

- Project creator.
- Project Lead.
- Project name.
- Description.
- Participating or associated departments.
- Project status.

The project creator and Project Lead shall be stored separately.

Creating a project shall not grant the creator special authority after creation.

---

# 6. Project Member Access

## FR-07 Project Membership

A user shall become a Project Member when the user is an Outcome Member of at least one outcome in the project.

The system shall derive project participation from Outcome Membership rather than requiring manual project-participant assignment.

## FR-08 Project Member Access Level

Every Project Member shall default to:

```text
CAN_VIEW
```

The Project Lead may change a Project Member to:

```text
CAN_EDIT
```

The Project Lead may also return a Project Member from `CAN_EDIT` to `CAN_VIEW`.

Only the Project Lead may manage this project-level access.

Administrator status shall not provide an override.

## FR-09 Project Member Edit Capability

A Project Member with `CAN_EDIT` shall be permitted to use project-level edit capabilities explicitly granted to editable Project Members.

`CAN_EDIT` shall grant Project editor capabilities including:

- Changing Project status.
- Creating, editing, and deleting Stages subject to normal deletion safeguards.
- Creating, editing, and deleting Outcomes subject to normal deletion safeguards.
- Reviewing submissions and saving review preparation.
- Requesting or resolving revision state.
- Accepting and reopening Outcomes.
- Overriding individual dependencies where the product permits it.

Managing Project Member access shall remain Project Lead-only.

`CAN_EDIT` shall not make a Project Member the Project Lead.

---

# 7. Project Status Lifecycle

## FR-10 Manual Project Status

Project status shall be configured from inside the project.

The manually selectable project states shall be:

```text
PLANNING
IN_PROGRESS
DONE
```

The Project Lead may change project status.

A Project Member with `CAN_EDIT` may also change project status.

A `CAN_VIEW` Project Member may view but not change project status.

## FR-11 Done State

A project may be manually set to `DONE` without requiring every project outcome to be accepted.

Project completion status is therefore a project-level decision and is not calculated solely from outcome acceptance.

## FR-12 Automatic Archival

A project that remains in `DONE` status for 14 days shall automatically transition to:

```text
ARCHIVED
```

`ARCHIVED` shall be a system-managed status rather than a normal manually selectable state.

The system shall retain the date and time when the project entered `DONE` so the archive transition can be evaluated consistently.

---

# 8. Project Stages and Outcomes

## FR-13 Stage Management

The Project Lead or a Project Member with `CAN_EDIT` shall be able to create and manage stages within that Project.

## FR-14 Outcome Management

The Project Lead or a Project Member with `CAN_EDIT` shall be able to create and manage project outcomes.

An outcome may contain:

- Title.
- Description.
- Associated departments.
- Acceptance criteria.
- Features.
- Tasks.
- Prerequisites.
- Outcome Members.
- Shared submission history.
- Review state.
- Feedback.

All authorized users may view outcomes.

---

# 9. Outcome Membership Lifecycle

## FR-15 Joining Outcomes

Any active authorized Prometheus user may join an outcome while it is not accepted.

Joining shall not require Project Lead approval.

A user may join an outcome while it is:

- Open for normal work.
- Locked by a dependency.
- `FOR_REVIEW`.
- `NEEDS_REVISION`.

Joining an outcome shall create permanent Outcome Membership.

## FR-16 Permanent Outcome Membership

Once a user joins an outcome:

- The user shall not be able to leave the outcome.
- The Project Lead shall not be able to remove the user from the outcome.
- The Outcome Membership shall remain historically preserved.

## FR-17 Locked Outcomes

A locked outcome shall remain visible.

Authorized users may join a locked outcome.

The lock may prevent work or submission actions until its dependency is resolved.

## FR-18 Accepted Outcomes

While an outcome is accepted:

- New users shall not be able to join it.
- New submissions shall not be accepted.
- Existing Outcome Membership shall remain preserved.

## FR-19 Reopening Accepted Outcomes

The Project Lead may reopen an accepted outcome.

Reopening shall:

- Preserve all existing Outcome Members.
- Preserve previous submissions.
- Preserve previous acceptance history.
- Allow additional authorized users to join again.
- Allow Outcome Members to resume work and submit new entries.

---

# 10. Feature and Task Work

## FR-20 Outcome Work

Outcome Members shall be able to perform permitted work within outcomes they joined.

Outcome Members may:

- Create features.
- Create tasks.
- Edit permitted features and tasks.
- Mark tasks complete.
- Prepare outputs.
- View feedback.
- View shared submission history.
- View other Outcome Members.

Users who have not joined an outcome may view it but may not perform Outcome Member work actions.

---

# 11. Shared Submission History

## FR-21 Shared Submission History

Each outcome shall have one shared submission history.

The submission history belongs to the outcome rather than to an individual user.

Each submission shall preserve at least:

- Outcome identifier.
- Submitter.
- Submission timestamp.
- Submission content or attachment references.
- Notes.
- Review information.

## FR-22 Concurrent Review Submissions

Any Outcome Member may add a new submission while the outcome has not been accepted and submission is not blocked by another workflow rule.

A new submission may be added even when one or more previous submissions are already `FOR_REVIEW`.

The system shall not require an earlier submission to be resolved before accepting another submission.

Multiple submissions may therefore be under review simultaneously for the same outcome.

---

# 12. Review and Acceptance

## FR-23 Submission Review

The Project Lead or a Project Member with `CAN_EDIT` shall have authority to perform Project review actions.

Project editors shall be able to inspect multiple submissions in the outcome's shared submission history.

Administrator status alone shall not grant review authority.

## FR-24 Revision Requests

The Project Lead or a Project Member with `CAN_EDIT` may request revision of outcome work.

While an outcome is in `NEEDS_REVISION`:

- Existing Outcome Members remain members.
- New authorized users may still join.
- Outcome Members may continue work.
- New submissions may be added.

## FR-25 Outcome Acceptance

Outcome acceptance shall be an outcome-level decision rather than an acceptance of only one user's submission.

The Project Lead or a Project Member with `CAN_EDIT` may determine that one or more submissions collectively satisfy the outcome and accept the outcome.

When an outcome is accepted:

- New submissions shall stop while it remains accepted.
- New users shall not join while it remains accepted.
- The current Outcome Member set shall be preserved.
- All current Outcome Members shall receive accepted-outcome credit.

No minimum contribution threshold shall be required for accepted-outcome credit.

---

# 13. Dependencies

## FR-26 Outcome Dependencies

An outcome may depend on another outcome.

A dependent outcome may be locked until its prerequisite is resolved.

The Project Lead or a Project Member with `CAN_EDIT` may resolve or skip an individual prerequisite where the product permits it.

Outcome Membership may still be created while an outcome is locked.

---

# 14. My Projects

## FR-27 My Projects Classification

The My Projects view shall distinguish:

```text
Leading
Participating
```

A project shall appear under `Leading` when the current user is its Project Lead.

A project shall appear under `Participating` when the current user is an Outcome Member of at least one outcome in the project and is not grouped under `Leading` for that project.

---

# 15. Team, Schedule, and Work Sessions

## FR-28 Team

The system shall provide a Team module containing member information including name, department, position, availability, current work status, scheduled hours, and actual worked hours where available.

## FR-29 Schedule

Members shall primarily manage their own planned work schedules.

Shared schedules may provide visibility into other members' availability without granting unauthorized modification.

## FR-30 Work Sessions

The system shall support:

- Time In.
- Time Out.
- Recorded work sessions.
- Weekly work history.
- Scheduled versus actual hours.

Members shall record their own work sessions unless a future explicit rule provides otherwise.

---

# 16. Notifications

## FR-31 Notifications

The system shall provide a centralized notification inbox.

Potential notification events include:

- Project Lead assignment.
- Project Member access changed.
- Project status changed.
- User joined an outcome.
- Submission added.
- Revision requested.
- Outcome accepted.
- Outcome reopened.
- Dependency unlocked.
- User mentioned.
- Project-related reply.

Users shall be able to distinguish read and unread notifications and mark notifications as read.

---

# 17. Communication and Activity

## FR-32 Project Communication

The system shall provide Project and VisiWork communication functionality according to the visibility and participation rules defined in `user-flows.md` and the centralized matrix in `.context/authorization.md`.

General Project Chat shall be company-readable and writable only by the Project Lead or Project Members.

VisiWork General Chat shall be available to active authorized Members.

VisiWork Department Chat shall be company-readable, while writes require the Member's home Department or current VisiWork focus to match that room.

Message search, exact-message deep links, mentions, author edit/delete behavior, soft deletion, and mention-notification lifecycle shall preserve room scope and backend authorization.

Automatic polling or another live transport may provide near-live updates, but persisted PostgreSQL records shall remain authoritative.

## FR-33 Activity History

The system shall maintain project activity history for important events including:

- Project creation.
- Project Lead assignment.
- Project Member access changes.
- Project status changes.
- Automatic archival.
- Outcome creation.
- User joining an outcome.
- Feature and task updates.
- Submission creation.
- Revision requests.
- Outcome acceptance.
- Outcome reopening.
- Dependency resolution.
- Administrative changes.

Each activity record should identify the responsible actor where applicable, the action, related object, and timestamp.

---

# 18. Business Rules

## BR-01 Organization Roles

Organization roles shall be `ADMINISTRATOR` and `MEMBER`.

Project Lead shall not be implemented as an organization-wide role.

## BR-02 Project Creator

Project creator is an audit relationship only and grants no special authority.

## BR-03 Project Lead Authority

Project Lead authority applies only within projects the user leads.

Administrator status does not automatically grant Project Lead authority.

## BR-04 Project Membership

Project Membership shall be derived from Outcome Membership.

## BR-05 Project Member Access

Project Members default to `CAN_VIEW`.

Only the Project Lead may grant or revoke `CAN_EDIT`.

## BR-06 Project Status

Project Lead and Project Members with `CAN_EDIT` may change the project's manual status among `PLANNING`, `IN_PROGRESS`, and `DONE`.

A project does not require all outcomes to be accepted before entering `DONE`.

A project remaining `DONE` for 14 days automatically becomes `ARCHIVED`.

## BR-07 Outcome Membership

Outcome Membership is permanent once created.

Outcome Members cannot leave and Project Leads cannot remove them.

## BR-08 Outcome Joining

Any active authorized user may join an outcome while it is not accepted, including while it is locked, `FOR_REVIEW`, or `NEEDS_REVISION`.

## BR-09 Shared Submission History

Each outcome shall have one shared submission history and may contain multiple simultaneous submissions under review.

## BR-10 Outcome Acceptance

The Project Lead or a Project Member with `CAN_EDIT` may accept or reopen an outcome.

All Outcome Members receive credit when the outcome is accepted.

## BR-11 Reopening

Reopening shall preserve Outcome Membership, submission history, and prior acceptance history.

## BR-12 Registry

Only Administrators may access Registry.

Backend authorization shall enforce this rule.

## BR-13 Authentication Separation

Authentication establishes identity but does not itself grant Prometheus access.

An authenticated identity must match an active authorized member record.

---

# 19. Data Requirements

The system shall maintain persistent records for at least:

- Authentication-linked user accounts.
- Member profiles.
- Workspace authorization status.
- Organization roles.
- Departments.
- Projects.
- Project creators.
- Project Leads.
- Project Member access levels.
- Project status history.
- Project completion timestamps required for automatic archival.
- Project stages.
- Outcomes.
- Outcome states.
- Outcome Memberships.
- Acceptance criteria.
- Features.
- Tasks.
- Shared outcome submissions.
- Submission review information.
- Outcome acceptance history.
- Accepted-outcome credit.
- Outcome reopening history.
- Project messages.
- Work schedules.
- Work sessions.
- Notifications.
- Activity records.

Project participation does not require a separate manually assigned participant record when it can be derived from Outcome Membership.

---

# 20. Non-Functional Requirements

## NFR-01 Security

Important authorization decisions shall be enforced by the backend.

Frontend visibility controls shall not be treated as sufficient security.

## NFR-02 Data Integrity

The system shall preserve relationships among users, projects, Project Leads, Project Members, Outcome Members, submissions, acceptances, and credit records.

Reopening an outcome shall not destroy prior historical data.

## NFR-03 Auditability

Important project, outcome, submission, review, status, access, and administrative actions should be traceable.

## NFR-04 Maintainability

Organization-role logic, Project Lead authority, Project Member access, and Outcome Membership shall remain separate in the implementation.

## NFR-05 Reliability

Critical workflow transitions shall avoid accidental loss of project, submission, membership, or acceptance history.

## NFR-06 Scalability

The architecture should support growth in users, projects, Project Members, Outcome Members, submissions, work records, notifications, and activity history.

---

# 21. Deferred Product Decisions

The following areas remain intentionally open until a future product decision explicitly expands the current release:

- Assistant Lead permissions.
- Whether an archived Project can be restored and who may restore it.
- Exact long-term data-retention and compliance deletion policy.
- Whether automatic live refresh should later be replaced or supplemented by Supabase Realtime push delivery.
- Binary chat attachments and their storage lifecycle.
- A dedicated Outcome-specific discussion user interface.
- The exact stale WorkSession threshold if the documented operational default is changed.

The following topics are no longer deferred:

- Department semantics and deletion/reference behavior.
- Member deactivation and Project Lead reassignment behavior.
- Core notification persistence and collaboration mention behavior.
- Detailed Home, Project, Reports, and VisiWork metric formulas.

Those resolved rules are canonical in `user-flows.md`, `data-model.md`, `authorization.md`, and `derived-metrics.md`.

Prototype behavior must not override those canonical decisions.
