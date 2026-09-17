# Prometheus Phase Test Cases

This folder contains the phase acceptance checks used to verify each implementation phase before moving to the next phase.

The implementation phase plan is maintained in `.context/phases.md`.

These files define acceptance criteria, not the automation layer that must implement every check.

Choose the smallest appropriate verification layer for each requirement and preserve manual checks where human visual or UX judgment is intentional.

## Test case files

- `phase-00-foundation-tests.md`
- `phase-01-auth-shell-tests.md`
- `phase-02-registry-tests.md`
- `phase-03-project-core-tests.md`
- `phase-04-project-workflow-tests.md`
- `phase-05-work-review-tests.md`
- `phase-06-schedule-team-tests.md`
- `phase-07-notifications-home-tests.md`
- `phase-08-visiwork-reporting-tests.md`
- `phase-09-collaboration-tests.md`

Use `.context/phases.md` to determine what belongs in each implementation phase.

## How acceptance checks should be verified

Map each acceptance requirement to the lowest test layer that proves it reliably:

```text
Business rules, validation, permission calculations
-> Vitest

React interaction behavior
-> Vitest + React Testing Library + jsdom

API authorization, persistence, stale writes, concurrency
-> service or API integration tests where practical

Critical complete user workflows
-> Playwright + Chromium

Release-level browser compatibility
-> Playwright + Firefox + WebKit

Visual fidelity, usability, and intentionally human checks
-> manual acceptance
```

Do not move a permission matrix or API-only assertion into Playwright merely because the phase file lists it.

Do not remove browser acceptance coverage for workflows where browser routing, authentication, frontend-to-backend integration, refresh persistence, responsive behavior, or user-visible sequencing is part of the requirement.

Automated evidence and manual evidence may both contribute to one phase gate.

The matching phase journal should record which evidence was actually run and the result.

## Phase completion

Before continuing to the next phase, complete the matching test-case file and verify that the delivered phase satisfies its acceptance checks.

Run focused verification during development instead of waiting until the phase exit gate.

For the final phase gate, use `pnpm verify` for non-browser checks and `pnpm verify:e2e` when the phase includes real browser workflows.

Use `pnpm verify:release` for release-level cross-browser confidence, not as a mandatory inner-loop command for every change.

Do not mark a phase PASS based only on historical test results when current changes could affect that behavior.
