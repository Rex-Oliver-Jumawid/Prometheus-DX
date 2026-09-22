# Prometheus Implementation Phases

## Purpose

This document defines the recommended implementation order for Prometheus.

The phases are ordered by dependency rather than navbar position.

Each phase should leave the system in a usable and testable state.

Do not move to the next phase until the required manual acceptance tests for the current phase pass.

## Implementation Status

This document defines phase scope, ordering, dependencies, and exit criteria.

Live implementation status is tracked in `.docs/phases/README.md`, with detailed evidence in the matching phase journal under `.docs/phases/`.

Do not infer that a phase is complete merely because some or all of its planned code exists.

## Canonical Project Context

Use these repository files as the source of truth while implementing:

- `.context/Software Requirements Specification - Prometheus Centralized Workflow Management System.md`
- `.context/user-flows.md`
- `.context/tech-stack.md`
- the current Prometheus Figma file as the source of truth for UI layout and visual design
- `.model/finalmodel.html` as an interaction and workflow reference only
- `.model/login-page.html` as the login interaction reference

The SRS is the primary source of truth for functional requirements.

`user-flows.md` is the source of truth for canonical user flows and access-control behavior.

`tech-stack.md` is the source of truth for implementation architecture.

The current Prometheus Figma file is the source of truth for UI layout, visual composition, navigation placement, and visual design.

`finalmodel.html` and `login-page.html` are interaction references and must not override current Figma layout or production authorization rules.

## Phase Completion Rule

A phase is complete only when:

1. The main happy-path flow passes manually.
2. Relevant permission and access-control cases pass.
3. Invalid-input and important edge cases pass.
4. Refresh and persistence behavior work.
5. Direct URL access behaves correctly.
6. Empty, loading, and error states are usable.
7. There are no unexplained browser console errors.
8. There are no obvious visual defects at supported viewport sizes.
9. Previous completed phases still pass a smoke regression.
10. The phase's main end-to-end workflow passes from start to finish.

## Phase 0 - Foundation

### Goal

Create the production application foundation before building product screens.

### Required scope

- React + TypeScript + Vite frontend
- React Router
- Tailwind CSS and design tokens
- NestJS backend
- Prisma
- Supabase PostgreSQL
- Supabase Auth integration foundation
- Shared contracts and validation
- TanStack Query
- React Hook Form
- Zod
- Playwright test setup
- Lint, typecheck, unit test, build, and E2E commands
- Environment configuration
- Error handling foundation

### Pages required

No full business page is required yet.

A minimal development shell or temporary health page is acceptable.

### Exit milestone

The browser can call the backend.

The backend can access the database.

Migrations run correctly.

Production build succeeds.

The application can be tested end to end.

### Manual test file

`phase-00-foundation-tests.md`

---

## Phase 1 - Authentication and Application Shell

### Goal

Establish real authenticated identity, Prometheus workspace authorization, and the reusable application layout.

### Required pages and interfaces

- `/login`
- `/access-denied`
- Protected application shell
- Figma-defined sidebar shell
- Sidebar primary navigation
- Sidebar utility navigation
- Notifications utility destination placeholder in the sidebar
- Profile/account control at the bottom of the sidebar
- Profile drawer or account interface
- Sign out
- Protected route handling

### Core rule

Authentication and Prometheus authorization are separate.

A successful Supabase authentication must not automatically grant workspace access.

The authenticated identity must match an active authorized Prometheus member.

### Exit milestone

An authorized user can sign in and enter Prometheus.

An unauthorized authenticated user is denied.

A signed-out user cannot open protected routes.

The current user comes from authentication rather than prototype state.

### Manual test file

`phase-01-auth-shell-tests.md`

---

## Phase 2 - Registry

### Goal

Create the organization-level source of truth for departments, members, roles, access status, and authentication linkage.

### Required pages and interfaces

