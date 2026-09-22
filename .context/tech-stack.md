# Prometheus Tech Stack

## 1. Overview

Prometheus will be implemented as a single-deployment web application for internal company operations, project management, scheduling, time tracking, output review, notifications, and administration.

The system will use a React-based single-page application for the frontend, a NestJS backend for business logic and API handling, Supabase PostgreSQL for persistent data, Supabase Auth for authentication, Brevo for member invitation emails, and Vercel for deployment.

The implementation should use the Software Requirements Specification as the source of truth for functional requirements, `user-flows.md` as the canonical behavioral and access-control reference, Figma as the source of truth for visual design, and `finalmodel.html` as the current prototype and interaction reference.

When these references disagree, the conflict should be resolved explicitly before implementation.

---

## 2. Final Technology Stack

| Area | Technology | Purpose |
| --- | --- | --- |
| Primary Language | TypeScript | Shared language across frontend and backend |
| Frontend | React | Builds the user interface |
| Build Tool | Vite | Local development and production build pipeline |
| Routing | React Router | Client-side SPA navigation |
| Server Data | TanStack Query | API fetching, caching, mutations, and refetching |
| Shared UI State | Zustand | Shared temporary frontend state |
| Forms | React Hook Form | Form state, submission, and field management |
| Validation | Zod | Runtime validation and shared TypeScript schemas |
| CSS Framework | Tailwind CSS | Primary styling framework |
| Design Tokens | CSS Variables | Prometheus colors, spacing, typography, radii, and effects |
| Custom Styling | CSS | Complex layouts, schedule interactions, liquid glass effects, and special animations |
| Backend | NestJS | REST API, authorization, and business logic |
| API Style | REST | Communication between React and NestJS |
| ORM | Prisma | Type-safe PostgreSQL access and database migrations |
| Database | Supabase PostgreSQL | Primary relational database |
| Authentication | Supabase Auth | Authentication, sessions, and account identity |
| Google Sign-In | Google OAuth Client through Supabase Auth | Google account authentication |
| File Storage | Supabase Storage | Profile images and project/output attachments |
| Realtime | Supabase Realtime | Chat, presence, and live notifications where useful |
| Email | Brevo Transactional Email API | Member invitation and account setup emails |
| Unit Testing | Vitest | Unit and utility testing |
| Component Testing | React Testing Library | React component behavior testing |
| End-to-End Testing | Playwright | Full user workflow testing |
| Package Manager | pnpm | Dependency management |
| Source Control | GitHub | Repository and version control |
| Continuous Integration | GitHub Actions | Linting, type checking, tests, and build validation |
| Deployment | Vercel | Initial production deployment |

---

## 3. High-Level Architecture

```text
                         Google OAuth
                              |
                              v
                       Supabase Auth
                              |
                              | JWT
                              v

+---------------------------------------------------+
|                     VERCEL                        |
|                                                   |
|  React + TypeScript + Vite                        |
|                                                   |
|  React Router                                     |
|  TanStack Query                                   |
|  Zustand                                          |
|  React Hook Form                                  |
|  Zod                                              |
|  Tailwind CSS                                     |
|                                                   |
|                      |                            |
|                      | /api/*                     |
|                      v                            |
|                    NestJS                         |
|                      |                            |
+----------------------|----------------------------+
                       |
           +-----------+------------+
           |           |            |
           v           v            v
       Supabase      Brevo       Supabase
       PostgreSQL    Email       Storage
           |
           v
         Prisma

           +

     Supabase Realtime
     Chat
     Presence
     Notifications
```

Authentication identifies the account.

NestJS determines whether that identity is an authorized Prometheus member and evaluates all protected business rules.

The frontend may hide or disable unavailable controls, but it must not be treated as the authority for access control.

---

## 4. Frontend

### 4.1 React

React will be used to build the Prometheus user interface.

The current Figma interface will be implemented as reusable React components, using `finalmodel.html` only for interaction and workflow details not fully expressed by the target Figma frame.

Primary frontend areas include:

- Home dashboard
- Projects
- Project workspace
- Project member access management
- Project stages
- Outcomes
- Outcome Membership
- Features and tasks
- Shared outcome submissions and review
- Schedule
- Shifts and work sessions
- Team
- VisiWork
- Reports & Analytics
- Notifications
- Registry
- Profile and account interface

### 4.2 TypeScript

TypeScript will be used throughout the frontend and backend.

Using one language across the system reduces duplicated data definitions and makes frontend-to-backend integration easier to maintain.

### 4.3 Vite

Vite will provide the frontend development server and production build pipeline.

Prometheus will remain a client-side single-page application, so normal page navigation will not require server-side rendering.

### 4.4 React Router

React Router will handle SPA navigation.

Example routes may include:

