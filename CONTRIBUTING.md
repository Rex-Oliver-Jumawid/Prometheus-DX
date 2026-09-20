# Contributing

Keep changes phase-focused, easy to review, and aligned with the Prometheus source-of-truth documents.

## Before coding

- Read `AGENTS.md` for always-active repository rules.
- Load the relevant workflow under `.agents/skills/` for phase delivery, debugging, UI work, or database changes.
- Read the relevant section in `.context/phases.md` before starting implementation work.
- Read the matching requirements in `.context/` before implementing behavior.
- For substantial user-facing work, read `.context/ui-reference.md` and inspect the relevant workflow in `.model/finalmodel.html` before coding the production UI.
- Treat `.model/finalmodel.html` as the prototype source of truth for the main authenticated application experience.
- Treat `.model/login-page.html` as the prototype source of truth for authentication-screen user-visible behavior.
- Reproduce the demonstrated prototype behavior in production unless the user explicitly changes that product decision.
- Use Figma and Figma MCP or an equivalent connected integration as supporting helpers for measurements, spacing, typography, icons, variables, frame structure, screenshots, and fine visual detail.
- When Figma and `finalmodel.html` disagree about the application experience, follow `finalmodel.html` unless a newer explicit user decision says otherwise.
- Do not silently omit a prototype field or interaction merely because the current data model does not support it.
- Reconcile the requirements and persistence model instead.
- Do not treat prototype JavaScript, DOM structure, mock state, or frontend-only permission checks as production architecture or backend authority.
- Read the matching implementation journal in `.docs/phases/` when one already exists so previous decisions and lessons are carried forward.
- Resolve genuine security, authorization, architecture, and data-integrity conflicts explicitly before encoding contradictory production behavior.

## Branches and commits

- Branch from `main` with a short-lived `feat/`, `fix/`, `chore/`, or `refactor/` branch.
- Keep each pull request focused on one phase, feature, fix, or infrastructure change.
- Use conventional commit prefixes such as `feat:`, `fix:`, `chore:`, `test:`, `docs:`, and `refactor:`.
- Prefer squash merging after focused review and passing CI.

## Testing workflow

Use the smallest test layer that can prove the behavior correctly.

Do not default every behavior check to Playwright.

Use this ownership model:

```text
Pure logic, validation, permissions, service behavior
-> Vitest in the Node environment

React dialogs, forms, keyboard behavior, conditional rendering, local UI state
-> Vitest + React Testing Library + jsdom

API behavior, persistence, authorization, concurrency, stale-write protection
-> service or API integration tests without a browser where practical

Critical real user journeys crossing browser, API, authentication, and persistence
-> Playwright + Chromium

Cross-browser release confidence
-> Playwright + Firefox + WebKit

Visual, UX, and phase-specific checks that are intentionally manual
-> matching .testcases/ phase acceptance file
```

A browser test should exist when the browser itself, routing, real frontend integration, authentication flow, persistence across refresh, or complete user journey is material to the behavior being verified.

Permission matrices, schema validation, service rules, and direct API status checks should normally be tested below the browser layer unless the browser-visible consequence is itself important.

Component tests should cover React interaction details that do not require a real backend, such as modal dismissal, focus restoration, keyboard handling, form feedback, loading presentation, and conditional controls.

Playwright tests should be independent whenever practical.

Each test should provision the state it requires instead of relying on an earlier test to create or mutate shared state.

Use shared serial journeys only when the real acceptance scenario genuinely requires sequential state and the dependency is deliberate.

## Incremental verification

After a meaningful change, run the smallest relevant focused check first.

Expand verification only as the change surface grows.

A normal progression is:

```text
Focused Vitest or component test
-> affected service/component suite
-> focused Chromium Playwright path when browser behavior matters
-> pnpm verify
-> pnpm verify:e2e for phase-completion browser regression
-> pnpm verify:release for release-level cross-browser confidence
```

Run the non-browser verification suite before opening a pull request:

```bash
pnpm verify
```

`pnpm verify` includes the repository configuration doctor, linting, TypeScript checks, Node Vitest tests, React component tests, and the production build.

Formatting remains a separate explicit check until the current stylesheet and UI source are normalized:

```bash
pnpm format:check
```

For normal development, run only the directly affected Chromium journey:

```bash
pnpm test:e2e:focused -- tests/e2e/<relevant>.spec.ts -g "<relevant journey>"
```

The focused runner requires an explicit spec file and accepts at most three specs so routine agent work cannot accidentally launch the entire browser suite.

Start with one spec and one `-g` filter when practical.

Use the full Chromium suite only for an intentional broad regression gate:

```bash
pnpm test:e2e
```

Use the combined non-browser and Chromium gate for phase completion, merge-level shared-infrastructure changes, or other deliberately broad browser-impacting work:

```bash
pnpm verify:e2e
```

Use Firefox and WebKit as a release-level verification layer rather than the normal development loop:

```bash
pnpm verify:release
```

Playwright retains traces and failure screenshots so browser failures can be diagnosed from evidence instead of being masked with larger timeouts or retries.

For bug fixes, follow `.agents/skills/prometheus-debugging/SKILL.md`.

For each implementation phase, follow `.agents/skills/prometheus-phase-delivery/SKILL.md` and complete the matching acceptance checks in `.testcases/`.

For substantial UI work, also follow `.agents/skills/prometheus-ui-implementation/SKILL.md` and compare the working application against the relevant `finalmodel.html` workflow in a browser.

## Database and configuration changes

For persistent data-model or migration work, follow `.agents/skills/prometheus-database-change/SKILL.md`.

Keep Prisma schema changes and their migrations together.

Run `pnpm prisma:generate` and `pnpm prisma:validate` after Prisma changes.

Update `.env.example` whenever a new required environment variable is introduced, but never commit real secrets.

Keep database credentials, direct connection strings, and future service-role secrets out of `VITE_*` variables.

When a required prototype feature exposes a missing persistent field or relationship, update the canonical data model deliberately rather than silently deleting that user-visible capability from production.

## Documentation

Update the canonical document when behavior, configuration, architecture, access rules, workflows, or testing strategy change.

Do not duplicate a rule into multiple documents when a pointer to the source of truth is enough.

Each implementation phase must maintain a phase journal under `.docs/phases/`.

Use `.docs/phases/README.md` for the journal format and `.agents/skills/prometheus-phase-delivery/SKILL.md` for the delivery workflow.

A phase is not complete until its acceptance gate and required regression checks pass and its phase journal reflects the actual delivered result, meaningful decisions, lessons learned, limitations, and next approach.
