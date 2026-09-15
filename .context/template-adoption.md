# Application Template Adoption

Prometheus-DX selectively adopts reusable engineering conventions from `prometheus-inc/app-template` version `1.0.0`.
This is not a framework migration and Prometheus-DX is not intended to become a byte-for-byte instance of the template.

## Adopted conventions

- A repository-level `.nvmrc` pins the Node.js major version used by local development and CI.
- Prettier is available through `pnpm format` and `pnpm format:check`.
- `CONTRIBUTING.md` defines the branch, verification, documentation, and database-change workflow.
- `pnpm project:doctor` performs lightweight repository and environment-contract checks.
- CI uses read-only repository permissions, a job timeout, `.nvmrc` as the Node version source, and the project doctor before build verification.
- `.gitignore` includes the applicable dependency, build, test, environment, and local-tooling exclusions from the template.

## Existing Prometheus-DX foundations retained

- React + TypeScript + Vite remains the frontend architecture.
- NestJS remains the backend API architecture.
- Prisma remains the database schema and migration layer for Supabase PostgreSQL.
- Supabase Auth remains integrated through the existing browser and server environment contract.
- The existing Playwright smoke tests, Vitest tests, Prisma validation, and build pipeline remain the CI verification path.
- `AGENTS.md`, `.context/`, `.model/`, and `.testcases/` remain the project-specific sources of truth and implementation references.

## Template pieces intentionally not adopted

- `next.config.ts`, Next.js App Router conventions, React Server Components, and Server Actions are not applicable to the Vite/NestJS architecture.
- The template's local Supabase CLI database workflow, generated Supabase TypeScript database types, RLS test scripts, and database advisors are not copied because this repository currently uses Prisma migrations as its database source of truth.
- The template's `Customers` reference feature, shadcn configuration, reusable UI modules, and Next.js-specific frontend structure are not copied because Prometheus-DX has its own product model and design references.
- The template's `pnpm-lock.yaml` is not copied because lockfiles are dependency-graph specific and must be generated from Prometheus-DX itself.
- The template's `TEMPLATE_VERSION` file is not copied because that file represents the reusable template release itself rather than this application.

## Future template alignment

When adopting another template convention, first verify that it matches the Vite, NestJS, Prisma, and Supabase architecture documented in `.context/tech-stack.md`.
Prefer adapting the intent of a template convention over copying framework-specific implementation details.
