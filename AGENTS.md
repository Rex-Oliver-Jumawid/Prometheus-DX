# AGENTS.md

## Purpose

This file defines how coding agents should work inside the Prometheus-DX repository.

Prometheus-DX is the planning, prototype, and implementation repository for the Prometheus Centralized Workflow Management System.

The goal is not merely to make changes that work.

Changes should preserve product intent, authorization rules, architectural consistency, maintainability, visual quality, and the phased implementation strategy of the project.

---

# 1. Repository Context

Prometheus is an internal workflow management system covering:

- Organization membership and administration.
- Project creation and discovery.
- Project leadership.
- Project participation.
- Stages and outcomes.
- Outcome Membership.
- Features and tasks.
- Output submission and review.
- Scheduling.
- Work sessions.
- Notifications.
- Reporting.
- Collaboration.
- Realtime functionality.

The repository is transitioning from planning and interactive prototypes into production implementation.

Do not treat prototype code as production architecture.

---

# 2. Source of Truth

Before implementing behavior, understand which repository artifact owns that decision.

Use the following hierarchy.

## 2.1 Functional Requirements

`.context/Software Requirements Specification - Prometheus Centralized Workflow Management System.md`

This owns:

- Functional requirements.
- Business rules.
- Product requirements.
- System behavior.

The SRS is the primary source of truth for functional requirements.

## 2.2 User Flows and Access Control

`.context/user-flows.md`

This owns:

- Canonical user behavior.
- Authorization flows.
- Access-control expectations.
- Navigation behavior.
- Role-specific workflows.

Use this file when determining what a particular user should be able to see or do.

## 2.3 Data Model

`.context/data-model.md`

This owns:

- Persistent entities.
- Relationships.
- Database constraints.
- Historical records.
- Derived state.
- State relationships.

Do not invent persistent relationships that contradict this file.

## 2.4 Technical Architecture

`.context/tech-stack.md`

This owns:

- Application architecture.
- Technology choices.
- Frontend responsibilities.
- Backend responsibilities.
- Infrastructure decisions.
- Testing technology.

Do not replace the approved stack without an explicit architectural decision.

## 2.5 Implementation Order

`.context/phases.md`

This owns:

- Implementation phases.
- Phase boundaries.
- Dependencies.
- Required pages.
- Milestones.
- Completion criteria.

Do not implement the system based on navbar order.

Follow dependency order.

## 2.6 Figma

The canonical Prometheus UI design is maintained here:

https://www.figma.com/design/8zgQ4pcWtku7rSWzjlP9K9/Prometheus?node-id=19-12077&t=WEpRDccEfW56hE0W-1

Figma is the source of truth for:

- Layout.
- Spacing.
- Typography.
- Colors.
- Component appearance.
- Visual hierarchy.
- Icons.
- Responsive visual behavior.
- User-facing visual composition.

Inspect the relevant Figma design before implementing or substantially modifying user-facing UI.

Do not infer business rules, permissions, persistence behavior, or authorization from Figma alone.

If Figma disagrees with repository requirements about behavior, access, workflow, or data, the canonical repository requirements remain authoritative.

## 2.7 HTML Interaction Prototypes

`.model/finalmodel.html`

`.model/login-page.html`

These are:

- Interaction references.
- Workflow references.
- Prototype references.
- Secondary visual references where Figma does not provide enough information.

They are not production architecture.

They are not authorization mechanisms.

They are not persistence models.

They are not sources of backend business rules.

When Figma and an HTML prototype disagree visually, follow Figma unless a newer visual decision is explicitly documented.

When repository requirements and an HTML prototype disagree about behavior, follow the canonical repository requirements.

## 2.8 Manual Acceptance Tests

`.testcases/`

This owns the manual acceptance gates for each implementation phase.

Use the matching test-case file before considering a phase complete.

---

# 3. Conflict Resolution

When sources disagree, do not silently choose whichever implementation is easiest.

Use the type of decision to identify the correct source.

```text
Functional requirement
-> SRS

User workflow or authorization
-> user-flows.md

Persistent entities or relationships
-> data-model.md

Architecture or technology
-> tech-stack.md

Implementation order
-> phases.md

Visual design
-> Figma

Prototype interaction detail
-> .model files

Phase acceptance
-> .testcases
```

If two sources that should have equal authority disagree, identify the conflict before permanently encoding the behavior.

