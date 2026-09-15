# Prometheus-DX

Prometheus-DX is the planning, prototype, and implementation repository for the Prometheus Centralized Workflow Management System.

Prometheus is an internal web application for project delivery, open internal project participation, Outcome Membership, submission review, scheduling, time tracking, notifications, reporting, and organization administration.

## Current status

The repository is currently transitioning from product planning and interaction prototyping into phased implementation.

The real application will use React, TypeScript, Vite, NestJS, Prisma, Supabase PostgreSQL, and Supabase Auth as defined in `.context/tech-stack.md`.

## Repository structure

```text
.context/      Product requirements, user flows, data model, tech stack, and implementation phases
.model/        Current HTML interaction prototypes
.testcases/    Manual acceptance test cases used to verify each implementation phase
public/        Prototype and application assets
```

## Source-of-truth hierarchy

- `.context/Software Requirements Specification - Prometheus Centralized Workflow Management System.md` defines functional requirements and business rules.
- `.context/user-flows.md` defines canonical user behavior and access-control flows.
- `.context/data-model.md` defines persistent entities, relationships, constraints, and derived state.
- `.context/tech-stack.md` defines the implementation architecture and technology choices.
- `.context/phases.md` defines the implementation order.
- Figma defines the visual design.
- `.model/finalmodel.html` and `.model/login-page.html` remain prototype and interaction references only.
- `.testcases/` contains the manual acceptance gates for each phase.

When references disagree, resolve the conflict in the canonical planning documents before encoding the behavior in the application.

## Implementation workflow

For each phase:

1. Read the matching section in `.context/phases.md`.
2. Implement only the planned phase scope.
3. Run the matching manual checks in `.testcases/`.
4. Fix failed acceptance checks before beginning the next phase.

The implementation should preserve the separation between organization authority, Project Lead authority, Project Member access, and Outcome Membership.
