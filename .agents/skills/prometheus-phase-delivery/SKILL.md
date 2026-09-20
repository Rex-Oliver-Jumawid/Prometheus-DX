---
name: prometheus-phase-delivery
description: Use when starting, implementing, verifying, documenting, or completing any Prometheus implementation phase. Covers phase scoping, source-of-truth review, vertical-slice delivery, layered testing, acceptance, regression, engineering decision journals, and cross-session handoff.
---

# Prometheus Phase Delivery

Use this workflow for phase-level implementation work.

The goal is to leave every phase usable, tested, documented, and safe for the next phase or development session.

## 1. Determine the active phase and handoff state

Read `.docs/CURRENT.md` first when it exists.

Treat it as the lightweight cross-session handoff, not as a canonical requirements source.

Then read `.context/phases.md` and `.docs/phases/README.md`.

If implementation state is unclear, verify the handoff against repository evidence and identify the earliest incomplete phase rather than guessing from the navbar or prototype.

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

## 5. Verify incrementally with the correct test layer

After each meaningful change, run the smallest relevant verification first.

Choose the lowest layer that proves the behavior reliably.

Use this mapping:

```text
Pure business rule, validation, permission calculation, service behavior
-> Vitest in the Node environment

React dialog, form, keyboard behavior, conditional rendering, local UI state
-> Vitest + React Testing Library + jsdom

API authorization, persistence, stale-write protection, concurrency
-> service or API integration test without a browser where practical

Critical real user journey across browser, authentication, API, and persistence
-> Playwright + Chromium

Cross-browser release confidence
-> Playwright + Firefox + WebKit

Visual fidelity, usability, and intentionally human acceptance checks
-> matching .testcases/ phase file
```

Do not put a permission matrix, schema validation case, or direct API status check in Playwright merely because Playwright can execute it.

Keep Playwright for behavior where the real browser or complete integration path is material to the evidence.

Component tests should own React interaction details that do not require a real backend.

Playwright tests should be independent whenever practical and provision the state they require.

Use a serial suite only when the acceptance journey deliberately depends on sequential shared state.

Examples of focused verification:

```text
Backend rule
-> focused Vitest test

React interaction
-> focused component test

API path
-> focused service or API integration test

Completed browser-visible slice
-> focused Chromium Playwright path
```

During implementation, use the guarded focused command rather than the full E2E suite:

```bash
pnpm test:e2e:focused -- tests/e2e/<relevant>.spec.ts -g "<relevant journey>"
```

Do not run `pnpm test:e2e` or `pnpm verify:e2e` in the normal inner loop merely because Playwright coverage exists.

Reserve those broad commands for the phase or merge gate when broad Chromium regression is intentionally required.

Expand verification according to the change surface.

Authentication, authorization, persistence, routing, and shared infrastructure require broader regression than an isolated visual change.

Never claim a test passed unless it was actually run.

## 6. Use the repository verification gates deliberately

Use `pnpm verify` as the normal non-browser repository gate.

It covers project configuration, linting, TypeScript checks, Node Vitest tests, React component tests, and the production build.

Use `pnpm verify:e2e` when a phase or change requires Chromium browser regression in addition to the non-browser gate.

Use `pnpm verify:release` for release-level cross-browser confidence with Firefox and WebKit.

Do not make Firefox and WebKit part of the normal inner development loop unless the change is specifically browser compatibility work.

When debugging Playwright failures, use retained traces and failure screenshots before increasing timeouts or retries.

## 7. Run the phase acceptance gate

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

The acceptance file defines what must be proven, not which automation tool must prove every line.

Map each requirement to the smallest appropriate automated or manual layer.

Use Playwright for critical browser workflows where practical, but do not treat automation as a substitute for checks that are intentionally manual or visual.

## 8. Protect previous phases

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

## 9. Maintain the cross-session handoff

Keep `.docs/CURRENT.md` concise and current.

Update it when:

- the active phase changes,
- the next concrete action changes materially,
- a blocking issue changes what the next session should do,
- or a work session ends at a materially different point than the existing handoff.

It should contain the current phase, verified current state, the next action, and the minimum startup reading needed by the next agent.

Do not turn `.docs/CURRENT.md` into a permanent engineering diary.

Permanent implementation history belongs in the matching `.docs/phases/phase-XX-*.md` journal.

Canonical requirements belong in `.context/`.

## 10. Phase completion gate

A phase is complete only when all of the following are true:

1. Planned phase scope is implemented.
2. Relevant acceptance checks pass at the appropriate test or manual layer.
3. Required permission and API enforcement is verified below the browser layer where practical.
4. Critical real user journeys pass Chromium browser verification when applicable.
5. Previous completed phases pass appropriate regression.
6. Known unverified behavior is explicitly identified.
7. The matching `.docs/phases/phase-XX-*.md` reflects the implementation that actually exists.
8. Major decisions and difficult problems are recorded.
9. Lessons learned and the next approach are recorded.
10. Known limitations and technical debt are recorded.
11. The phase exit result is explicit.
12. `.docs/CURRENT.md` points to the correct next phase or next concrete action.

Do not begin the next phase merely because most of the current phase appears to work.

The acceptance gate and phase journal define completion together.

## 11. Report completion accurately

When reporting phase work, state:

- What changed.
- What important behavior was preserved.
- What verification was performed and at which test layer.
- What remains unverified.
- Known limitations or risks.
- Whether the phase completion gate is actually satisfied.