Prefer updating the canonical source rather than adding undocumented exceptions to code.

---

# 4. Implementation Phases

Prometheus must be implemented incrementally according to `.context/phases.md`.

The current phases are:

```text
Phase 0 - Foundation

Phase 1 - Authentication and Application Shell

Phase 2 - Registry

Phase 3 - Project Core

Phase 4 - Project Workflow Structure

Phase 5 - Outcome Work, Submission, Review, and Dependencies

Phase 6 - Schedule, Work Sessions, and Team

Phase 7 - Notifications and Home

Phase 8 - VisiWork and Reporting

Phase 9 - Collaboration, Realtime, and Attachments
```

Phases 0 through 5 form the first major Prometheus Core milestone.

Each phase should leave the application in a usable and testable state.

Do not substantially implement later-phase functionality unless required as infrastructure for the current phase.

When the implementation state is unclear, determine the earliest incomplete phase and continue from there.

---

# 5. Definition of Done

Do not consider work complete merely because the happy path works.

For phase-level work, use the corresponding file in `.testcases/`.

A completed phase should satisfy all relevant checks for:

- Happy-path behavior.
- Permissions.
- Authorization.
- Invalid input.
- Important edge cases.
- Persistence after refresh.
- Direct URL access.
- Empty states.
- Loading states.
- Error states.
- Browser console errors.
- Responsive behavior.
- Visual correctness.
- Regression against previous phases.
- End-to-end user workflows.

Previous completed phases must continue to work after later changes.

---

# 6. Engineering Approach

Use adaptive engineering judgment.

Choose the smallest process and architecture that protects:

1. Correctness.
2. Security.
3. Simplicity.
4. Maintainability.
5. Robustness.
6. Scalability.
7. Architectural consistency.
8. Testability.
9. Performance where relevant.
10. Development speed.

Do not choose fragile architecture merely because it requires less work.

Prefer long-term quality over minimizing development effort.

---

# 7. Vertical Slices

Prefer vertical slices over broad horizontal implementation.

When implementing a feature, complete one usable path through the required layers:

```text
UI
-> client validation
-> API
-> authentication
-> authorization
-> domain logic
-> persistence
-> response
-> UI state
-> user feedback
```

Verify that slice before expanding the feature.

Do not create dozens of incomplete components and endpoints before one user-visible workflow actually works.

---

# 8. Frontend Architecture

The production frontend uses:

```text
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
Custom CSS where appropriate
```

Prometheus is a client-side SPA.

Use React Router for navigation.

Use TanStack Query for persistent server-managed data.

Examples include:

- Projects.
- Members.
- Departments.
- Outcomes.
- Tasks.
- Project access.
- Outcome Membership.
- Submissions.
- Schedules.
- Work sessions.
- Notifications.
- Reports.

Do not duplicate server-managed state into Zustand.

Use Zustand only for shared temporary frontend state where normal local React state is insufficient.

Examples include:

- Sidebar state.
- Drawer state.
- Modal state.
- Temporary filters.
- Temporary view configuration.

Use normal React state for local component state.

Use React Hook Form for structured forms.

Use Zod for runtime validation and reusable contracts where appropriate.

Frontend validation improves UX.

Backend validation remains mandatory.

---

# 9. Backend Architecture

The production backend uses:

```text
NestJS
TypeScript
REST
Prisma
Supabase PostgreSQL
Supabase Auth
Supabase Storage
Supabase Realtime where appropriate
Brevo
```

NestJS owns protected business rules.

The browser must never be the authority for authorization.

Frontend visibility is a UX feature.

It is not a security boundary.

Every protected backend request must independently verify the authenticated user and required authorization.

Use Prisma as the primary database access layer.

Persistent business state belongs in PostgreSQL.

Do not use frontend stores, local storage, realtime presence, or prototype state as replacements for persistent records.

---

# 10. Authentication and Authorization

Authentication and Prometheus authorization are separate.

Supabase Auth establishes identity.

Prometheus membership determines whether that authenticated identity may enter the workspace.

Successful Supabase authentication does not automatically grant Prometheus access.

The authenticated identity must correspond to an authorized Prometheus member.

Keep the following concepts separate:

```text
Organization Role

Project Lead authority

Project Member access

Outcome Membership
```

Never collapse these into one global role field.

