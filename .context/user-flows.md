# Prometheus User Flows

## 1. Purpose

This document defines the canonical user flows and access-control behavior for the Prometheus Centralized Workflow Management System.

It describes authentication, organization roles, project leadership, project-member access, project status, outcome participation, submission history, Registry access, project creation, and project work.

The Software Requirements Specification remains the source of truth for functional requirements.

The tech stack document remains the source of truth for implementation architecture.

`finalmodel.html` is an interaction prototype and must not be treated as the production authorization mechanism.

---

# 2. Authorization Model

Prometheus separates organization-level authorization, project-level authority, project-member edit access, and outcome-level participation.

## 2.1 Organization Roles

Every authorized Prometheus user has one organization role:

```text
ADMINISTRATOR
MEMBER
```

Administrators manage organization-level information, membership, and workspace access.

Members are regular authorized Prometheus users.

Organization role does not determine who may participate in project outcomes.

## 2.2 Project Lead

Each project has one Project Lead.

Project Lead is not an organization role.

A Member may be the Project Lead of a project.

An Administrator may also be the Project Lead of a project when explicitly assigned.

Project Lead authority exists only for projects where the user is the assigned Project Lead.

Being an Administrator does not automatically grant Project Lead authority.

## 2.3 Project Creator

The project creator is stored for audit purposes only.

Creating a project does not give the creator permanent or special project authority.

After creation, the creator's permissions are determined by the same rules as every other user.

If the creator is the Project Lead, the creator receives Project Lead authority because of the lead assignment, not because they created the project.

If the creator later becomes an Outcome Member or receives `CAN_EDIT`, those permissions come from those relationships rather than project creation.

## 2.4 Project Member

A user becomes a Project Member when the user is an Outcome Member of at least one outcome in that project.

Project Membership is therefore derived from Outcome Membership rather than manually assigned.

Every Project Member has a project access level:

```text
CAN_VIEW
CAN_EDIT
```

`CAN_VIEW` is the default project access level.

The Project Lead may change a Project Member from `CAN_VIEW` to `CAN_EDIT` or from `CAN_EDIT` back to `CAN_VIEW`.

Only the Project Lead may manage project-member edit access.

Administrator status alone does not grant access to project-member permission management.

An Administrator may manage project-member access only when that Administrator is also the Project Lead of that project.

`CAN_EDIT` does not make a user the Project Lead.

Project Lead-only actions remain separate from Project Member edit access.

## 2.5 Outcome Membership

Any active authorized Prometheus user may join an outcome according to the outcome-state rules in this document.

After joining, the user becomes an **Outcome Member** of that outcome.

Outcome Membership is specific to each outcome.

A user may be an Outcome Member of multiple outcomes across multiple projects.

Outcome Membership is permanent once created.

An Outcome Member cannot leave an outcome.

The Project Lead cannot remove an Outcome Member from an outcome.

When an outcome is accepted, all Outcome Members of that outcome are considered part of the accepted outcome and receive credit for it.

No minimum contribution threshold is required for Outcome Member credit.

---

# 3. Member Invitation and Account Setup

Only an Administrator may authorize a new Prometheus member.

```text
Administrator opens Registry
        |
        v
Administrator adds member
        |
        v
Member record is created
status = INVITED
        |
        v
Invitation and account setup email is sent
        |
        v
User opens Prometheus account setup
        |
        v
Inspect invited email domain
        |
        +--------------------------+
        |                          |
        v                          v
     @gmail.com              Any other domain
        |                          |
        v                          v
Continue with Google       Email/password setup
        |                          |
        +------------+-------------+
                     |
                     v
                Supabase Auth
                     |
                     v
Prometheus checks authenticated identity
against authorized member record
                     |
              +------+------+
              |             |
             Match        No match
              |             |
              v             v
       Account linked     Access denied
       status = ACTIVE
```

For invitation account setup, an invited address whose domain is exactly `gmail.com` shall use the Google setup path.

The Gmail setup screen shall offer Google authentication and shall not offer password creation.

An invited address with any other domain shall use the email/password setup path.

The non-Gmail setup screen shall offer password creation and shall not offer Google authentication.

Under this initial policy, Google Workspace addresses on custom domains follow the non-Gmail password setup path.

The domain rule controls the account-setup experience only and is not a workspace authorization boundary.

After authentication, Prometheus must still use the authenticated provider identity and normalized email to resolve the Administrator-authorized Member record.