```text
/
/projects
/projects/:projectId
/projects/:projectId/outcomes/:outcomeId
/projects/:projectId/chat
/visiwork
/schedule
/team
/reports
/notifications
/registry
/profile
```

The `/registry` route must require the Administrator organization role.

### 4.5 TanStack Query

TanStack Query will manage server data in the React application.

It will be used for fetching, caching, updating, invalidating, and refetching server-managed data such as:

- Projects
- Project details
- Project Member access levels
- Outcomes
- Outcome Memberships
- Shared outcome submission history
- Tasks
- Members
- Departments
- Schedules
- Work sessions
- Notifications
- Reports

TanStack Query should be used for server-managed state rather than duplicating persistent business data in frontend-only stores.

### 4.6 Zustand

Zustand will manage shared frontend-only state.

Examples include:

- Mobile navigation open state
- Open drawer
- Open modal
- Selected filters
- Temporary board scope
- Temporary schedule view

Local component state should still use normal React state when global sharing is unnecessary.

### 4.7 React Hook Form

React Hook Form will manage structured forms such as:

- Add Member
- Create Project
- Create Outcome
- Add Feature
- Add Task
- Edit Profile
- Configure Schedule
- Submit Output

### 4.8 Zod

Zod will define and validate data schemas.

Zod schemas should be reusable between frontend and backend where practical.

Frontend validation improves user experience, while backend validation remains mandatory because the server must not trust browser input.

### 4.9 Styling

Tailwind CSS will handle common layout, spacing, typography, cards, forms, buttons, badges, tabs, and responsive behavior.

Prometheus-specific design tokens will remain centralized through CSS variables.

Custom CSS will remain appropriate for complex schedule layouts, liquid glass effects, advanced animations, and interactions that are awkward to express through utility classes.

---

## 5. Backend

### 5.1 NestJS

NestJS will be responsible for:

- REST endpoints
- Authentication verification
- Workspace authorization
- Registry authorization
- Project permissions
- Project Member access levels
- Outcome Membership rules
- Project and outcome state transitions
- Shared submission history
- Input validation
- Database operations
- Invitation handling
- Reporting logic

The frontend must not be the authority for important business rules.

Current business rules that belong in NestJS include:

- Only active authorized Prometheus members may enter the workspace.
- Only Administrators may access Registry operations.
- Administrator status does not automatically grant project-level authority.
- Project creation is available to any active authorized user.
- Project creation itself grants no continuing special authority to the creator.
- Project Lead authority applies only to projects the user leads.
- Project Membership is derived from Outcome Membership.
- Project Members default to `CAN_VIEW`.
- Only the Project Lead may grant or revoke `CAN_EDIT` for Project Members.
- Project Leads and Project Members with `CAN_EDIT` may change project status.
- A project may be marked `DONE` without every outcome being accepted.
- A project that remains `DONE` for 14 days becomes `ARCHIVED`.
- Any active authorized user may join a locked outcome or an outcome that is `FOR_REVIEW` or `NEEDS_REVISION`.
- Outcome Membership is permanent once created.
- Outcome Members cannot leave and Project Leads cannot remove them.
- Each outcome has one shared submission history.
- Multiple submissions may be `FOR_REVIEW` at the same time.
- Outcome Members may continue submitting while the outcome is not accepted and submission is not blocked by dependency rules.
- Only the Project Lead may accept or reopen an outcome.
- Reopening preserves Outcome Membership, submission history, and acceptance history.
- Output review and acceptance must be enforced by the backend.

### 5.2 REST API

Prometheus will use REST for frontend-to-backend communication.

Exact endpoint naming will be finalized with the data model, but the API will need operations equivalent to:

```text
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PATCH  /api/projects/:id
PATCH  /api/projects/:id/status

GET    /api/projects/:id/members
PATCH  /api/projects/:id/members/:memberId/access

GET    /api/projects/:id/outcomes
POST   /api/projects/:id/outcomes
GET    /api/outcomes/:id
POST   /api/outcomes/:id/join
POST   /api/outcomes/:id/submissions
GET    /api/outcomes/:id/submissions
POST   /api/outcomes/:id/request-revision
POST   /api/outcomes/:id/accept
POST   /api/outcomes/:id/reopen

PATCH  /api/tasks/:id

GET    /api/schedule
PATCH  /api/schedule

POST   /api/work-sessions/time-in
POST   /api/work-sessions/time-out

GET    /api/notifications
```

Project Member access, outcome joining, submission creation, acceptance, reopening, and Registry actions must all be rechecked by the backend on every protected request.

---

## 6. Database and ORM

### 6.1 Supabase PostgreSQL

Supabase PostgreSQL will be the primary persistent database.

Prometheus has strongly relational data, so PostgreSQL is preferred over a document database.