---

# 11. Organization Roles

Organization roles are:

```text
ADMINISTRATOR
MEMBER
```

Administrator authority applies to organization-level functionality such as Registry.

Administrator status does not automatically grant Project Lead authority.

A user may be an Administrator but still have no special authority inside a project they do not lead.

---

# 12. Project Lead

Project Lead is a relationship between a member and one project.

It is not an organization role.

Project Lead authority applies only to the relevant project.

Do not create a global `PROJECT_LEAD` role that grants authority across projects.

---

# 13. Project Member Access

Project Member access may be:

```text
CAN_VIEW
CAN_EDIT
```

Project Membership is derived from Outcome Membership.

Project Members default to `CAN_VIEW`.

Only the Project Lead may grant or revoke `CAN_EDIT`.

`CAN_EDIT` does not make a member the Project Lead.

---

# 14. Outcome Membership

Outcome Membership is specific to an outcome.

An active authorized member may join an eligible outcome according to canonical business rules.

Outcome Membership is permanent.

Do not implement a normal leave mechanism unless requirements explicitly change.

Historical Outcome Membership must be preserved.

Outcome Membership grants outcome-level participation rights according to workflow state.

---

# 15. Critical Prometheus Domain Rules

Preserve the following distinctions unless canonical requirements explicitly change.

Any active authorized member may create a project.

The creator of a project does not receive continuing authority merely because they created it.

Project Lead authority applies only to projects that member leads.

Project Membership is derived from Outcome Membership.

Project Members default to `CAN_VIEW`.

Only the Project Lead may grant or revoke `CAN_EDIT`.

Administrator status does not override project-specific authority.

Outcome Membership is permanent.

Historical Outcome Membership must be preserved.

Submission history must be preserved.

Acceptance and reopening history must be preserved.

Each outcome has shared submission history.

Multiple submissions may exist according to the canonical workflow.

Outcome acceptance is an outcome-level decision.

Only the Project Lead may perform Project Lead-only review operations.

Reopening an outcome must preserve existing membership, submissions, and acceptance history.

Schedule and actual work activity are different concepts.

Schedule represents planned availability.

Work Sessions represent actual Time In and Time Out activity.

Presence must never replace persistent Work Session records.

---

# 16. Backend Authorization

Always enforce protected operations on the backend.

Do not trust:

- Hidden frontend controls.
- Client-supplied roles.
- Client-supplied member IDs.
- Client-supplied project permissions.
- Client-supplied membership status.
- Cached browser state.

Always test important permissions at both:

```text
UI level
API level
```

A user who cannot see a button must also be unable to perform the operation through a direct API call.

---

# 17. Server Data and Derived State

Prefer deriving values from canonical records instead of synchronizing duplicate state.

Examples include:

- Project Membership derived from Outcome Membership.
- Dashboard information derived from project, outcome, task, and work-session data.
- Reports derived from canonical operational records.
- Working-now indicators derived from appropriate work-session or presence data.

Do not maintain manually synchronized shadow state merely because it makes one screen easier to build.

If derived state becomes expensive, optimize intentionally through:

- Better queries.
- Database views.
- Controlled caching.
- Materialized views where justified.
- Controlled denormalization where justified.

Do not introduce uncontrolled duplication.

---

# 18. Bug Fix Workflow

For bug fixes, begin by reproducing the problem as closely as possible to how an actual user experiences it.

Prefer browser-level reproduction before modifying implementation details.

Determine:

```text
What action did the user perform?

What did the user expect?

What actually happened?

Can it be reproduced consistently?

Which system boundary failed?
```

Once reproduced, narrow the problem using the smallest useful diagnostic step.

Inspect as appropriate:

- Browser behavior.
- Console output.
- Network requests.
- API responses.
- Backend logs.
- Validation.
- Database state.
- Authentication state.
- Authorization state.
- Recent changes.

Fix the underlying cause rather than masking the visible symptom.

After the fix, repeat the original end-to-end reproduction.

Then run the smallest relevant regression checks.

Expand verification according to the change surface.

---

# 19. Testing Strategy

Prometheus uses:

```text
Vitest
React Testing Library
Playwright
Manual acceptance testing
```

Playwright is the preferred automated tool for end-to-end user workflows.

Test important application behavior from the user's perspective whenever practical.

Do not rely exclusively on unit tests for:

- Authorization.
- Authentication.
- Routing.
- Persistence.
- Multi-layer workflows.

After a meaningful change, run the smallest relevant validation first.

Examples:

```text
Focused unit test

Focused component test

Focused Playwright test

Affected-package typecheck

Affected-package lint
```

Before considering a larger feature complete, run broader checks appropriate to the change.

Expected project-level commands should eventually include equivalents of:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Use the repository's actual package scripts once they exist.

Do not invent parallel command conventions unnecessarily.

---

# 20. Regression Expectations

Every completed phase creates a regression obligation.

Do not test only the screen that changed.

At minimum, protect:

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

After Prometheus Core is implemented, protect:

```text
Create Project
-> Create Stage
-> Create Outcome
-> Join Outcome
-> Create Feature or Task
-> Complete Work
-> Submit Output
-> Request Revision
-> Resubmit
-> Accept Outcome
```

If a change touches authorization, persistence, routing, authentication, or shared infrastructure, assume the regression surface is larger than the visible screen.

---

# 21. Edge Cases

Consider edge cases while implementing.

Do not postpone all edge cases until the end.

Pay particular attention to:

- Empty datasets.
- Invalid input.
- Duplicate submission.
- Duplicate clicks.
- Concurrent actions.
- Stale cached data.
- Unauthorized API requests.
- Expired authentication.
- Deactivated members.
- Missing referenced records.
- Refreshing nested routes.
- Direct navigation to protected routes.
- Failed network requests.
- Partial backend failures.
- Loading transitions.
- Realtime reconnect behavior.
- Permission changes while a page is already open.
- Multiple users performing state transitions close together.

Match edge-case depth to the risk of the feature.

Authorization and persistent state require especially careful treatment.

---

# 22. Figma Workflow

For user-facing implementation work, inspect the relevant design in Figma before making significant visual decisions.

Prometheus Figma:

https://www.figma.com/design/8zgQ4pcWtku7rSWzjlP9K9/Prometheus?node-id=19-12077&t=WEpRDccEfW56hE0W-1

Use Figma to determine:

- Page composition.
- Layout.
- Component placement.
- Typography.
- Spacing.
- Borders.
- Radius.
- Glass effects.
- Icon placement.
- Visual hierarchy.
- Responsive intent.

Do not treat screenshots as sufficient when the actual Figma design is available.

If the relevant Figma frame cannot be accessed, use the HTML prototype as the fallback visual and interaction reference.

Do not invent a significantly different visual system without an explicit design decision.

---

# 23. UI and Visual Quality

Treat visual correctness as part of functional correctness.

Do not consider a screen complete when the logic works but the UI clearly differs from the intended design.

Inspect the resulting UI in a real browser.

Be picky about:

- Alignment.
- Spacing.
- Typography.
- Component sizing.
- Overflow.
- Scroll behavior.
- Modal positioning.
- Drawer positioning.
- Responsive behavior.
- Liquid glass effects.
- Hover states.
- Focus states.
- Disabled states.
- Empty states.
- Loading states.
- Error states.
- Icon consistency.
- Visual hierarchy.

Do not preserve obvious prototype defects merely for prototype fidelity.

If an obvious UI defect appears during testing, fix it rather than ignoring it solely because it is adjacent to the requested task.

---

# 24. Browser Verification

For user-facing changes, inspect the application in the browser whenever possible.

Do not infer that the UI looks correct from JSX and CSS alone.

Verify:

```text
Default state

Hover state

Focus state

Loading state

Empty state

Error state

Long-content state

Small viewport

Normal desktop viewport
```

Check the browser console while testing.

There should be no unexplained errors or warnings introduced by the change.

---

# 25. Modals, Drawers, and Overlays

Modal content that exceeds its intended height should scroll internally.

Opening a modal must not transform it into normal page content.

Drawers should remain attached to the intended screen edge.

Drawers should not unexpectedly change underlying page layout.

Prevent duplicate dialogs or duplicate confirmation interfaces.

Overlay behavior should consider:

- Escape key behavior where appropriate.
- Explicit close actions.
- Focus behavior.
- Background interaction.
- Long content.
- Small viewports.
- Repeated opening and closing.

Prefer reusable overlay primitives once the same interaction pattern appears repeatedly.

---

# 26. Responsive Design