The Administrator-created member record determines whether the person is authorized to access Prometheus.

Receiving valid authentication does not automatically grant Prometheus access.

---

# 4. Sign-In Flow

The built system shall use real authenticated accounts.

```text
User signs in
    |
    v
Supabase Auth
    |
    v
Authenticated session / JWT
    |
    v
NestJS verifies identity
    |
    v
Find matching Prometheus member
    |
    +-------------------------+
    |                         |
    v                         v
Authorized + Active      No authorized member
    |                         |
    v                         v
Enter Prometheus          Deny access
```

For Google Sign-In, the verified Google email must match an authorized Prometheus member record.

If the user successfully authenticates with Google but has not been added by an Administrator, the user must not be allowed into Prometheus.

Authentication and Prometheus authorization are separate checks.

---

# 5. Production User Identity

The production application shall not use the prototype's `currentViewer` or Demo View selector for authorization.

The current user shall come from the authenticated account.

```text
Authenticated account
        |
        v
Prometheus member
        |
        v
Organization role
        |
        v
Project Lead relationships
        |
        v
Project Membership and access level
        |
        v
Outcome Memberships
        |
        v
Authorization decision
```

Users must not be able to switch into another user's identity through the frontend.

---

# 6. Main Application Flow

After successful authorization:

```text
Home
 |
 +-> Projects
 |
 +-> VisiWork
 |
 +-> Schedule
 |
 +-> Team
 |
 +-> Notifications
 |
 +-> Profile
 |
 +-> Registry
       Administrator only
```

All active authorized Prometheus users may access the normal Prometheus workspace.

Registry is only available to Administrators.

---

# 7. Registry Flow

## 7.1 Administrator

```text
Administrator
    |
    v
Registry is visible
    |
    v
Open Registry
    |
    +-> Manage departments
    +-> Add members
    +-> Edit members
    +-> Assign organization roles
    +-> Activate/deactivate access
    +-> View authentication status
```

## 7.2 Member

```text
Member
   |
   v
Registry is not visible
   |
   v
Attempts direct Registry route/API
   |
   v
Access denied
```

The Registry navigation item must not be rendered for non-Administrators.

Frontend visibility alone is not sufficient security.

Registry routes and administrative API endpoints must also verify the Administrator organization role.

Project Lead status does not grant Registry access.

---

# 8. Project Visibility

All projects are visible to all active authorized Prometheus users.

A user does not need to be the Project Lead, Project Member, or Outcome Member to open and inspect a project.

```text
Authorized Prometheus User
        |
        v
Projects
        |
        v
View All Projects
        |
        v
Open any project
```

Users may view project information, project status, Project Lead, stages, outcomes, Outcome Members, project progress, and other company-visible project information.

Viewing a project does not create Project Membership and does not grant edit authority.

---

# 9. Project Creation Flow

Any active authorized Prometheus user may create a project.

Project creation is not restricted to Administrators or existing Project Leads.

```text
Authorized user
      |
      v
Projects
      |
      v
+ Add Project
      |
      v
Enter project details
      |
      +-> Project name
      +-> Description
      +-> Departments
      +-> Project Lead
      |
      v
Select active authorized user as Project Lead
      |
      v
Create Project
```

The project creator may assign themselves as Project Lead.

The project creator may assign another active authorized user as Project Lead.

The project creator and Project Lead are separate concepts.

The project should retain the creator for audit purposes.

Conceptually:

```text
Project
- created_by_user_id
- lead_user_id
```

The creator receives no special authority after project creation unless another relationship grants it.

---

# 10. Project Member Access Management

The Project Lead can view the members participating in the project.

A Project Member is a user who belongs to at least one outcome in the project.

Each Project Member defaults to:

```text
CAN_VIEW
```

The Project Lead may grant:

```text
CAN_EDIT
```

The Project Lead may also return a Project Member to `CAN_VIEW`.

Project-member edit access is managed inside the project.

The Project Lead is the only user who may manage this access.

An Administrator who is not the Project Lead has no organization-level override for this permission.

`CAN_EDIT` grants project-level editing capabilities explicitly made available to editable Project Members.

At minimum, `CAN_EDIT` allows the Project Member to change the project's status.

`CAN_EDIT` does not automatically grant Project Lead-only actions such as creating project stages, creating project outcomes, managing Project Member access, reviewing submissions, accepting outcomes, or resolving dependencies.