The final relational schema will be defined in `data-model.md` before the Prisma schema is finalized.

Core entities currently expected include:

- Members
- Departments
- Projects
- Project Member access records
- Project stages
- Outcomes
- Outcome Memberships
- Outcome dependencies
- Acceptance criteria
- Features
- Tasks
- Outcome submissions
- Submission reviews or review events
- Outcome acceptance/reopen history
- Schedules
- Work sessions
- Notifications
- Messages
- Activity logs

The previous `Outcome assignments` model is no longer canonical.

Participation is based on Outcome Membership created when a user joins an outcome.

The database must preserve historical Outcome Membership and submission/acceptance history rather than replacing those records with only the current state.

### 6.2 Prisma

Prisma will be used between NestJS and PostgreSQL.

Prisma will provide:

- Type-safe database queries
- Relational data access
- Schema definition
- Database migrations
- Generated TypeScript database types

The normal data path will be:

```text
React
  |
  v
NestJS
  |
  v
Prisma
  |
  v
Supabase PostgreSQL
```

---

## 7. Authentication and Authorization

### 7.1 Supabase Auth

Supabase Auth will manage user authentication and sessions.

Supported authentication methods for the initial implementation will include:

- Email and password
- Continue with Google

### 7.2 Google OAuth

Google sign-in will use a Google OAuth Client configured through Supabase Auth.

A Google account does not automatically grant Prometheus access.

For invitation account setup, only an invited address whose domain is exactly `gmail.com` is routed to the Google setup path.

Invited addresses on all other domains are routed to email/password setup instead.

Under this initial setup policy, Google Workspace addresses on custom domains therefore use email/password account setup.

The domain check controls which setup interface is offered and must not be treated as proof of identity or workspace authorization.

After Google authentication, Prometheus must use the verified email returned by Google and the stable Supabase identity when resolving the authorized Member record.

The authenticated Google email must match an authorized Prometheus member record.

### 7.3 Prometheus Membership

Authentication and Prometheus membership are separate concepts.

An Administrator must authorize a member before the account is allowed into Prometheus.

An invited member record may initially contain:

```text
id
email
name
department_id
position
workspace_role
status = INVITED
auth_user_id = NULL
```

After successful authentication:

```text
status = ACTIVE
auth_user_id = authenticated Supabase user ID
```

If an authenticated account does not match an active authorized Prometheus member, access must be denied.

---

## 8. Roles and Permissions

Prometheus must keep organization role, project authority, project access, and outcome participation separate.

### Organization Role

```text
ADMINISTRATOR
MEMBER
```

The organization role controls workspace-level capabilities such as Registry access.

### Project Lead

```text
project.lead_user_id
```

Project Lead is a relationship to one project, not an organization role.

An Administrator has no automatic Project Lead authority.

### Project Member Access

```text
CAN_VIEW
CAN_EDIT
```

A user becomes a Project Member by belonging to at least one outcome in the project.

Project Members default to `CAN_VIEW`.

Only the Project Lead may change a Project Member's project access to or from `CAN_EDIT`.

`CAN_EDIT` does not equal Project Lead.

### Outcome Membership

```text
OUTCOME_MEMBER
```

Outcome Membership is created when an active authorized user joins an outcome.

Outcome Membership is permanent and specific to that outcome.

It grants work and submission rights within that outcome according to its current workflow state.

A single member may therefore simultaneously be:

```text
Organization Role: ADMINISTRATOR

Project A: PROJECT LEAD
Project B: PROJECT MEMBER - CAN_VIEW
Project C: PROJECT MEMBER - CAN_EDIT

Outcome A1: OUTCOME MEMBER
Outcome B2: OUTCOME MEMBER
```

These relationships must not be collapsed into a single global role field.

---

## 9. Member Invitation and Email

Brevo will initially be used for member invitation and account setup email.

The invitation flow will be:

```text
Administrator adds member
        |
        v
NestJS creates authorized member record
status = INVITED
        |
        v
Brevo sends invitation email
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
NestJS checks authenticated identity
against authorized membership
                     |
              +------+------+
              |             |
             Yes            No
              |             |
              v             v
        Link account     Deny access
        status ACTIVE
```

The account-setup page must not show both authentication methods for the same invitation.

The invited email determines the setup path, while Supabase authentication and NestJS membership checks remain the authority for identity and workspace access.

Brevo credentials must never be exposed to frontend code.

---

## 10. Realtime

Supabase Realtime will be used only where realtime behavior provides clear value.

Initial candidates include:

- Project chat
- Presence
- Working-now indicators
- Live notification updates

Persistent business state such as Outcome Membership, project access, submissions, project status, and work sessions must remain stored in PostgreSQL and must not rely on ephemeral presence state.

---

## 11. File Storage