Do not optimize only for the viewport used during development.

Check relevant desktop widths and smaller supported sizes.

Fixed-height dashboard regions may use internal vertical scrolling when that is the intended interaction.

Avoid accidental page overflow caused by:

- Cards.
- Tables.
- Drawers.
- Modals.
- Sidebars.
- Long text.
- Forms.

Collapsed navigation must remain usable.

Important icons and actions must remain discoverable.

---

# 27. Error Handling

Failures should be explicit and recoverable.

Do not silently swallow errors.

Frontend errors should produce appropriate user feedback.

Backend errors should use consistent application-level handling.

Distinguish expected domain failures from unexpected server failures.

Expected domain failures may include:

- Unauthorized operation.
- Invalid state transition.
- Inactive member.
- Duplicate membership.
- Invalid project access.
- Outcome already accepted.
- Missing required dependency.

Do not expose sensitive internal details to end users.

Preserve enough structured information for debugging.

---

# 28. Database Changes

Treat the data model as a long-lived contract.

Before changing persistent structure, check `.context/data-model.md`.

Use Prisma migrations for schema changes.

Do not casually rewrite shared or deployed migration history.

Preserve historical records when the product requires auditability.

Use database constraints when an invariant belongs at the persistence boundary.

Do not depend exclusively on UI validation for database integrity.

Consider transactional behavior when a workflow modifies multiple related records.

---

# 29. API Design

Keep REST endpoints centered on domain behavior rather than mirroring UI component structure.

Authorization must be checked for every protected request.

Do not trust IDs, roles, permissions, or membership information supplied by the client.

Validate all incoming data.

Prefer stable resource-oriented APIs and explicit commands for important transitions.

Examples:

```text
POST /outcomes/:id/join

POST /outcomes/:id/submissions

POST /outcomes/:id/request-revision

POST /outcomes/:id/accept

POST /outcomes/:id/reopen

POST /work-sessions/time-in

POST /work-sessions/time-out
```

Important state transitions should have explicit backend semantics.

Avoid implementing critical domain transitions as arbitrary client-side field updates.

---

# 30. Realtime

Realtime is supplemental.

Do not make Supabase Realtime the canonical owner of persistent business state.

Appropriate realtime use cases include:

- Project chat.
- Presence.
- Working-now indicators.
- Live notifications.

Persistent records still belong in PostgreSQL.

The application should degrade reasonably when realtime connectivity is temporarily unavailable.

Where appropriate, reconnect and refetch canonical state after interruption.

---

# 31. File Storage

Use Supabase Storage for binary files and attachments.

Store relevant metadata and ownership relationships in PostgreSQL.

Never trust a storage object path alone as proof that a user may access a file.

Attachment access must follow the authorization model of the owning resource.

---

# 32. Code Organization

Organize code around meaningful product or domain boundaries when practical.

Keep modules cohesive.

Avoid giant components.

Avoid giant services.

Extract helpers when they:

- Improve locality.
- Remove meaningful duplication.
- Make logic easier to test.
- Clarify ownership.

Do not extract trivial helpers that make simple code harder to follow.

Prefer explicit names over clever abstractions.

Keep business rules close to the domain layer that owns them.

Keep UI-only concerns out of backend domain logic.

Keep backend authority out of frontend-only state.

---

# 33. Deep Modules

Prefer deep modules with small, stable interfaces.

A module should hide meaningful complexity behind a simple boundary.

Avoid creating layers that merely rename another API without adding meaningful behavior.

Add interfaces or adapters when:

- Behavior genuinely varies.
- Testing requires a replacement point.
- An external dependency is unstable.
- The boundary represents an important domain seam.

Do not create abstraction layers only for architectural appearance.

---

# 34. Shared Contracts

Use shared contracts selectively.

Zod schemas may be reused between frontend and backend when doing so creates a clear source of truth.

Do not force layers to share the same exact shape merely to avoid mapping code.

Database models, API contracts, and UI view models are related but are not automatically identical.

Expose only data the client needs.

---

# 35. Existing Prototype Files

`.model/finalmodel.html` is intentionally large because it is a prototype.

Do not migrate it directly into one giant React component.

Use it to understand:

- Screen layout.
- Navigation.
- Interaction.
- Modal behavior.
- Drawer behavior.
- Workflow intent.
- Visual treatment when necessary.

