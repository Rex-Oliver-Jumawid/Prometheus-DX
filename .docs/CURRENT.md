# Current Prometheus Work

This file is the lightweight handoff point for future development sessions.

It should answer two questions quickly:

1. Where did the previous session stop?
2. What should the next agent do first?

Keep this file concise and current.

Permanent implementation history and architectural lessons belong in `.docs/phases/`.

Canonical requirements still belong in `.context/`.

## Current Phase

Phase 2 - Registry

## Previous Phase

Phase 1 - Authentication and Application Shell

Status: Complete

Phase 1 browser acceptance result: 8/8 Playwright tests passed in the local acceptance run.

Phase 0 - Foundation is also complete.

## Current State

- Phase 0 foundation is complete.
- Phase 1 authentication and application shell are complete.
- Real Supabase email/password authentication works.
- Google OAuth works.
- Prometheus workspace authorization is separate from Supabase authentication.
- Protected routes, session persistence, profile/sign-out, role-aware navigation, Registry gating, Member restriction, and deactivated-member denial have been verified.
- Phase 2 Registry is in progress.
- The first Phase 2 vertical slice implements persisted department list, create, and edit behavior behind Administrator-only Registry APIs.
- The Department Prisma model, staged Member-to-Department foreign key, shared Registry contracts, Registry page, department dialog, and focused browser acceptance test are now part of the implementation.
- Existing Phase 1 members intentionally retain a nullable `department_id` until the member-assignment slice provides a deliberate backfill path.
- Project workflows are split between concise always-on rules in `AGENTS.md` and reusable procedures under `.agents/skills/`.
- `.context/ui-reference.md` now defines `.model/finalmodel.html` as the prototype source of truth for the main application experience.

## Required Session Startup

Before making implementation changes in a new session:

1. Read `AGENTS.md`.
2. Read this file.
3. Read `.agents/skills/prometheus-phase-delivery/SKILL.md`.
4. Read `.context/ui-reference.md` before substantial user-facing work.
5. Read the Phase 2 section of `.context/phases.md`.
6. Read `.docs/phases/phase-02-registry.md`.
7. Read `.testcases/phase-02-registry-tests.md`.
8. Read the Registry-related requirements in the SRS, user flows, data model, and tech stack.
9. Inspect the current Registry frontend, backend, Prisma model, and authorization implementation before changing code.
10. For substantial user-facing implementation, run or inspect the relevant workflow in `.model/finalmodel.html` first and load `.agents/skills/prometheus-ui-implementation/SKILL.md`.
11. Use Figma MCP or an equivalent connected Figma integration as a helper for visual detail when available.

Load additional project skills when relevant:

- UI work: `.agents/skills/prometheus-ui-implementation/SKILL.md`
- Debugging: `.agents/skills/prometheus-debugging/SKILL.md`
- Prisma or persistent data changes: `.agents/skills/prometheus-database-change/SKILL.md`

## Prototype Source of Truth

For the main authenticated application, `.model/finalmodel.html` is the prototype source of truth.

The app being built should reproduce the user-visible experience demonstrated there rather than invent a different workflow.

When a control, field, modal, drawer, navigation path, state, or interaction exists in `finalmodel.html`, assume it belongs in production unless the user explicitly changes that product decision.

If the current implementation differs from the prototype, reconcile the difference instead of automatically treating the implementation as correct.

The production implementation should preserve the prototype experience while replacing prototype-only mock logic with real React, NestJS, Prisma, PostgreSQL, Supabase, validation, and backend authorization.

Figma is a helper reference only.

Use Figma MCP or the connected Figma integration for measurements, screenshots, variables, spacing, typography, icons, frame structure, and other visual details that help reproduce the prototype accurately.

If Figma and `finalmodel.html` disagree about the application experience, follow `finalmodel.html` unless an explicit newer user decision says otherwise.

Current Figma helper reference:

`https://www.figma.com/design/8zgQ4pcWtku7rSWzjlP9K9/Prometheus?node-id=17-4603&t=9bvq2LAHiC0GPJs7-1`

File key: `8zgQ4pcWtku7rSWzjlP9K9`

Starting node: `17:4603`

Registry helper frame already inspected: `11:1887`, named `Registry`.

## Phase 2 Prototype Reconciliation Required

The Registry department prototype in `.model/finalmodel.html` includes `name`, `Short label`, and `description` in the add-department flow.

The current production slice intentionally omitted `Short label` because the existing canonical Department model did not contain that field.

Under the updated prototype-source-of-truth policy, that omission is now an unresolved prototype-to-data-model mismatch rather than a settled implementation decision.

Before treating the department slice as final, inspect the prototype behavior again and reconcile the missing `Short label` capability with the canonical requirements, data model, API contract, migration, UI, and acceptance coverage, unless the user explicitly decides to remove that field from the prototype itself.

Do not silently keep the production omission merely because the first slice was already implemented.

The existing Phase 2 journal entry P2-D05 should be revisited under this updated source-of-truth policy.

## Next Action

First reconcile the current Registry department implementation against `.model/finalmodel.html`, especially the prototype-only `Short label` field and any other visible behavior that the current production slice omitted.

Then apply `prisma/migrations/20260916000000_registry_departments/migration.sql` or its reconciled successor to the configured development database and run the focused Registry department browser acceptance flow.

Compare the rendered `/registry` workflow directly against `finalmodel.html` in a browser.

Use Figma frame `11:1887` only as an additional visual helper for fine details.

After the department slice matches the intended prototype behavior and passes verification, continue with the next complete vertical slice for member listing and add/edit member workflows, including Department-ID assignment and Administrator-only backend enforcement.

Do not implement authentication-mode labels by guessing from frontend state.

Resolve detailed authentication status from a trustworthy backend source when that member slice reaches the authentication-status requirement.

## Phase 2 Working Rules

- Only `ADMINISTRATOR` may access Registry.
- Project Lead status must not grant Registry access.
- Hiding Registry in the frontend is not sufficient security.
- Registry APIs must enforce Administrator authorization on the backend.
- Maintain `.docs/phases/phase-02-registry.md` while implementing, not only at phase completion.
- Record meaningful engineering decisions using stable IDs such as `P2-D01`, `P2-D02`, and so on.
- For each major decision or difficult problem, record what was difficult, the root cause or constraint, options considered, proposed solution, final decision, result, lesson learned, and next approach.
- Implement in complete vertical slices.
- Run focused verification after meaningful changes.
- Treat `.model/finalmodel.html` as the prototype source of truth for the main application experience.
- Use Figma and Figma MCP as supporting implementation helpers, not as the authority over the prototype.
- Do not silently omit prototype fields or interactions because the current production model lacks them; reconcile the mismatch instead.
- Preserve backend security, authorization, persistence, and data-integrity guarantees while reproducing the prototype experience.
- Do not mark Phase 2 complete until its acceptance gate, previous-phase regression, prototype reconciliation, and phase documentation are complete.

## Handoff Maintenance Rule

Update this file whenever the active phase changes, a major blocking issue changes the next step, the prototype source-of-truth policy changes, or a session ends at a materially different point than the one documented here.

Do not turn this into a detailed engineering diary.

Use the phase journal for permanent history and this file only for current handoff state.