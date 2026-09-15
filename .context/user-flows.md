# Prometheus User Flows

## 1. Purpose

This document defines the canonical user flows and access-control behavior for the Prometheus Centralized Workflow Management System.

It describes how authentication, organization roles, project leadership, project visibility, outcome participation, Registry access, project creation, and project work should behave in the built system.

The Software Requirements Specification remains the source of truth for functional requirements.

The tech stack document remains the source of truth for implementation architecture.

`finalmodel.html` is an interaction prototype and must not be treated as the production authorization mechanism.

---

# 2. Authorization Model

Prometheus separates organization-level authorization, project-level leadership, and outcome-level participation.

## 2.1 Organization Roles

Every authorized Prometheus user has one organization role:

```text
ADMINISTRATOR
MEMBER
```

Administrators manage organization-level information, membership, and access.

Members are regular authorized Prometheus users.

Organization roles do not determine who may participate in project outcomes.

Both Administrators and Members may participate in project work.

## 2.2 Project Lead

Each project has a Project Lead.

Project Lead is not an organization role.

A Member may be the Project Lead of a project.

An Administrator may also be the Project Lead of a project.

Project Lead authority exists only for projects where the user has been explicitly assigned as Project Lead.

Being an Administrator does not automatically make a user the Project Lead of every project.

## 2.3 Outcome Membership

Any authorized Prometheus user may join an available outcome.

After joining an outcome, the user becomes an **Outcome Member** of that outcome.

Outcome Membership is specific to each outcome.

A user may be an Outcome Member of multiple outcomes across multiple projects.

Outcome Members may participate in the work of the outcomes they joined.

When an outcome is accepted, all Outcome Members of that outcome are considered part of the accepted outcome and receive credit for it.

No additional contribution threshold is required for Outcome Members to receive credit.

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
User opens Prometheus
        |
        +----------------------+
        |                      |
        v                      v
Continue with Google    Email/password setup
        |                      |
        +----------+-----------+
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

The Administrator-created member record determines whether the person is authorized to access Prometheus.

Receiving a valid Google authentication does not automatically grant Prometheus access.

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

If the user successfully signs in with Google but has not been added by an Administrator, the user must not be allowed into Prometheus.

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

An Administrator retains Registry access regardless of whether they lead a project because Registry authority comes from the Administrator organization role.

---

# 8. Project Visibility

All projects are visible to all active authorized Prometheus users.

A user does not need to be the Project Lead or an Outcome Member to open and inspect a project.

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

Users may view:

- Project information.
- Project status.
- Project Lead.
- Project stages.
- Project outcomes.
- Outcome status.
- Outcome Members.
- Project progress.
- Other project information intended for company-wide visibility.

Viewing a project does not automatically grant Project Lead authority.

Viewing a project also does not automatically make the user an Outcome Member.

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
      +-> Status
      +-> Departments
      +-> Project Lead
      |
      v
Select active authorized member as Project Lead
      |
      v
Create Project
```

The project creator may assign themselves as Project Lead.

The project creator may also assign another active authorized user as Project Lead.

This applies to both Members and Administrators.

Examples:

```text
Administrator creates Project A
-> assigns themselves as Project Lead
```

```text
Administrator creates Project B
-> assigns another Member as Project Lead
```

```text
Member creates Project C
-> assigns themselves as Project Lead
```

```text
Member creates Project D
-> assigns another authorized user as Project Lead
```

The project creator and Project Lead are separate concepts.

The project should retain the creator for audit purposes.

Conceptually:

```text
Project
- created_by_user_id
- lead_user_id
```

Creating a project does not automatically make the creator its Project Lead when another user is selected as the lead.

---

# 10. Administrator and Project Lead Separation

Administrator permissions and Project Lead permissions are independent.

Example:

```text
Rex Jumawid

Organization Role:
ADMINISTRATOR

Project A:
PROJECT LEAD