Supabase Storage will be used for files that should not be stored directly inside PostgreSQL.

Examples include:

- Profile pictures
- Project attachments
- Outcome submission attachments
- Screenshots
- PDFs
- Documents
- Exported design files

PostgreSQL should store file metadata, ownership/context references, and storage object references.

---

## 12. Testing

### Vitest

Vitest will be used for unit and utility/business-rule logic.

### React Testing Library

React Testing Library will test important React component behavior.

### Playwright

Playwright will be the primary end-to-end testing tool.

Important Prometheus workflows should be verified from the end-user perspective.

A representative project workflow is:

```text
Administrator adds member
        |
Member activates account
        |
Authorized user creates project
        |
Project Lead creates stage and outcome
        |
Member joins outcome
        |
Member becomes Outcome Member and Project Member
        |
Project Lead optionally grants CAN_EDIT
        |
Outcome Members submit multiple entries
        |
Project Lead reviews shared submission history
        |
Project Lead requests revision or accepts outcome
        |
Project Lead may later reopen outcome
```

A separate test should verify that a Project Member with `CAN_EDIT` may change project status but may not perform Project Lead-only operations.

A separate test should verify that an Administrator who is not the Project Lead receives no project-level override.

A separate test should verify automatic transition from `DONE` to `ARCHIVED` after 14 days.

The schedule workflow remains:

```text
Member configures schedule
        |
Member records Time In
        |
Member records Time Out
        |
Shift view shows actual work session
        |
Reports reflect updated work data
```

---

## 13. Deployment

Prometheus will initially use one Vercel project.

The frontend and backend will remain architecturally separate in the source code but will ship as one deployment.

The same application origin can serve both UI routes and API routes.

This keeps the initial deployment simple and avoids unnecessary frontend-to-backend CORS configuration.

The architecture should remain modular enough that the NestJS API can be separated into its own deployment later if necessary.

---

## 14. Suggested Repository Structure

```text
prometheus/
|
├── src/
│   ├── app/
│   ├── routes/
│   ├── features/
│   │   ├── home/
│   │   ├── projects/
│   │   ├── outcomes/
│   │   ├── submissions/
│   │   ├── schedule/
│   │   ├── team/
│   │   ├── visiwork/
│   │   ├── reports/
│   │   ├── notifications/
│   │   └── registry/
│   ├── components/
│   │   ├── ui/
│   │   └── layout/
│   ├── hooks/
│   └── lib/
│
├── server/
│   ├── auth/
│   ├── members/
│   ├── departments/
│   ├── projects/
│   ├── outcomes/
│   ├── submissions/
│   ├── tasks/
│   ├── schedules/
│   ├── work-sessions/
│   ├── notifications/
│   ├── email/
│   └── reports/
│
├── api/
│   └── index.ts
│
├── shared/
│   └── contracts/
│
├── prisma/
│   └── schema.prisma
│
├── public/
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── vercel.json
```

---

## 15. System Design References

### Software Requirements Specification

The SRS defines the functional requirements, business rules, permissions, workflow behavior, and system constraints.

### `user-flows.md`

`user-flows.md` is the canonical behavioral reference for authentication, project access, Project Member permissions, Outcome Membership, submission behavior, and lifecycle transitions.

### Figma

Figma defines current visual design, layout, navigation placement, typography, colors, spacing, component appearance, and responsive design intent.

### `finalmodel.html`

The prototype remains an interaction and workflow reference for behavior not fully expressed by the target Figma frame, including project boards, stages, outcomes, submission review, modals and drawers, schedule interactions, and workspace behavior.

Prototype-only behavior must not override the SRS or `user-flows.md`.

---

## 16. Final Stack Summary

```text
FRONTEND
React
TypeScript
Vite
React Router
TanStack Query
Zustand
React Hook Form
Zod
Tailwind CSS
CSS Variables
Custom CSS where required

BACKEND
NestJS
TypeScript
REST API

DATABASE
Supabase PostgreSQL

ORM
Prisma

AUTHENTICATION
Supabase Auth
Google OAuth Client
Email/password

STORAGE
Supabase Storage

REALTIME
Supabase Realtime

EMAIL
Brevo Transactional Email API
Member invitation/account setup

TESTING
Vitest
React Testing Library
Playwright

INFRASTRUCTURE
GitHub
GitHub Actions
pnpm

DEPLOYMENT
One Vercel project initially
```

---

## 17. Final Architecture Principle

Prometheus should remain modular internally even though the initial version is deployed as one application.

Persistent business state belongs in PostgreSQL.

Authorization and workflow rules belong in NestJS.

The frontend should render the permissions returned by the system rather than inventing them independently.

The relational structure described in the future `data-model.md` should be agreed before the Prisma schema is treated as stable.
