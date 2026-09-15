# Software Requirements Specification

## Prometheus Centralized Workflow Management System

**Version:** 0.1 Draft  
**Organization:** Prometheus Software Company  
**Document Type:** Software Requirements Specification

---

# 1. Introduction

## 1.1 Purpose

This Software Requirements Specification defines the functional and non-functional requirements for the Prometheus Centralized Workflow Management System.

Prometheus is a software company that provides software development services to clients.
The company handles multiple software projects that may involve different teams, departments, Project Leads, and members.

As the number of projects and team members increases, project information, schedules, progress updates, deliverables, participation records, and employee work records can become distributed across different tools and communication channels.

The proposed system will provide Prometheus with a dedicated centralized platform for managing its internal software development workflow.

The system is intended to support project tracking, project creation, open internal project visibility, outcome participation, project management, member tracking, work scheduling, project deliverables, collaboration, performance monitoring, and administrative management within a single platform.

The canonical user flows define the expected interaction and access-control behavior of the system.

---

## 1.2 Background

Prometheus develops software solutions for different clients through project-based teams.

A project may involve multiple departments such as Research and Development, Creatives, Sales and Marketing, and other organizational units.

Different members may contribute to several projects simultaneously, while selected members may serve as Project Leads for particular projects.

The system uses an open internal participation model.
All active authorized Prometheus users may view all projects and their outcomes.
Any active authorized user may join an available outcome and become an Outcome Member without requiring manual assignment or Project Lead approval.

Project leadership remains specific to an individual project instead of becoming a company-wide organizational role.
Project participation is derived from Outcome Membership rather than from a separate manually assigned project-participant role.

The existing prototype organizes company operations around Projects, project stages, outcomes, outputs, schedules, team information, notifications, reports, and administrative controls.

---

## 1.3 Scope

The Prometheus Centralized Workflow Management System will be an internal web-based platform used by authorized Prometheus personnel to manage company projects and related operational activities.

The system will centralize the following major areas:

1. Project creation and management
2. Company-wide internal project visibility
3. Project leadership
4. Project stages and workflow tracking
5. Outcome Membership and participation
6. Feature and task management
7. Department participation
8. Output submission and review
9. Accepted outcome credit
10. Team and member monitoring
11. Work schedules and availability
12. Time In and Time Out records
13. Notifications
14. Project communication
15. Reports and analytics
16. User, department, role, and access administration

The objective is to provide a single source of truth for the company's project delivery workflow.

---

# 2. System Objectives

The system shall provide Prometheus with a centralized platform that allows the company to:

- Track all active, planned, and completed software projects.
- Allow all active authorized users to view company projects and project outcomes.
- Allow any active authorized user to create a project.
- Allow a project creator to assign themselves or another active authorized user as Project Lead.
- Distinguish organization-level roles from project-specific Project Lead responsibility.
- Allow authorized users to join available outcomes and become Outcome Members.
- Identify which projects each member leads or participates in.
- Derive project participation from Outcome Membership.
- Break projects into manageable stages, outcomes, features, and tasks.
- Monitor project and outcome progress.
- Define measurable acceptance criteria for project outcomes.
- Submit and review project deliverables.
- Preserve Outcome Membership when an outcome is accepted.
- Credit all Outcome Members who belong to an outcome at the time it is accepted.
- Monitor member availability and current work activity.
- Compare scheduled working hours against actual recorded work.
- Notify users of important project events and required actions.
- Provide management with visibility into project health, workload, outcome participation, and team capacity.
- Maintain organizational departments, members, roles, and system access.

---

# 3. Product Overview

## 3.1 Product Perspective

The Prometheus system will function as the primary internal operations platform for project delivery.

Instead of using independent tools for project management, employee availability, time tracking, deliverable reviews, notifications, and management reporting, the system will connect these activities through shared project, outcome, and member data.

The Home interface will serve as a company command center and will provide information such as the user's projects, members currently working, items requiring attention, and shortcuts to major areas of the system.

All active authorized Prometheus users will be able to browse all projects.
The My Projects view will distinguish projects the current user leads from projects in which the current user participates through Outcome Membership.

---

## 3.2 User Classes

### Administrator

Administrators manage organization-level information and system access.

Administrators shall be able to manage:

- Departments
- Members
- Organizational roles
- Workspace access
- User authorization
- Administrative records