Then rebuild those concepts using maintainable production components.

Do not use prototype JavaScript state as production authorization.

Do not use prototype local state as production persistence.

Do not assume prototype DOM structure should determine production component boundaries.

---

# 36. Documentation

When behavior changes, update the canonical documentation that owns that behavior.

Do not spread the same rule across multiple documents unless necessary.

When documentation overlaps, identify one canonical source and make secondary documentation reference it.

Watch for documentation drift.

When writing or substantially editing long Markdown files, place each complete sentence on its own physical line.

Preserve normal Markdown structure.

Do not manually edit files marked as generated or auto-generated.

Never manually modify an auto-generated `CHANGELOG.md`.

---

# 37. Refactoring

Refactor when it materially improves the system.

Good reasons include:

- Removing meaningful duplication.
- Clarifying ownership.
- Creating a needed test seam.
- Simplifying an unstable interface.
- Improving authorization clarity.
- Removing obsolete prototype architecture.
- Consolidating sources of truth.

Avoid speculative abstractions for hypothetical future requirements.

When a refactor is large, preserve behavior incrementally and verify after meaningful steps.

---

# 38. Unrelated Problems Found During Work

Do not ignore obvious quality problems discovered while implementing or testing.

Investigate and fix:

- Lint failures.
- Test failures.
- Test flakiness.
- Broken types.
- Obvious visual defects.
- Console errors.
- Clear accessibility regressions.

If fixing an adjacent issue requires a large unrelated architectural change, identify that boundary before expanding scope.

Do not normalize a broken baseline merely because the issue existed before the current task.

---

# 39. Git Practices

Keep commits focused and understandable.

Use commit messages that describe the change itself.

Never automatically add an agent, ChatGPT, Codex, bot, or other tool as a commit co-author.

Do not add agent-related `Co-authored-by` trailers.

Do not rewrite unrelated user changes.

Do not discard local modifications merely because they are outside the current task.

Before replacing a file, understand whether it contains uncommitted user work.

Avoid destructive Git operations unless explicitly required.

---

# 40. Generated Files

Do not manually edit generated files when a canonical generator exists.

Modify the source and regenerate instead.

Examples may include:

- Prisma-generated output.
- Generated API clients.
- Build output.
- Coverage output.
- Generated changelogs.

Do not commit generated artifacts unless the repository intentionally tracks them.

---

# 41. Dependencies

Before adding a dependency, determine whether the existing Prometheus stack already solves the problem.

Avoid overlapping libraries without a meaningful reason.

When evaluating a dependency, consider:

- Maintenance quality.
- TypeScript support.
- Security.
- Bundle impact.
- Ecosystem stability.
- Testability.
- Long-term support.
- Compatibility with the existing architecture.

Development cost alone should not determine the decision.

---

# 42. Security

Never expose:

- Supabase service-role credentials.
- Brevo credentials.
- Database credentials.
- Private secrets.
- Server-only environment variables.

Only expose environment variables intentionally designed for frontend use.

Authorization for files, projects, Registry actions, and workflow transitions must be enforced on the server.

Do not assume hidden UI controls provide security.

---

# 43. Performance

Do not optimize blindly.

Measure or identify an actual concern first.

Avoid obvious problems such as:

- Unbounded queries.
- Fetching entire tables for one screen.
- N+1 database access.
- Repeated API requests caused by poor query configuration.
- Rendering extremely large lists without pagination or virtualization.
- Loading unnecessary media eagerly.

Prefer a simple correct implementation until additional complexity is justified.

---

# 44. Accessibility

Use semantic elements for interactive controls.

Buttons should normally be actual buttons.

Forms should have labels.

Keyboard navigation should work for important interactions.

Focus states should remain visible.

Modals and drawers should not trap users in inaccessible states.

Do not remove accessibility behavior purely for visual styling.

---

# 45. Incremental Verification

Do not make a large group of unrelated changes and test only at the end.

After a meaningful change, run the smallest relevant verification.

Example:

```text
Implement one backend rule
-> run focused backend test

Connect one API path
-> verify the request

Build one interaction
-> test it in the browser

Complete one vertical slice
-> run the matching Playwright path

Finish the feature
-> run broader regression
```

Catch failures near the change that introduced them.

---

# 46. Phase Workflow for Agents

When asked to implement work within a phase:

