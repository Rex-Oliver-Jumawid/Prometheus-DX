# Prometheus Tech Stack

## 1. Overview

Prometheus will be implemented as a single-deployment web application for internal company operations, project management, scheduling, time tracking, output review, notifications, and administration.

The system will use a React-based single-page application for the frontend, a NestJS backend for business logic and API handling, Supabase PostgreSQL for persistent data, Supabase Auth for authentication, Brevo for member invitation emails, and Vercel for deployment.

The implementation should use the Software Requirements Specification as the source of truth for system behavior, the Figma design as the source of truth for visual design, and `finalmodel.html` as the current interaction and workflow reference.

---

## 2. Final Technology Stack

| Area | Technology | Purpose |
| --- | --- | --- |
| Primary Language | TypeScript | Shared language across frontend and backend |
| Frontend | React | Builds the user interface |
| Build Tool | Vite | Fast local development and production builds |
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
| File Storage | Supabase Storage | Profile images and future project attachments |
| Realtime | Supabase Realtime | Chat, presence, and live notifications |
| Email | Brevo Transactional Email API | Member invitation and account setup emails |
| Unit Testing | Vitest | Unit and utility testing |
| Component Testing | React Testing Library | React component behavior testing |
| End-to-End Testing | Playwright | Full user workflow testing |
| Package Manager | pnpm | Dependency management |
| Source Control | GitHub | Repository and version control |
| Continuous Integration | GitHub Actions | Linting, type checking, tests, and build validation |
| Deployment | Vercel | Single production deployment |

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

---

## 4. Frontend

### 4.1 React

React will be used to build the Prometheus user interface.

The existing `finalmodel.html` prototype will be converted into reusable React components instead of maintaining one large HTML, CSS, and JavaScript file.

Primary frontend areas include:

- Home dashboard
- Projects
- Project workspace
- Project stages
- Outcomes
- Features and tasks
- Outputs and review
- Schedule
- Shifts and work sessions
- Team
- Notifications
- Reports and analytics
- Admin registry
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
/projects/:projectId/outcomes
/projects/:projectId/outcomes/:outcomeId
/projects/:projectId/outputs
/projects/:projectId/chat
/schedule
/team
/notifications
/reports
/admin
/profile
```

### 4.5 TanStack Query

TanStack Query will manage server data in the React application.

It will be used for fetching, caching, updating, invalidating, and refetching data from the NestJS API.

Examples include:

- Projects
- Project details
- Outcomes
- Tasks
- Members
- Departments
- Schedules
- Work sessions
- Notifications
- Reports

TanStack Query should be used for server-managed data rather than temporary UI state.

### 4.6 Zustand

Zustand will manage shared frontend-only state.

Examples include:

- Sidebar collapsed state
- Open drawer
- Open modal
- Selected filters
- Temporary board scope
- Temporary schedule view
- Other shared interface state

Local component state should still use normal React state when global sharing is unnecessary.

### 4.7 React Hook Form

React Hook Form will manage structured forms.

Examples include:

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

Zod schemas should be reusable between the frontend and backend where practical.

Frontend validation improves the user experience, while backend validation remains mandatory because the server must not trust browser input.

### 4.9 Tailwind CSS

Tailwind CSS will be the main CSS framework.

It will handle:

- Layout
- Spacing
- Typography
- Responsive behavior
- Cards
- Forms
- Buttons
- Badges
- Tabs
- Common component styling

Prometheus-specific design tokens will remain centralized through CSS variables.

Custom CSS will still be used where Tailwind becomes awkward, especially for:

- Complex schedule layouts
- Dragging and resizing
- Liquid glass effects
- Advanced animations
- Special interaction states

---

## 5. Backend

### 5.1 NestJS

NestJS will be the backend framework.

NestJS will be responsible for:

- REST endpoints
- Authentication verification
- Authorization
- Project permissions
- Business rules
- Workflow transitions
- Input validation
- Database operations
- Invitation handling
- Reporting logic

The frontend must not be the authority for important business rules.

Examples of business rules that belong in NestJS include:

- Only authorized users can access Prometheus.
- Only administrators can manage company members and departments.
- Project Lead privileges apply only to projects the member leads.
- A prerequisite can lock a dependent outcome.
- Accepting or resolving a prerequisite can unlock another outcome.
- Completing tasks updates outcome progress.
- Members should not modify another member's schedule unless specifically authorized.
- Output review and acceptance must be enforced by the backend.

### 5.2 REST API

Prometheus will use REST for frontend-to-backend communication.

Example endpoints may include:

```text
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PATCH  /api/projects/:id

GET    /api/projects/:id/outcomes
POST   /api/projects/:id/outcomes

PATCH  /api/tasks/:id

POST   /api/outcomes/:id/outputs
POST   /api/outputs/:id/submit
POST   /api/outputs/:id/accept
POST   /api/outputs/:id/request-revision

GET    /api/schedule
PATCH  /api/schedule

POST   /api/work-sessions/time-in
POST   /api/work-sessions/time-out