Project B:
NOT PROJECT LEAD
```

Rex may access Registry because he is an Administrator.

Rex may perform Project Lead actions in Project A because he is the assigned Project Lead.

Rex must not receive Project Lead authority in Project B simply because he is an Administrator.

Rex may still view Project B and join any available outcome in Project B like any other authorized Prometheus user.

The permission checks should conceptually be:

```text
Registry access
-> currentUser.organizationRole == ADMINISTRATOR
```

```text
Project Lead action
-> project.leadUserId == currentUser.id
```

```text
Outcome work
-> currentUser is an Outcome Member
```

---

# 11. Project Lead Flow

A Project Lead controls the workflow structure and review process of the specific project they lead.

```text
Project Lead opens project
        |
        v
Project workspace
        |
        +-> Create stages
        +-> Manage stages
        +-> Create outcomes
        +-> Define acceptance criteria
        +-> Configure prerequisites
        +-> Monitor project progress
        +-> Monitor Outcome Members
        +-> Review submitted outputs
        +-> Request revisions
        +-> Accept outcomes
        +-> Resolve dependencies
        +-> Change project state
        +-> View project-wide activity
```

Project Lead permissions apply only to projects where the user is assigned as lead.

An Administrator may perform these actions only when the Administrator is also the Project Lead of that project.

The Project Lead does not need to manually assign users before they may participate in an available outcome.

Any authorized Prometheus user may join an available outcome themselves.

---

# 12. Outcome Visibility

All authorized Prometheus users may view the outcomes of visible projects.

```text
Authorized user
      |
      v
Open project
      |
      v
View project stages
      |
      v
View outcomes
```

Users may inspect an outcome without joining it.

A user who has not joined an outcome has view access but does not yet have Outcome Member work permissions.

---

# 13. Joining an Outcome

Any active authorized Prometheus user may join any outcome that is available for participation.

```text
Authorized Prometheus User
        |
        v
Open any project
        |
        v
Open available outcome
        |
        v
Join Outcome
        |
        v
User becomes Outcome Member
```

Joining an outcome does not require approval from the Project Lead.

Joining an outcome does not make the user the Project Lead.

A user may join multiple outcomes within the same project.

A user may also join outcomes across multiple projects.

Accepted outcomes are considered completed and no longer open for new Outcome Members.

---

# 14. Outcome Member Permissions

After joining an outcome, the user becomes an Outcome Member.

Outcome Members may participate in the work of that outcome.

An Outcome Member may:

- Create features.
- Create tasks.
- Edit permitted features and tasks.
- Mark tasks complete.
- Participate in completing the outcome.
- Prepare output drafts.
- Submit outputs.
- Revise outputs after a revision request.
- View review feedback.
- View submission history.
- View other Outcome Members.

These permissions apply only to outcomes where the user is an Outcome Member.

A user who has not joined an outcome may view it but may not perform Outcome Member work actions.

Conceptually:

```text
Authorized user + not joined
-> View outcome

Authorized user + joined
-> Outcome Member
-> View + Work + Submit

Project Lead
-> Manage + Review + Accept
```

---

# 15. Project Participation

Prometheus does not require users to be manually assigned as project Participants before joining project work.

Project participation is derived from outcome participation.

A user is considered to be **Participating** in a project when the user is an Outcome Member of at least one outcome in that project.

```text
User joins Outcome A
        |
        v
User becomes Outcome Member
        |
        v
User is now participating in the project
```

This allows the **My Projects** view to remain divided into:

```text
My Projects
   |
   +-> Leading
   |
   +-> Participating
```

A project appears under **Leading** when the current user is its Project Lead.

A project appears under **Participating** when the current user is an Outcome Member of at least one outcome in that project and is not its Project Lead.

A Project Lead may also be an Outcome Member of outcomes within their own project.

---

# 16. Outcome Work Flow

The normal outcome work flow is:

```text
Project Lead creates outcome
        |
        v
Outcome becomes available
        |
        v
Authorized users view outcome
        |
        v
Users join outcome
        |
        v
Users become Outcome Members
        |
        v
Outcome Members perform work
        |
        +-> Create features
        +-> Create tasks
        +-> Complete tasks
        +-> Prepare outputs
        +-> Submit outputs
        |
        v
Project Lead reviews
```

Multiple Outcome Members may work on the same outcome.

Outcome Membership should be stored so that the system can identify everyone who belongs to the outcome.

---

# 17. Output Submission Flow

Any Outcome Member may submit an output for the outcome they joined.

```text
Outcome Member
      |
      v