---

# 11. Project Status Flow

Project status is configured from inside the project.

The manually selectable project states are:

```text
PLANNING
IN_PROGRESS
DONE
```

The Project Lead may change the project status.

A Project Member with `CAN_EDIT` may also change the project status.

A Project Member with `CAN_VIEW` may view the project status but may not change it.

The project does not require every outcome to be accepted before the status may be changed to `DONE`.

The Project Lead or an editable Project Member may set the project to `DONE` based on the actual project situation.

A project that remains `DONE` for 14 days shall automatically transition to:

```text
ARCHIVED
```

`ARCHIVED` is a system-managed project state rather than one of the normal manual status options.

---

# 12. Administrator, Project Lead, and Project Member Separation

Administrator permissions, Project Lead permissions, and Project Member edit permissions are independent.

Example:

```text
Rex Jumawid

Organization Role:
ADMINISTRATOR

Project A:
PROJECT LEAD

Project B:
PROJECT MEMBER - CAN_VIEW

Project C:
PROJECT MEMBER - CAN_EDIT
```

Rex may access Registry because he is an Administrator.

Rex may manage Project A because he is its Project Lead.

Rex may only view Project B at the project-edit level because his project access there is `CAN_VIEW`.

Rex may use the project-level edit capabilities granted by `CAN_EDIT` in Project C.

Rex may not perform Project Lead-only actions in Project B or Project C unless assigned as Project Lead.

Administrator status does not override these project relationships.

---

# 13. Project Lead Flow

A Project Lead controls the workflow structure and review process of the specific project they lead.

```text
Project Lead opens project
        |
        v
Project workspace
        |
        +-> View Project Members
        +-> Grant or revoke CAN_EDIT
        +-> Change project status
        +-> Create stages
        +-> Manage stages
        +-> Create outcomes
        +-> Define acceptance criteria
        +-> Configure prerequisites
        +-> Monitor project progress
        +-> Monitor Outcome Members
        +-> Review shared submission history
        +-> Request revisions
        +-> Accept outcomes
        +-> Reopen accepted outcomes
        +-> Resolve dependencies
        +-> View project-wide activity
```

Project Lead permissions apply only to projects where the user is assigned as lead.

An Administrator may perform these actions only when the Administrator is also the Project Lead of that project.

---

# 14. Outcome Visibility and Joining

All authorized Prometheus users may view the outcomes of all projects.

Any active authorized Prometheus user may join an outcome unless the outcome is currently accepted.

Joining does not require approval from the Project Lead.

A user may join an outcome while it is:

- Open for normal work.
- Locked by a dependency.
- For Review.
- Needs Revision.

A user may join multiple outcomes within the same project or across different projects.

Joining an outcome creates permanent Outcome Membership.

An Outcome Member cannot leave an outcome.

The Project Lead cannot remove an Outcome Member.

An accepted outcome does not accept new Outcome Members while it remains accepted.

If the Project Lead reopens an accepted outcome, it becomes available for additional Outcome Members again.

Joining a locked outcome is allowed, but the lock may still prevent work or submission actions until the dependency is resolved.

---

# 15. Outcome Member Permissions

After joining an outcome, the user becomes an Outcome Member.

Outcome Members may participate in the work of that outcome.

An Outcome Member may:

- Create features.
- Create tasks.
- Edit permitted features and tasks.
- Mark tasks complete.
- Prepare outputs.
- Submit outputs while the outcome is not accepted and is not otherwise blocked from submission.
- Revise work after a revision request.
- View review feedback.
- View the shared submission history.
- View other Outcome Members.

Outcome Membership applies only to the joined outcome.

Outcome Membership does not grant Project Lead or Administrator authority.

---

# 16. Project Participation

Prometheus does not require users to be manually assigned as project Participants.

Project participation is derived from Outcome Membership.

```text
User joins any outcome in Project A
        |
        v
User becomes Outcome Member
        |
        v
User becomes a Project Member of Project A
        |
        v
Project access defaults to CAN_VIEW
```

The **My Projects** view may remain divided into:

```text
My Projects
   |
   +-> Leading
   |
   +-> Participating
```

A project appears under **Leading** when the current user is its Project Lead.

A project appears under **Participating** when the current user is an Outcome Member of at least one outcome in that project and is not the Project Lead for that grouping.