Administrator authority does not automatically grant Project Lead authority.
An Administrator may become Project Lead when explicitly assigned as the lead of a project.

The system shall separate membership authorization from authentication and provide an administrative Registry for departments, members, organizational roles, and workspace authorization.

### Member

A Member is a regular active authorized user of Prometheus.

Members may:

- View all company projects.
- View project stages and outcomes.
- Create projects.
- Assign themselves or another active authorized user as Project Lead when creating a project.
- Join available outcomes.
- Become an Outcome Member of multiple outcomes across multiple projects.
- Work on features and tasks within outcomes they have joined.
- Submit project outputs for outcomes they have joined.
- Receive credit when an outcome they belong to is accepted.
- Configure their own work schedule.
- Record their own work sessions.
- Participate in permitted project communication.
- Receive notifications.

### Project Lead

Project Lead is a project-specific responsibility rather than a permanent company-wide user role.

A Member or Administrator may be the Project Lead of a project.
A user may lead one project while participating through Outcome Membership in another project.

Project Leads shall have additional authority only within projects they lead, including:

- Managing project stages.
- Creating and managing outcomes.
- Defining acceptance criteria.
- Configuring outcome prerequisites.
- Monitoring project progress.
- Monitoring Outcome Membership.
- Reviewing submitted outputs.
- Requesting revisions.
- Accepting completed outcomes.
- Resolving project dependencies.
- Changing project state.
- Viewing project-wide activity required for project management.

Project Leads do not need to manually assign users before those users may participate in an available outcome.

### Outcome Member

Outcome Member is an outcome-specific participation relationship.

Any active authorized Prometheus user may become an Outcome Member by joining an available outcome.

Outcome Members may:

- Work on features and tasks within the outcome they joined.
- Prepare and submit outputs for that outcome.
- Revise outputs after a revision request.
- View review feedback and submission history.
- View other Outcome Members of the same outcome.

Outcome Membership does not grant Project Lead or Administrator authority.

---

# 4. Core System Entities

The system shall manage the following primary entities.

## 4.1 Project

A Project represents a software development engagement undertaken by Prometheus.

A project shall contain information including:

- Project name
- Description
- Project status
- Project creator
- Project Lead
- Participating departments
- Project stages
- Outcomes
- Progress
- Outputs
- Activity history

Projects may be classified as Planning, In Progress, or Done.

All active authorized Prometheus users shall be able to view all projects.

The system shall distinguish the project creator from the Project Lead.
Creating a project does not automatically make the creator the Project Lead when another user is selected as the lead.

The My Projects view shall separate projects according to whether the current user is Leading or Participating.
Participation shall be derived from Outcome Membership.

---

## 4.2 Project Stage

A Project Stage represents a major phase in the project workflow.

Example stages may include:

- Discovery and Planning
- Design
- Development
- Testing
- Deployment
- Project Completion

Project Leads shall be able to create stages according to the needs of each project.

---

## 4.3 Outcome

An Outcome represents a measurable result that must be completed within a project stage.

An outcome may contain:

- Outcome title
- Description
- Associated department or departments
- Outcome Members
- Acceptance criteria
- Features
- Tasks
- Progress
- Prerequisite outcomes
- Submitted outputs
- Review status
- Feedback

All active authorized Prometheus users shall be able to view project outcomes.

Available outcomes shall allow active authorized users to join and become Outcome Members.
Accepted outcomes shall no longer accept new Outcome Members.

---

## 4.4 Outcome Membership

Outcome Membership represents a user's participation in a specific outcome.

Outcome Membership shall identify the user and the outcome joined.

A user may hold Outcome Membership in multiple outcomes within the same project or across different projects.

Project participation shall be derived from Outcome Membership.
A user shall be considered Participating in a project when the user is an Outcome Member of at least one outcome in that project and is not the Project Lead for the purpose of the My Projects grouping.

When an outcome is accepted, its Outcome Member list shall be preserved for history, reporting, and credit.

---

## 4.5 Feature and Task

Features represent major pieces of work required to achieve an outcome.

Tasks represent smaller actionable items under a feature.

Tasks shall be capable of being marked as incomplete or complete.

Task completion shall contribute to the progress of the associated feature and outcome.

Outcome Members shall be able to manage permitted features and tasks within outcomes they have joined.

---

## 4.6 Output

An Output represents a deliverable submitted as evidence that an outcome has been completed.

Examples may include:

- UI/UX prototype
- Software build
- Source implementation
- Documentation
- Requirements document
- Test results
- Architecture document
- Client presentation

Outputs may have statuses such as Draft, For Review, Needs Revision, or Accepted.

Output history shall preserve previous submissions, submitters, review decisions, feedback, and related timestamps.

---

# 5. Functional Requirements

## FR-01 User Authentication and Workspace Authorization

The system shall provide secure authentication for Prometheus users.

The system shall support authenticated sessions and shall restrict protected areas based on Prometheus workspace authorization.

Authentication and Prometheus workspace authorization shall be treated as separate checks.

The system shall:

- Allow supported users to sign in through configured authentication methods.
- Support Google authentication through the configured authentication provider.
- Use the verified identity returned by the authentication provider.
- Match the authenticated identity to an authorized Prometheus member record.
- Deny Prometheus workspace access when no authorized active member record matches the authenticated identity.
- Maintain authenticated sessions.
- Restrict protected operations based on organization role, Project Lead relationship, and Outcome Membership.
- Provide account recovery or password reset capabilities where applicable.

A successful Google authentication shall not automatically grant access to Prometheus.

---

## FR-02 Home Dashboard

The system shall provide each authenticated and authorized user with a personalized Home dashboard.

The dashboard shall display relevant information including:

- Projects led by the user
- Projects participated in by the user through Outcome Membership
- Current project progress
- Members currently working
- Items requiring attention
- Pending reviews for Project Leads
- Relevant notifications
- Quick access to major system modules

The dashboard shall derive project participation from Outcome Membership rather than from a manually assigned project-participant role.

---

## FR-03 Project Visibility and Creation

All active authorized Prometheus users shall be able to view all projects.

Any active authorized Prometheus user shall be able to create a project.

Project creation shall not be restricted to Administrators or existing Project Leads.

The system shall allow project information including:

- Project title
- Project description
- Project status
- Project creator
- Project Lead
- Participating departments

During project creation, the creator shall be able to select themselves or another active authorized Prometheus user as Project Lead.

The system shall store the project creator separately from the Project Lead for auditability.

New projects may initially contain no stages so that the assigned Project Lead can define a workflow appropriate for the project.

---

## FR-04 Project Participation

Prometheus shall not require users to be manually assigned as project Participants before joining project work.

Project participation shall be derived from Outcome Membership.

A user shall be considered Participating in a project when the user is an Outcome Member of at least one outcome in that project.

The My Projects view shall provide:

- Leading, for projects where the current user is the Project Lead.
- Participating, for projects where the current user is an Outcome Member of at least one outcome and is not the Project Lead for that grouping.

A Project Lead may also join outcomes within their own project and become an Outcome Member.

---

## FR-05 Project Stage Management

Project Leads shall be able to:

- Create project stages.
- Rename project stages.
- Organize project work according to stages.
- Add outcomes to individual stages.
- Monitor work contained within each stage.

Project stage management authority shall apply only to projects the user leads.

---

## FR-06 Outcome Management

Project Leads shall be able to create and manage project outcomes within projects they lead.

Project Leads shall be able to:

- Create outcomes.
- Associate outcomes with project stages.
- Associate departments with outcomes where applicable.
- Define acceptance criteria.
- Configure prerequisite outcomes.
- Monitor outcome progress.
- Monitor Outcome Membership.
- Review outcome submissions.
- Request revisions.
- Accept outcomes.

All active authorized Prometheus users shall be able to view outcomes.

Any active authorized Prometheus user shall be able to join an outcome that is available for participation without requiring Project Lead approval.

Accepted outcomes shall be considered completed and shall no longer accept new Outcome Members.

Locked outcomes may remain visible while work and submission actions are unavailable until their dependency is resolved.

---

## FR-07 Outcome Membership and Feature/Task Management

An active authorized Prometheus user who joins an available outcome shall become an Outcome Member of that outcome.

Outcome Members shall be able to perform permitted work within outcomes they have joined.

The system shall allow Outcome Members to:

- Create features.
- Add tasks under features.
- Edit permitted features and tasks.
- Mark tasks as completed.
- Monitor feature progress.
- Monitor outcome progress.
- Prepare output drafts.
- View review feedback.
- View submission history.
- View other Outcome Members.

A user who has not joined an outcome may view the outcome but shall not perform Outcome Member work actions.

Outcome Membership shall be specific to each outcome and shall not grant Project Lead or Administrator authority.

---