- `/registry`
- Members view
- Departments view
- Add Member modal or drawer
- Edit Member modal or drawer
- Department create/edit interface
- Member activation/deactivation controls
- Authentication status display

### Core rule

Only `ADMINISTRATOR` may access Registry.

Project Lead status does not grant Registry access.

Frontend visibility is not sufficient security.

Registry API endpoints must enforce Administrator authorization.

### Exit milestone

Administrators can manage organization data.

Members cannot access Registry through navigation, direct URL, or API.

### Manual test file

`phase-02-registry-tests.md`

---

## Phase 3 - Project Core

### Goal

Create project discovery, creation, ownership relationships, and the project overview.

### Required pages and interfaces

- `/projects`
- All Projects
- My Projects
- Leading
- Participating
- Create Project modal or drawer
- `/projects/:projectId`
- Project Overview
- Project status control
- Project Lead display
- Department associations

### Core rules

All active authorized Prometheus users may view all projects.

Any active authorized user may create a project.

Project creator and Project Lead are different concepts.

Project Lead is not an organization role.

Project creator receives no special authority merely because they created the project.

### Exit milestone

Users can create real projects, assign a lead, open projects, and see correct project visibility and status permissions.

### Manual test file

`phase-03-project-core-tests.md`

---

## Phase 4 - Project Workflow Structure

### Goal

Implement stages, outcomes, outcome membership, derived project membership, and project-member access.

### Required pages and interfaces

- Project Workspace within `/projects/:projectId`
- Stage UI
- Add/Edit Stage modal
- Outcome cards
- Add/Edit Outcome modal
- Outcome Details
- Join Outcome action
- Project Members view
- `CAN_VIEW` and `CAN_EDIT` management for Project Members

### Core rules

Only the Project Lead may create and manage stages and outcomes.

Any active authorized user may join a non-accepted outcome.

Outcome Membership is permanent.

Project Membership is derived from Outcome Membership.

Project Members default to `CAN_VIEW`.

Only the Project Lead may grant or revoke `CAN_EDIT`.

Administrator status does not override project-specific authority.

### Exit milestone

The permission model clearly distinguishes Administrator, Project Lead, Project Member, Outcome Member, and ordinary viewer.

### Manual test file

`phase-04-project-workflow-tests.md`

---

## Phase 5 - Outcome Work, Submission, Review, and Dependencies

### Goal

Complete the core Prometheus project-delivery loop.

### Required pages and interfaces

- Outcome work area
- Features
- Tasks
- Output submission
- Shared submission history
- Review interface
- Revision request flow
- Outcome acceptance
- Outcome reopening
- Dependency and lock states
- Acceptance history where required

### Core rules

Only Outcome Members may perform Outcome Member work.

Each outcome has one shared submission history.

Multiple submissions may be under review at the same time.

Only the Project Lead may perform Project Lead review actions.

Outcome acceptance is an outcome-level decision.

All current Outcome Members receive credit when the outcome is accepted.

Reopening preserves membership, submissions, and prior acceptance history.

### Exit milestone

A complete project workflow succeeds from project creation through outcome acceptance.

This phase is the first major Prometheus Core milestone.

### Manual test file

`phase-05-work-review-tests.md`

---

## Phase 6 - Schedule, Work Sessions, and Team

### Goal

Implement planned availability, actual work tracking, and team visibility without mixing these concepts.

### Required pages and interfaces

- `/schedule`
- Team Schedule view
- Shifts view
- Configure My Schedule
- Time In
- Time Out
- Weekly work history
- `/team`
- Member availability
- Working Now status
- Scheduled hours
- Actual worked hours

### Core rules

Schedule represents planned work.

Work Sessions represent actual Time In and Time Out activity.

Presence must not be used as a replacement for persistent work sessions.

Members primarily manage their own schedules and work sessions.

### Exit milestone

Planned schedule and actual work history are stored and displayed independently.

Team reflects real member schedule and work-session data.

### Manual test file

