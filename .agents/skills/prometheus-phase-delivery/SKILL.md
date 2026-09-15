---
name: prometheus-phase-delivery
description: Use when starting, implementing, verifying, documenting, or completing any Prometheus implementation phase. Covers phase scoping, source-of-truth review, vertical-slice delivery, acceptance, regression, and the engineering decision journal.
---

# Prometheus Phase Delivery

Use this workflow for phase-level implementation work.

The goal is to leave every phase usable, tested, documented, and safe for the next phase.

## 1. Determine the active phase

Read `.context/phases.md` and `.docs/phases/README.md`.

If implementation state is unclear, identify the earliest incomplete phase from repository evidence rather than guessing from the navbar or prototype.

Do not substantially implement later-phase product behavior unless it is required infrastructure for the active phase.

## 2. Load the relevant sources of truth

Before coding, read only the portions needed for the task from:

- `.context/Software Requirements Specification - Prometheus Centralized Workflow Management System.md` for functional requirements and business rules.
- `.context/user-flows.md` for user behavior and authorization flows.
- `.context/data-model.md` for persistent entities, relationships, constraints, history, and derived state.
- `.context/tech-stack.md` for architecture and technology boundaries.
- `.context/phases.md` for phase scope, dependencies, and exit criteria.
- The matching `.testcases/phase-XX-*.md` file for the acceptance gate.
- The matching `.docs/phases/phase-XX-*.md` file for the live implementation record.
- Figma for user-facing visual design.
- `.model/` only as a secondary interaction/prototype reference.

When sources disagree, resolve the conflict according to the ownership rules in `AGENTS.md` before permanently encoding behavior.

## 3. Keep the phase journal live

The phase document under `.docs/phases/` is an implementation journal, not an end-of-phase retrospective written from memory.

Update it when meaningful implementation facts change.

Record major engineering decisions and difficult problems as they happen.

Use stable decision IDs such as:

```text
P2-D01
P2-D02
P3-D01
```

A meaningful decision entry should capture:

- What gave us a hard time.
- Root cause or constraint.
- Options considered.
- Proposed solution.
- Final decision.
- Why it was chosen.
- Observed result.
- What was learned.
- Next approach.
- Related files, migrations, tests, routes, or commits.

Do not create decision entries for routine formatting, trivial typos, or small mechanical fixes unless they exposed a broader engineering lesson.

## 4. Deliver vertical slices

Prefer the smallest complete user-visible path through the required layers:

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

Verify a slice before expanding the feature.

Do not create a large collection of disconnected components and endpoints before one real workflow works end to end.

## 5. Verify incrementally

After each meaningful change, run the smallest relevant verification first.

Examples:

```text
Backend rule
-> focused unit test

API path
-> request/response verification

UI interaction
-> browser verification

Completed vertical slice
-> focused Playwright path
```

Expand verification according to the change surface.

Authentication, authorization, persistence, routing, and shared infrastructure require broader regression than an isolated visual change.

Never claim a test passed unless it was actually run.

## 6. Run the phase acceptance gate

Before phase completion, use the matching `.testcases/phase-XX-*.md` file.

Verify all relevant categories:

- Happy path.
- Permissions and backend authorization.
- Invalid input and important edge cases.
- Refresh and persistence.
- Direct URL access.
- Empty states.
- Loading states.
- Error states.
- Browser console cleanliness.
- Responsive behavior.
- Visual correctness.
- Previous-phase regression.
- Main end-to-end workflow.

Use Playwright for critical browser workflows where practical, but do not treat automation as a substitute for checks that are intentionally manual or visual.

## 7. Protect previous phases

Every completed phase creates a regression obligation.

At minimum, preserve the existing authenticated application flow:

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

As later Prometheus Core phases become real, extend regression to the complete project workflow defined in `.context/phases.md`.

## 8. Phase completion gate

A phase is complete only when all of the following are true:

1. Planned phase scope is implemented.
2. Relevant acceptance checks pass.
3. Required permission and API enforcement is verified.
4. Previous completed phases pass appropriate regression.
5. Known unverified behavior is explicitly identified.
6. The matching `.docs/phases/phase-XX-*.md` reflects the implementation that actually exists.
7. Major decisions and difficult problems are recorded.
8. Lessons learned and the next approach are recorded.
9. Known limitations and technical debt are recorded.
10. The phase exit result is explicit.

Do not begin the next phase merely because most of the current phase appears to work.

The acceptance gate and phase journal define completion together.

## 9. Report completion accurately

When reporting phase work, state:

- What changed.
- What important behavior was preserved.
- What verification was performed.
- What remains unverified.
- Known limitations or risks.
- Whether the phase completion gate is actually satisfied.