---

# 17. Shared Outcome Submission History

Each outcome has one shared submission history.

The submission history belongs to the outcome rather than to an individual Outcome Member.

Any Outcome Member may add a new submission while the outcome has not been accepted and submission is not blocked by another workflow rule.

A new submission may be added even when one or more previous submissions are already `FOR_REVIEW`.

The system shall not require the previous submission to be resolved before another Outcome Member submits additional work.

Conceptually:

```text
Outcome
  |
  +-> Submission 1 - Member A - FOR_REVIEW
  +-> Submission 2 - Member B - FOR_REVIEW
  +-> Submission 3 - Member C - FOR_REVIEW
```

Each submission should preserve its submitter, timestamp, content or attachment references, notes, and review information.

The shared history shall remain available to Outcome Members and the Project Lead according to their permissions.

---

# 18. Output Review and Outcome Acceptance

The Project Lead may inspect multiple submissions in an outcome's shared submission history.

Outcome acceptance is an outcome-level decision rather than ownership of a single person's submission.

```text
Outcome Members submit work
        |
        v
Shared submission history grows
        |
        v
Project Lead reviews one or more submissions
        |
        +------------------------+
        |                        |
        v                        v
Request Revision          Accept Outcome
        |                        |
        v                        v
Continue work              ACCEPTED
```

Outcome Members may continue submitting additional work while other submissions are still for review, as long as the outcome has not been accepted and submission is not blocked by a dependency.

The Project Lead may determine that the combined reviewed submissions satisfy the outcome and accept the outcome.
Once the outcome is accepted, new submissions stop until the outcome is reopened.

An Administrator who is not the Project Lead does not receive review or acceptance authority.

---

# 19. Accepted Outcome, Credit, and Reopening

When the Project Lead accepts an outcome, all current Outcome Members are considered part of that accepted outcome.

All current Outcome Members receive credit for the accepted outcome.

No minimum contribution threshold is required.

The system shall preserve the Outcome Member list and acceptance history for audit and reporting.

Accepted Outcome Members remain Outcome Members permanently.

The Project Lead may reopen an accepted outcome.

Reopening an outcome does not remove existing Outcome Members and does not erase previous submissions or acceptance history.

After reopening, additional authorized Prometheus users may join the outcome and existing Outcome Members may continue work and submit new entries to the same shared submission history.

A later acceptance shall preserve the current Outcome Member list for that acceptance event.

---

# 20. Revision Flow

When the Project Lead requests a revision, the outcome remains active.

```text
Project Lead requests revision
        |
        v
Outcome = NEEDS_REVISION
        |
        v
Outcome Members continue work
        |
        v
New submissions may be added
        |
        v
Project Lead reviews again
```

Existing Outcome Members remain part of the outcome.

Other authorized Prometheus users may still join while the outcome is in `NEEDS_REVISION`.

---

# 21. Dependency Flow

An outcome may depend on another outcome.

```text
Prerequisite incomplete
        |
        v
Dependent outcome locked
        |
        +-------------------------+
        |                         |
        v                         v
Prerequisite accepted     Project Lead resolves/skips
        |                         |
        +------------+------------+
                     |
                     v
            Dependent outcome unlocked
```

A locked outcome remains visible.

Any active authorized Prometheus user may join a locked outcome.

The lock may still prevent work and submission until the dependency is resolved.

Project-level dependency decisions belong to the Project Lead.

---

# 22. Project Communication

Project information is company-visible to all authorized Prometheus users.

Authorized Prometheus users may view project communication where the product exposes it company-wide.

Project Members may participate in project communication where permitted.

Outcome-specific discussion may be associated with the corresponding outcome and its Outcome Members.

---

# 23. Project Activity

Project activity should provide transparency into project progress.

All authorized users may view normal project activity intended for company-wide visibility.

Project Leads may receive additional workflow and review information required to manage their projects.

Changes to project-member access, project status, outcome membership, submissions, acceptance, and reopening should be recorded in project activity.

Registry and organization-level administrative activity remains subject to Administrator access restrictions.

---

# 24. Schedule Flow

Members primarily manage their own schedules.

```text
Schedule
   |
   +-> Team Schedule
   |
   +-> Shifts
          |
          v
   Configure my schedule
```

Members may view permitted team schedule information.

Members should not modify another user's schedule unless a separate authorization rule is introduced.

---

