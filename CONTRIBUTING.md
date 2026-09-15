# Contributing

Keep changes phase-focused, easy to review, and aligned with the Prometheus source-of-truth documents.

## Before coding

- Read `AGENTS.md` for repository-specific implementation guidance.
- Read the relevant section in `.context/phases.md` before starting implementation work.
- Read the matching requirements in `.context/`, then use Figma and `.model/` only as visual and interaction references.
- Resolve requirement, access-control, and data-model conflicts in the canonical planning documents before encoding them in code.

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

For bug fixes, reproduce the problem through the closest end-to-end user flow before changing the implementation.
For each implementation phase, also complete the matching manual acceptance checks in `.testcases/`.

## Database and configuration changes

- Keep Prisma schema changes and their migrations together.
- Run `pnpm prisma:generate` and `pnpm prisma:validate` after Prisma changes.
- Update `.env.example` whenever a new required environment variable is introduced, but never commit real secrets.
- Keep database credentials, direct connection strings, and future service-role secrets out of `VITE_*` variables.

## Documentation

Update the canonical document when behavior, configuration, architecture, access rules, or workflows change.
Do not duplicate a rule into multiple documents when a pointer to the source of truth is enough.