## FR-08 Output Submission, Review, and Accepted Outcome Credit

Any Outcome Member shall be able to submit outputs associated with an outcome they have joined.

A user who has not joined an outcome shall not be permitted to submit an output for that outcome.

The system shall allow the Project Lead of the corresponding project to:

- Review submitted outputs.
- View submission notes.
- Provide feedback.
- Request revisions.
- Accept completed outcomes.

When a revision is requested, existing Outcome Members shall remain members of the outcome and may continue working and resubmitting outputs.

The system shall maintain output history so that previous submissions and review decisions can be traced.

When the Project Lead accepts an outcome:

- The outcome shall become accepted and completed.
- The current Outcome Member list shall be preserved.
- Every Outcome Member belonging to the outcome at the time of acceptance shall be considered part of that accepted outcome.
- Every such Outcome Member shall receive credit for the accepted outcome.
- No minimum contribution threshold shall be required for Outcome Member credit.
- New users shall not be able to join the accepted outcome.

---

## FR-09 Team and Member Tracking

The system shall provide a Team module containing information about Prometheus members.

The system shall display relevant information including:

- Member name
- Department
- Position
- Availability
- Current work status
- Scheduled working hours
- Actual worked hours

The Team view is intended to provide people, availability, current work status, and weekly commitment information at a glance.

---

## FR-10 Schedule Management

Members shall be able to define their planned working schedule.

The system shall allow members to configure:

- Target working hours per week
- Initial working hours per day
- Rest days
- Daily schedule blocks

Members shall be able to redistribute their scheduled hours across available days while maintaining visibility of their weekly commitment.

The Team Schedule shall combine member schedules into a shared weekly calendar.

---

## FR-11 Shift and Work Session Tracking

The system shall record actual work performed by members.

The system shall support:

- Time In
- Time Out
- Recorded work sessions
- Weekly work history
- Scheduled hours
- Actual worked hours
- Difference between scheduled and worked hours
- Work performed within scheduled periods
- Work performed outside scheduled periods

Members shall record their own work sessions.

The current workflow already calculates scheduled time, worked time, overlap, variance, and work outside the planned schedule.

---

## FR-12 Notifications

The system shall provide a centralized notification inbox.

Notifications may be generated for events including:

- Project Lead assignment
- User joined an outcome
- Output submitted for review
- Review completed
- Revision requested
- Outcome accepted
- Outcome dependency unlocked
- User mentioned
- Project milestone changed
- Outcome progress changed
- Project-related replies

Users shall be able to distinguish read and unread notifications.

The system shall allow users to mark notifications as read.

---

## FR-13 Project Communication

Each project shall provide a communication area for project-related discussion.

Authorized Prometheus users shall be able to view project communication according to the system's internal project-visibility model.

Users participating in a project through Project Lead responsibility or Outcome Membership shall be able to participate in project communication where permitted.

Outcome-specific discussion may be associated with the relevant outcome and its Outcome Members.

---

## FR-14 Reports and Analytics

The system shall provide management and authorized users with operational reports.

Reports shall include information related to:

- Project health
- Project progress
- Outcome pipeline
- Outcome Membership and accepted outcome credit
- Team capacity
- Department workload
- Scheduled versus actual working hours

Reports shall preserve accepted Outcome Membership so that historical participation and credit remain traceable.

---

## FR-15 Department Management

Administrators shall be able to:

- Create departments.
- Edit department information.
- View members assigned to departments.
- Associate departments with projects.
- Associate departments with outcomes where applicable.

Department membership shall not prevent an active authorized user from viewing projects or joining available outcomes unless a future explicit access rule is introduced.

---

## FR-16 Member Administration

The Registry shall be restricted to users with the Administrator organizational role.

Non-administrator users shall not be permitted to access the Registry interface or its administrative API endpoints.

Administrators shall be able to:

- Add members.
- Edit member information.
- Assign members to departments.
- Assign organizational roles.
- Activate or deactivate workspace access.
- View authentication status.

When an Administrator adds a member, the system shall create an authorized member record with the appropriate invitation or account status.

The system shall support sending an account setup or invitation email to newly authorized members through the configured transactional email service.

Authentication identity shall be linked to the authorized Prometheus member record when the user successfully completes authentication and authorization checks.

---

## FR-17 Search and Filtering

The system shall provide search and filtering where appropriate.

Users shall be able to search or filter information including:

- Projects
- Members
- Departments
- Project status
- Projects led by the current user
- Projects participated in through Outcome Membership
- Outcome status
- Outcome Members
- Schedule information
- Notifications

---

## FR-18 Activity History

The system shall maintain records of important activities performed within projects.

Activity records may include:

- Project creation
- Project Lead assignment
- Outcome creation
- User joined an outcome
- Feature or task updates
- Task completion
- Output submission
- Revision request
- Output review
- Outcome acceptance
- Dependency resolution
- Project status changes
- Schedule changes
- Administrative changes

Each activity record should identify the responsible user, action performed, related object, and date and time.

Accepted Outcome Membership and associated credit shall remain traceable in historical records.

---

# 6. Business Rules

## BR-01 Organizational Roles

The system shall distinguish organization-level authorization from project-specific and outcome-specific responsibilities.

A user's organization-level role may be Administrator or Member.

Project Lead shall be treated as a project-specific responsibility.

Outcome Member shall be treated as an outcome-specific participation relationship.

---

## BR-02 Project Visibility

All active authorized Prometheus users shall be able to view all projects and project outcomes.

Viewing a project or outcome shall not automatically grant Project Lead authority or Outcome Membership.

---

## BR-03 Project Creation

Any active authorized Prometheus user may create a project.

The creator may assign themselves or another active authorized user as Project Lead.

The project creator and Project Lead shall be stored as separate concepts.

---

## BR-04 Project Participation

Prometheus shall not require a manually assigned project-participant role.

A user shall be considered to participate in a project when the user is an Outcome Member of at least one outcome in that project.

A user may participate in multiple projects simultaneously through Outcome Membership.

---

## BR-05 Outcome Membership

Any active authorized Prometheus user may join an outcome that is available for participation.

Joining an outcome shall not require Project Lead approval.

Joining an available outcome shall create Outcome Membership for that user and outcome.

Outcome Membership shall grant work permissions only for the joined outcome.

Outcome Membership shall not grant Project Lead or Administrator authority.

Accepted outcomes shall not accept new Outcome Members.

---

## BR-06 Outcome Acceptance and Credit

An outcome shall only be considered accepted after its required acceptance criteria and review requirements have been satisfied by the Project Lead.

When an outcome is accepted, all users who are Outcome Members at that time shall be considered part of the accepted outcome.

All such Outcome Members shall receive credit for the accepted outcome.

No minimum contribution threshold shall be required for Outcome Member credit.

The accepted Outcome Member list shall be preserved for history and reporting.

---

## BR-07 Project Lead Authority

Project Lead privileges shall apply only to projects where the user has been assigned as Project Lead.

Being an Administrator shall not automatically grant Project Lead authority.

An Administrator may become Project Lead when explicitly assigned as the lead of a project.

Being Project Lead shall not automatically grant administrative authority across the organization.

---

## BR-08 Schedule Ownership

Members shall primarily modify their own work schedules.

Shared schedules shall provide visibility into other members' availability without allowing unauthorized modification.

---

## BR-09 Registry Access

Only users with the Administrator organizational role shall be authorized to access the Registry.

Hiding the Registry from the user interface shall not be considered sufficient access control.

The backend shall verify Administrator authorization for all Registry operations and administrative API endpoints.

Members and Project Leads who are not Administrators shall not gain Registry access through their project responsibilities.

---

## BR-10 Authentication and Authorization Separation

Authentication shall establish account identity but shall not by itself grant access to Prometheus.

An authenticated identity must match an active authorized Prometheus member record before workspace access is granted.

A successful Google authentication without a matching authorized Prometheus member record shall result in denied workspace access.

---

## BR-11 Department Participation

A project may involve multiple departments.

An outcome may also be associated with one or more departments depending on the work required.

Department association shall support organization, filtering, and reporting and shall not by itself determine whether an authorized user may join an available outcome.

---

# 7. Non-Functional Requirements

The following requirements are proposed baseline implementation requirements and are not directly defined by the current prototype.

## NFR-01 Usability

The system shall provide a consistent and understandable user interface.

Common actions and information shall follow consistent navigation, terminology, and interaction patterns.

---

## NFR-02 Responsive Design

The system shall support modern desktop and laptop screen sizes.

Important workflows should remain usable on tablets and mobile devices where practical.

---

## NFR-03 Performance

Normal page navigation and user interactions should respond without noticeable delay under expected company usage.