`phase-06-schedule-team-tests.md`

---

## Phase 7 - Notifications and Home

### Goal

Connect completed system events into actionable notifications and a real command-center dashboard.

### Required pages and interfaces

- `/notifications`
- Notifications page matching Figma node `11:2301`
- Read/unread states
- All and Unread filters
- Mark all as read
- Notification navigation
- Notifications sidebar utility entry with unread-count badge
- `/`
- Home page matching Figma node `189:3`
- My Project Summary
- Working Now
- Needs Attention
- Quick Access

### Core rule

Home should aggregate canonical data from existing modules rather than maintain duplicate state.

Notifications should be created from real system events.

The Phase 7 shell and page layout must follow the current Figma frames.

Notifications are accessed through the lower sidebar utility entry.

Do not add a separate global top-right notification bell or notification control unless a newer explicit product decision changes the layout.

### Exit milestone

The Home dashboard and notification inbox display real data generated by completed workflows.

### Manual test file

`phase-07-notifications-home-tests.md`

---

## Phase 8 - VisiWork and Reports & Analytics

### Goal

Deliver the separate VisiWork operational view and Reports & Analytics management reporting shown in the current Figma navigation.

### Required pages and interfaces

- VisiWork as its own primary-navigation destination
- `/visiwork` for the VisiWork operational view unless a newer route decision changes it
- Reports & Analytics as a separate primary-navigation destination
- A dedicated Reports & Analytics route that remains distinct from VisiWork
- Project progress
- Project health
- Outcome pipeline
- Department workload
- Member workload
- Team capacity
- Capacity used
- Scheduled versus actual work where supported by the reporting design
- Relevant filters
- Empty states

### Core rule

Every displayed metric must be derived from canonical system data.

Do not maintain a separate manually synchronized analytics state.

### Exit milestone

Management metrics can be reconciled with their underlying source records.

### Manual test file

`phase-08-visiwork-reporting-tests.md`

---

## Phase 9 - Collaboration, Realtime, and Attachments

### Goal

Add collaboration enhancements after the core authorization and workflow model is stable.

### Required pages and interfaces

- Project chat
- Realtime message updates
- Presence
- Live notification updates where useful
- Attachment upload and retrieval
- Attachment permissions
- Realtime reconnect behavior

### Core rules

Realtime state is supplemental.

Persistent project and work records remain stored in PostgreSQL.

Presence does not replace Time In and Time Out.

Chat permissions must follow the final approved product rules.

### Exit milestone

Realtime behavior enhances Prometheus without becoming a second source of truth.

### Manual test file

`phase-09-collaboration-tests.md`

---

# Recommended First Major Release Boundary

Phases 0 through 5 form the first major Prometheus Core milestone.

The following workflow should pass completely:

```text
Administrator creates or authorizes members
        |
        v
Member signs in
        |
        v
Member creates project
        |
        v
Project Lead creates stage
        |
        v
Project Lead creates outcome
        |
        v
Another member joins outcome
        |
        v
Outcome Member creates feature and tasks
        |
        v
Outcome Member completes work
        |
        v
Outcome Member submits output
        |
        v
Project Lead reviews
        |
        +-> Request Revision
        |
        +-> Accept Outcome
```

Do not consider Prometheus Core finished until this path works end to end with real authentication, database persistence, backend authorization, and browser-level manual verification.

# Regression Strategy

After every completed phase, rerun a smoke regression covering all previous phases.

At minimum:

```text
Sign in
-> protected navigation
-> role visibility
-> Registry authorization
-> Projects
-> project access
-> refresh
-> direct route access
-> sign out
```

After Phase 5, also rerun:

```text
Create Project
-> Create Stage
-> Create Outcome
-> Join Outcome
-> Create Task
-> Submit Output
-> Request Revision
-> Resubmit
-> Accept Outcome
```

This prevents later modules from silently breaking the Prometheus Core workflow.