Prepare output
      |
      v
Submit output
      |
      v
FOR REVIEW
      |
      v
Project Lead reviews
```

A user who has not joined the outcome may not submit an output for that outcome.

Submission authority comes from Outcome Membership.

---

# 18. Output Review and Outcome Acceptance

The Project Lead reviews submitted work.

```text
Outcome Member submits output
        |
        v
FOR REVIEW
        |
        v
Project Lead reviews
        |
        +-----------------------+
        |                       |
        v                       v
Accept                    Request Revision
        |                       |
        v                       v
Outcome Accepted         NEEDS REVISION
                                |
                                v
                       Outcome Members revise
                                |
                                v
                            Resubmit
```

Only the Project Lead of the corresponding project may perform Project Lead review actions.

An Administrator who is not the Project Lead must not automatically gain output-review authority.

An Administrator who is assigned as Project Lead may review and accept the outcome because of the Project Lead relationship.

---

# 19. Accepted Outcome and Credit

When the Project Lead accepts an outcome, the outcome becomes completed.

All users who are Outcome Members at the time the outcome is accepted are considered part of that accepted outcome.

```text
Outcome
Status: ACCEPTED

Outcome Members:
- Member A
- Member B
- Member C
```

Member A, Member B, and Member C are all credited as members of the accepted outcome.

The system does not need to calculate how much each Outcome Member contributed before granting this credit.

Outcome Membership itself determines inclusion in the accepted outcome.

Once an outcome has been accepted:

- Its Outcome Member list should be preserved.
- Its accepted status should be preserved.
- Its accepted Outcome Members should remain associated with the outcome for history and reporting.
- New users should not join the already accepted outcome.

---

# 20. Revision Flow

When the Project Lead requests a revision, the outcome remains active.

```text
Project Lead requests revision
        |
        v
Outcome = NEEDS REVISION
        |
        v
Outcome Members continue work
        |
        v
Revise output
        |
        v
Resubmit
        |
        v
Project Lead reviews again
```

Existing Outcome Members remain part of the outcome during the revision process.

Other authorized Prometheus users may still join the outcome while it remains available for participation.

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

A locked outcome may remain visible to all authorized users.

While locked, work and submission actions may be unavailable until the dependency is resolved.

Project-level dependency decisions belong to the Project Lead.

---

# 22. Project Communication

Project information is company-visible to all authorized Prometheus users.

Project communication should follow the same internal visibility model unless a future requirement introduces private project communication.

Authorized Prometheus users may view project communication.

Users participating in the project may communicate about project work.

Outcome-specific discussion may be associated with the corresponding outcome and its Outcome Members where appropriate.

---

# 23. Project Activity

Project activity should provide transparency into project progress.

All authorized users may view normal project activity intended for company-wide visibility.

Project Leads may receive additional workflow and review information needed to manage their projects.

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
          |
          +-> Weekly target hours
          +-> Daily schedule blocks
          +-> Rest days
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

| Action | Authorized User | Outcome Member | Project Lead | Administrator |
| --- | --- | --- | --- | --- |
| Access Prometheus after authorization | Yes | Yes | Yes | Yes |
| View all projects | Yes | Yes | Yes | Yes |
| View all project outcomes | Yes | Yes | Yes | Yes |
| Create project | Yes | Yes | Yes | Yes |
| Assign self as Project Lead when creating project | Yes | Yes | Yes | Yes |
| Assign another active user as Project Lead | Yes | Yes | Yes | Yes |
| Join available outcome | Yes | Already joined | Yes | Yes |
| Create features/tasks in outcome | No until joined | Yes | Yes if Outcome Member | Yes if Outcome Member |
| Submit outcome output | No until joined | Yes | Yes if Outcome Member | Yes if Outcome Member |
| Receive credit for accepted outcome | No unless joined | Yes | Yes if Outcome Member | Yes if Outcome Member |
| Create stages | No | No | Yes, for projects led | Only if also Project Lead |
| Create outcomes | No | No | Yes, for projects led | Only if also Project Lead |
| Define acceptance criteria | No | No | Yes, for projects led | Only if also Project Lead |
| Review outputs | No | No | Yes, for projects led | Only if also Project Lead |
| Request revisions | No | No | Yes, for projects led | Only if also Project Lead |
| Accept outcomes | No | No | Yes, for projects led | Only if also Project Lead |
| Resolve dependencies | No | No | Yes, for projects led | Only if also Project Lead |
| Change project state | No | No | Yes, for projects led | Only if also Project Lead |
| Access Registry | No | No | Only if also Administrator | Yes |
| Add members | No | No | Only if also Administrator | Yes |
| Manage departments | No | No | Only if also Administrator | Yes |
| Manage workspace authorization | No | No | Only if also Administrator | Yes |

Project Lead represents a project-specific responsibility.

Outcome Member represents an outcome-specific participation relationship.

Administrator represents an organization-level role.

These relationships may exist simultaneously for the same person.

---

# 27. Example Combined Roles

## 27.1 Administrator and Project Lead

```text
Rex Jumawid