Data-intensive reports may use loading indicators while information is being processed.

---

## NFR-04 Security

The system shall protect company, employee, project, and client-related information from unauthorized external or administrative access.

Authorization checks shall be performed for protected operations.

The frontend shall not be treated as the authority for important authorization rules.

Sensitive authentication information shall not be stored in plain text.

---

## NFR-05 Data Integrity

The system shall maintain consistent relationships between members, projects, Project Leads, Outcome Memberships, departments, outcomes, tasks, schedules, and outputs.

Deletion or deactivation of records shall not unintentionally corrupt related historical data.

Accepted Outcome Membership and credit records shall remain historically consistent.

---

## NFR-06 Reliability

The system shall prevent user actions from causing unexpected loss of project or operational data.

Critical operations should provide confirmation and appropriate error handling.

---

## NFR-07 Auditability

Important project, participation, review, scheduling, and administrative actions should be traceable to the user responsible for the action.

The system should preserve the identity of project creators, output submitters, Outcome Members, Project Leads, and administrative actors where relevant.

---

## NFR-08 Scalability

The system architecture should support growth in:

- Number of employees
- Number of departments
- Number of clients
- Number of projects
- Number of outcomes and Outcome Memberships
- Number of features and tasks
- Number of outputs and submission versions
- Number of work and activity records

---

## NFR-09 Maintainability

The system shall use a modular architecture that allows individual areas such as Projects, Outcomes, Schedule, Reports, Notifications, and Administration to evolve without requiring extensive changes to unrelated functionality.

Authorization logic should be implemented consistently so that organization role, Project Lead responsibility, and Outcome Membership are not conflated.

---

# 8. Data Requirements

The system shall maintain persistent records for at least the following data:

- Authentication-linked user accounts
- Member profiles
- Member authorization and account status
- Departments
- Organizational roles
- Projects
- Project creators
- Project Leads
- Project stages
- Outcomes
- Outcome Memberships
- Accepted Outcome Membership history and credit
- Acceptance criteria
- Features
- Tasks
- Output submissions
- Output submission history
- Reviews and feedback
- Project messages
- Work schedules
- Time In and Time Out sessions
- Notifications
- Activity records

The system shall not require a separate manually assigned project-participant record when project participation can be derived from Outcome Membership.

Relationships between these records shall be maintained consistently.

---

# 9. Assumptions and Constraints

The initial system is intended primarily for internal Prometheus employees and administrators who have been explicitly authorized as Prometheus members.

Projects managed through the platform are projects undertaken by Prometheus for its software development clients.

All active authorized Prometheus users may view all projects and outcomes within the internal workspace.

Any active authorized Prometheus user may create a project and may join any outcome that is available for participation.

Members may belong to a primary department while still joining outcomes associated with other departments.

The system shall treat projects as cross-functional workspaces rather than restricting participation to a single department.

Project Lead responsibilities shall be independent from the user's organizational role.

Outcome Membership shall be independent from organizational role and department unless a future explicit access rule is introduced.

The system shall centralize operational information but does not necessarily replace specialized development tools such as source-code repositories, IDEs, design applications, or deployment platforms.

Integrations with external development services may be introduced in future versions.

---

# 10. System Success Criteria

The system shall be considered successful when Prometheus can use one platform to determine:

- What projects currently exist.
- What stage each project is in.
- Who created each project.
- Who leads each project.
- Which projects each user leads.
- Which projects each user participates in through Outcome Membership.
- Which departments are associated with projects and outcomes.
- What outcomes must be completed.
- Who has joined each outcome.
- Which users are Outcome Members of accepted outcomes.
- Which members receive credit for accepted outcomes.
- What features and tasks are being worked on.
- What work has been completed.
- What outputs are awaiting review.
- What revisions have been requested.
- Which outcomes have been accepted.
- Which items require management attention.
- Who is currently working.
- When members are scheduled to work.
- How many hours members actually worked.
- Whether scheduled commitments are being fulfilled.
- How workloads and participation are distributed across departments and members.
- What major activities and changes have occurred within company projects.
- Which users are authorized to access the Prometheus workspace.

The overall objective of the Prometheus Centralized Workflow Management System is to establish a single, reliable source of truth for project delivery and internal operations so that Prometheus can coordinate software development projects more efficiently, maintain clear accountability, support open internal participation, preserve accepted outcome credit, and obtain better visibility into the work required to deliver software successfully to its clients.