# 25. Time In and Time Out

Authorized users may record their own work sessions.

```text
Member selects Time In
        |
        v
Work session begins
        |
        v
Elapsed work recorded
        |
        v
Member selects Time Out
        |
        v
Work session saved
```

Recorded work may be compared against scheduled working hours.

---

# 26. Permission Summary

| Action | Authorized User | Project Member CAN_VIEW | Project Member CAN_EDIT | Outcome Member | Project Lead | Administrator |
| --- | --- | --- | --- | --- | --- | --- |
| View all projects | Yes | Yes | Yes | Yes | Yes | Yes |
| Create project | Yes | Yes | Yes | Yes | Yes | Yes |
| Receive special authority because user created project | No | No | No | No | No | No |
| Join non-accepted outcome | Yes | Yes | Yes | Already joined where applicable | Yes | Yes |
| Join locked outcome | Yes | Yes | Yes | Already joined where applicable | Yes | Yes |
| Join outcome while For Review | Yes | Yes | Yes | Already joined where applicable | Yes | Yes |
| Leave outcome | No | No | No | No | No | No |
| Remove Outcome Member | No | No | No | No | No | No |
| Work in joined outcome | No until joined | If Outcome Member | If Outcome Member | Yes | Yes if Outcome Member | Yes if Outcome Member |
| Submit to joined outcome | No until joined | If Outcome Member | If Outcome Member | Yes while not accepted | Yes if Outcome Member | Yes if Outcome Member |
| Change project status | No | No | Yes | Based on project access | Yes | Only through project role |
| Manage Project Member CAN_EDIT access | No | No | No | No | Yes | Only if also Project Lead |
| Create stages/outcomes | No | No | No | No | Yes | Only if also Project Lead |
| Review submissions | No | No | No | No | Yes | Only if also Project Lead |
| Accept or reopen outcomes | No | No | No | No | Yes | Only if also Project Lead |
| Access Registry | No | No | No | No | Only if also Administrator | Yes |

A single user may hold several relationships at the same time.

The effective permission is the combination of the user's organization role, Project Lead relationship, Project Member access level, and Outcome Membership.

---

# 27. Access-Control and Lifecycle Rules

1. Authentication alone does not grant access to Prometheus.
2. A user must have an active authorized Prometheus member record.
3. Only Administrators may access Registry.
4. Administrator status does not automatically grant project-level authority.
5. All active authorized users may view all projects and outcomes.
6. Any active authorized user may create a project.
7. The project creator receives no special authority from creation itself.
8. The creator may assign themselves or another active authorized user as Project Lead.
9. Project Lead authority applies only to projects the user leads.
10. Project Membership is derived from Outcome Membership.
11. Every Project Member defaults to `CAN_VIEW`.
12. Only the Project Lead may grant or revoke `CAN_EDIT` for Project Members.
13. Administrator status alone does not permit project-member access management.
14. The Project Lead and Project Members with `CAN_EDIT` may change project status.
15. Manual project states are `PLANNING`, `IN_PROGRESS`, and `DONE`.
16. A project may be set to `DONE` even when some outcomes are not accepted.
17. A project that remains `DONE` for 14 days automatically becomes `ARCHIVED`.
18. Any active authorized user may join a locked outcome.
19. Any active authorized user may join an outcome while it is `FOR_REVIEW`.
20. Outcome Membership is permanent once created.
21. Outcome Members cannot leave an outcome.
22. Project Leads cannot remove Outcome Members.
23. Each outcome has one shared submission history.
24. Multiple submissions may be `FOR_REVIEW` at the same time.
25. Outcome Members may continue submitting while previous submissions are for review, provided the outcome is not accepted and submission is not otherwise blocked.
26. Outcome acceptance is an outcome-level Project Lead decision that may be based on multiple submissions.
27. All Outcome Members receive credit when the outcome is accepted.
28. Accepted outcomes stop new submissions and new joins while accepted.
29. The Project Lead may reopen an accepted outcome.
30. Reopening preserves existing Outcome Membership, submission history, and acceptance history.
31. After reopening, users may join and Outcome Members may submit again.
32. Important authorization and lifecycle rules must be enforced by the backend and not only through frontend visibility.
33. Invitation account setup for an invited `@gmail.com` address uses Google authentication and does not offer password creation.
34. Invitation account setup for any other invited domain uses email/password setup and does not offer Google authentication.