```text
1. Read the relevant section of .context/phases.md.

2. Read the matching .testcases file.

3. Read the canonical requirements governing the feature.

4. Inspect the relevant Figma design for user-facing work.

5. Inspect the HTML prototype where interaction clarification is useful.

6. Inspect the current implementation.

7. Reproduce existing behavior before fixing a bug.

8. Implement the smallest complete vertical slice.

9. Run focused verification.

10. Inspect user-facing changes in the browser.

11. Compare important visual behavior against Figma.

12. Run the relevant acceptance path.

13. Run appropriate regression checks for previous completed phases.

14. Report what changed and what was actually verified.
```

Do not begin the next phase merely because most of the current phase appears to work.

The acceptance gate defines completion.

---

# 47. Prometheus Core Priority

Until Phase 5 is complete, prioritize the core workflow:

```text
Administrator authorizes member
        |
        v
Member authenticates
        |
        v
Prometheus verifies workspace membership
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
Member receives Outcome Membership
        |
        v
Project Membership is derived
        |
        v
Outcome Member creates work
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

Do not consider Prometheus Core complete until this flow works with:

```text
Real authentication

Real authorization

Real database persistence

Backend permission enforcement

Refresh-safe state

Direct URL protection

Browser-level verification
```

---

# 48. Lavish

Lavish is strictly opt-in.

Never invoke `lavish-axi` automatically.

Do not create, open, poll, export, share, or end a Lavish artifact unless the user explicitly asks to use Lavish in the current request.

Requests for:

- Plans.
- Reports.
- Comparisons.
- Prototypes.
- HTML.
- UI design.
- Visual explanations.

do not count as permission to use Lavish.

---

# 49. Communication

Be concise about routine implementation details.

Explain architectural decisions when they materially affect future development.

When reporting completed work, state:

- What changed.
- What important behavior was preserved.
- What verification was performed.
- What remains unverified.
- Any known limitation or risk.

Do not claim tests passed unless they were actually run.

Do not claim a bug is fixed unless the original reproduction path was verified after the change.

Do not hide known failures.

---

# 50. Code Style

Follow repository formatting, linting, and typechecking rules once established.

Prefer readable TypeScript.

Avoid unnecessary `any`.

Use explicit domain terminology.

Prefer names such as:

```text
OutcomeMembership
ProjectMemberAccess
ProjectLead
WorkSession
Submission
AcceptanceHistory
```

Avoid vague names such as:

```text
UserRole
Assignment
GenericStatus
PermissionThing
```

when the domain has a more precise term.

Do not use the em dash character in documentation, comments, commit messages, or user-facing copy.

Use a normal hyphen instead.

---

# 51. Final Principle

Prometheus should have one coherent model of reality.

Authentication identifies the user.

Registry determines workspace membership.

Projects determine Project Lead authority.

Outcome Membership determines outcome participation and derived Project Membership.

PostgreSQL owns persistent business state.

NestJS enforces business rules.

React presents and interacts with that state.

Figma defines the intended visual design.

The HTML prototypes provide interaction reference.

Realtime enhances the experience without replacing persistence.

Tests verify the behavior users actually depend on.

When an implementation makes those boundaries less clear, simplify it before expanding it.

## Design Assets

Use the existing assets in `public/` as the canonical visual assets for the application.

### Authentication

Assets specific to the login/authentication experience are stored in:

`public/auth/`

Current assets:

- `prometheus-mark.png` - Prometheus brand/icon used on the login page.
- `prometheus-auth-background.png` - background artwork for the login/authentication page.

When implementing or modifying authentication screens, reuse these assets instead of recreating the logo, gradient, or background with CSS unless explicitly requested.

Because files under `public/` are served from the application root, reference them in application code as:

- `/auth/prometheus-mark.png`
- `/auth/prometheus-auth-background.png`

### Application Backgrounds

Shared backgrounds used inside the authenticated Prometheus workspace are stored in:

`public/backgrounds/`

The primary application background is:

- `editorial-gradient.webp`

Use it as the canonical background for system/workspace screens where the Prometheus background treatment is required.

Reference it in application code as:

`/backgrounds/editorial-gradient.webp`

Do not duplicate these assets into `src/` or recreate them as CSS gradients unless there is a specific design requirement to do so.

When matching the Figma design, prefer these repository assets over approximating the visual treatment.