Organization Role:
ADMINISTRATOR

Project A:
PROJECT LEAD

Outcome A1:
OUTCOME MEMBER

Project B:
NOT PROJECT LEAD

Outcome B2:
OUTCOME MEMBER
```

Rex may access Registry because he is an Administrator.

Rex may manage Project A because he is its Project Lead.

Rex may participate in Outcome A1 because he joined it.

Rex may view Project B because all projects are visible to authorized users.

Rex may work on Outcome B2 because he joined that outcome.

Rex may not perform Project Lead actions in Project B unless assigned as its Project Lead.

## 27.2 Member and Project Lead

```text
Nico Ramos

Organization Role:
MEMBER

Project B:
PROJECT LEAD

Outcome B1:
OUTCOME MEMBER
```

Nico may manage Project B because he is its Project Lead.

Nico may work on Outcome B1 because he is an Outcome Member.

Nico cannot access Registry because he is not an Administrator.

## 27.3 Regular Member

```text
Bea Santos

Organization Role:
MEMBER

Project A:
Not Lead

Outcome A1:
OUTCOME MEMBER

Outcome A2:
Not Joined
```

Bea may view Project A and both outcomes.

Bea may work on Outcome A1 because she joined it.

Bea may only view Outcome A2 until she joins it.

If Bea joins Outcome A2, she becomes an Outcome Member and may participate in its work.

---

# 28. Access-Control Rules

1. Authentication alone does not grant access to Prometheus.
2. A user must have an active authorized Prometheus member record.
3. Only Administrators may access Registry.
4. Registry must be hidden from non-Administrators.
5. Registry routes and API endpoints must enforce Administrator authorization.
6. All active authorized Prometheus users may view all projects.
7. All active authorized Prometheus users may view project outcomes.
8. Any active authorized Prometheus user may create a project.
9. A project creator may assign themselves or another active authorized user as Project Lead.
10. Project creator and Project Lead are separate concepts.
11. Administrator status does not automatically grant Project Lead authority.
12. An Administrator may become Project Lead when explicitly assigned.
13. Project Lead permissions apply only to projects the user leads.
14. Project Lead status does not grant Registry access.
15. Any active authorized Prometheus user may join any available outcome.
16. Joining an outcome makes the user an Outcome Member.
17. Outcome Membership is specific to each outcome.
18. Outcome Members may participate in work and submit outputs for the outcomes they joined.
19. Users who have not joined an outcome may view it but may not perform Outcome Member work actions.
20. Project participation is derived from Outcome Membership.
21. A user participating in at least one outcome of a project is considered a participant in that project.
22. All Outcome Members of an accepted outcome are considered part of that accepted outcome.
23. All Outcome Members receive credit when their outcome is accepted.
24. No minimum contribution requirement is needed for Outcome Member credit.
25. Accepted outcomes no longer accept new Outcome Members.
26. Accepted Outcome Member records must be preserved for history and reporting.
27. Project Lead review authority remains separate from Outcome Membership.
28. Production identity must come from the authenticated account.
29. Users must not be able to switch identities through a client-side viewer selector.
30. Important authorization rules must be enforced by the backend and not only through hidden frontend controls.