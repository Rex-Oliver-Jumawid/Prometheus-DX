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
- Do not silently omit a prototype field or interaction merely because the current data model does not support it. Reconcile the requirements and persistence model instead.
- Do not treat prototype JavaScript, DOM structure, mock state, or frontend-only permission checks as production architecture or backend authority.
- Read the matching implementation journal in `.docs/phases/` when one already exists so previous decisions and lessons are carried forward.
- Resolve genuine security, authorization, architecture, and data-integrity conflicts explicitly before encoding contradictory production behavior.

## Branches and commits

- Branch from `main` with a short-lived `feat/`, `fix/`, `chore/`, or `refactor/` branch.
- Keep each pull request focused on one phase, feature, fix, or infrastructure change.
- Use conventional commit prefixes such as `feat:`, `fix:`, `chore:`, `test:`, `docs:`, and `refactor:`.
- Prefer squash merging after focused review and passing CI.

## Verification

Run the non-browser verification suite before opening a pull request:

```bash
pnpm verify
```

`pnpm verify` includes the repository configuration doctor, linting, TypeScript checks, unit tests, and the production build.

Formatting remains a separate explicit check until the current stylesheet and UI source are normalized:

```bash
pnpm format:check
```

Run Playwright for routing, authentication, critical workflow, or UI behavior changes:

```bash
pnpm test:e2e
```

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

Update the canonical document when behavior, configuration, architecture, access rules, or workflows change.

Do not duplicate a rule into multiple documents when a pointer to the source of truth is enough.

Each implementation phase must maintain a phase journal under `.docs/phases/`.

Use `.docs/phases/README.md` for the journal format and `.agents/skills/prometheus-phase-delivery/SKILL.md` for the delivery workflow.

A phase is not complete until its acceptance gate and required regression checks pass and its phase journal reflects the actual delivered result, meaningful decisions, lessons learned, limitations, and next approach.