GET    /api/notifications
```

---

## 6. Database and ORM

### 6.1 Supabase PostgreSQL

Supabase PostgreSQL will be the primary persistent database.

Prometheus has strongly relational data, so PostgreSQL is preferred over a document database.

Core entities are expected to include:

- Users
- Members
- Departments
- Projects
- Project members
- Project leads
- Stages
- Outcomes
- Outcome assignments
- Acceptance criteria
- Features
- Tasks
- Outputs
- Output versions
- Reviews
- Schedules
- Work sessions
- Notifications
- Messages
- Activity logs

### 6.2 Prisma

Prisma will be used between NestJS and PostgreSQL.

Prisma is not the database.

Its purpose is to provide:

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

The authenticated Google email must match an authorized Prometheus member record.

The system should use the verified email returned by Google rather than checking whether an address ends in `@gmail.com`.

This also allows Google Workspace accounts such as `employee@company.com` to authenticate through Google.

### 7.3 Prometheus Membership

Authentication and Prometheus membership are separate concepts.

An administrator must authorize a member before the account is allowed into Prometheus.

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

If an authenticated account does not match an authorized Prometheus member, access should be denied.

---

## 8. Roles and Permissions

Prometheus must keep organization roles, project relationships, and work ownership separate.

### Organization Role

```text
ADMINISTRATOR
MEMBER
```

### Project Relationship

```text
LEAD
PARTICIPANT
```

### Work Ownership

```text
DEPARTMENT
ASSIGNED MEMBER OR MEMBERS
```

Project Lead must not be implemented as a permanent organization-wide user role.

A member may simultaneously be:

```text
Organization Role: Member

Project A: Lead
Project B: Participant
Project C: Participant
```

---

## 9. Member Invitation and Email

Brevo will initially be used only for member invitation and account setup email.

Prometheus does not currently require email notifications for project events.

The invitation flow will be:

```text
Administrator adds member
        |
        v
NestJS creates member record
status = INVITED
        |
        v
Brevo sends invitation email
        |
        v
User opens Prometheus
        |
        +---------------------+
        |                     |
        v                     v
Continue with Google     Email/password setup
        |                     |
        +----------+----------+
                   |
                   v
             Supabase Auth
                   |
                   v
NestJS checks authenticated email
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

Brevo credentials must never be exposed to frontend code.

---

## 10. Realtime

Supabase Realtime will be used only where realtime behavior provides clear value.

Initial candidates include:

- Project chat
- Presence
- Working-now indicators
- Live notification updates

Persistent work sessions must remain stored in PostgreSQL and must not rely on presence state.

Presence answers whether a user is currently online or active.

Work sessions record actual Time In and Time Out activity.

---

## 11. File Storage

Supabase Storage will be used for files that should not be stored directly inside PostgreSQL.

Examples include:

- Profile pictures
- Project attachments
- Output attachments
- Screenshots
- PDFs
- Documents
- Exported design files

PostgreSQL should store file metadata and storage references.

---

## 12. Testing

### Vitest

Vitest will be used for unit tests and utility logic.

### React Testing Library

React Testing Library will test important React component behavior.

### Playwright

Playwright will be the primary end-to-end testing tool.

Important Prometheus workflows should be verified from the end-user perspective.

Example project workflow:

```text
Admin adds member
        |
Member activates account
        |
Lead creates project
        |
Lead creates stage
        |
Lead creates outcome
        |
Member receives assignment
        |
Member completes tasks
        |
Member submits output
        |
Lead reviews output
        |
Lead requests revision or accepts
        |
Dependent outcome unlocks
```

Example schedule workflow:

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

Prometheus will use one Vercel project.

The frontend and backend will remain architecturally separate in the source code but will ship as one deployment.

The same application origin can serve both UI routes and API routes.

Example:

```text
https://prometheus.example.com/projects
https://prometheus.example.com/schedule

https://prometheus.example.com/api/projects
https://prometheus.example.com/api/members
```

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
│   |
│   ├── features/
│   │   ├── home/
│   │   ├── projects/
│   │   ├── outcomes/
│   │   ├── outputs/
│   │   ├── schedule/
│   │   ├── team/
│   │   ├── notifications/
│   │   ├── reports/
│   │   └── admin/
│   |
│   ├── components/
│   │   ├── ui/
│   │   └── layout/
│   |
│   ├── hooks/
│   └── lib/
│
├── server/
│   ├── auth/
│   ├── members/
│   ├── departments/
│   ├── projects/
│   ├── outcomes/
│   ├── tasks/
│   ├── outputs/
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

The following references should guide implementation.

### Software Requirements Specification

The SRS defines:

- Functional requirements
- Business rules
- Permissions
- User roles
- Workflow behavior
- System constraints

The SRS is the primary reference for what the system must do.

### Figma

Prometheus Figma design:

https://www.figma.com/design/8zgQ4pcWtku7rSWzjlP9K9/Prometheus?node-id=19-12077&t=WEpRDccEfW56hE0W-1

Figma defines:

- Visual design
- Layout
- Typography
- Colors
- Spacing
- Component appearance
- Responsive design intent
- UI interaction design

### `finalmodel.html`

The existing prototype defines the current interaction model and implementation reference for:

- Navigation
- Project boards
- Stages
- Outcomes
- Output review
- Modals and drawers
- Schedule interactions
- Project workspace behavior
- Current prototype workflows

When the three references disagree, the conflict should be resolved explicitly before implementation rather than silently choosing one source.

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
Member invitation/account setup only

TESTING
Vitest
React Testing Library
Playwright

INFRASTRUCTURE
GitHub
GitHub Actions
pnpm

DEPLOYMENT
One Vercel project
```

## 17. Final Architecture Principle

The finalized Prometheus architecture is:

> React, TypeScript, Vite, and Tailwind CSS for the frontend; NestJS for backend business logic; Prisma and Supabase PostgreSQL for persistence; Supabase Auth with Google OAuth for authentication; Supabase Storage and Realtime for supporting services; Brevo for member invitation emails; and one Vercel deployment.

Prometheus should remain modular internally even though the initial version is deployed as one application.
