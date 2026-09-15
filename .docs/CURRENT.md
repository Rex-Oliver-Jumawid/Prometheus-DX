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

## Required Session Startup

Before making implementation changes in a new session:

1. Read `AGENTS.md`.
2. Read this file.
3. Read `.agents/skills/prometheus-phase-delivery/SKILL.md`.
4. Read the Phase 2 section of `.context/phases.md`.
5. Read `.docs/phases/phase-02-registry.md`.
6. Read `.testcases/phase-02-registry-tests.md`.
7. Read the Registry-related requirements in the SRS, user flows, data model, and tech stack.
8. Inspect the current Registry frontend, backend, Prisma model, and authorization implementation before changing code.
9. For substantial user-facing implementation, inspect the relevant interaction in `.model/finalmodel.html` and load `.agents/skills/prometheus-ui-implementation/SKILL.md`.
10. Confirm Figma MCP or an equivalent connected Figma integration is configured and can access the Prometheus design file before substantial production UI work.
11. Inspect the relevant Figma design through that live connection before writing or substantially changing production UI.

Load additional project skills when relevant:

- UI work: `.agents/skills/prometheus-ui-implementation/SKILL.md`
- Debugging: `.agents/skills/prometheus-debugging/SKILL.md`
- Prisma or persistent data changes: `.agents/skills/prometheus-database-change/SKILL.md`

## Current Prototype and Figma References

For Registry interaction behavior, inspect `.model/finalmodel.html`.

The current department prototype opens `+ Add department` in a modal and includes name, short label, and description fields.

Production intentionally omits the prototype-only short label because the canonical Department model contains only name and description.

Use this user-selected Prometheus Figma reference during implementation:

`https://www.figma.com/design/8zgQ4pcWtku7rSWzjlP9K9/Prometheus?node-id=17-4603&t=9bvq2LAHiC0GPJs7-1`

File key: `8zgQ4pcWtku7rSWzjlP9K9`

Starting node: `17:4603`

For best design fidelity, future coding sessions should have Figma MCP or an equivalent connected Figma integration configured before substantial UI implementation.

Use the live Figma connection to inspect the actual node, design context, screenshot, dimensions, variables, components, and other available design metadata instead of relying only on the URL or static screenshots.

If the Figma connection is unavailable or cannot access the file, state that limitation explicitly and treat visual verification as incomplete rather than guessing.

The node is accessible through the connected Figma integration in the current ChatGPT environment and is currently named `Outcome Workspace Top`.

Treat it as a visual entry point into the current Prometheus design file, including the shared authenticated workspace shell and visual language.

The Registry-specific frame already inspected for Phase 2 is `11:1887`, named `Registry`.

When implementing another Phase 2 state or interaction, inspect the relevant Registry-specific frame or descendant/reference in the same file rather than guessing from screenshots or from this starting node alone.

Do not infer authorization, persistence, or business rules from Figma.

Those remain governed by the canonical repository requirements.

## Next Action

Apply `prisma/migrations/20260916000000_registry_departments/migration.sql` to the configured development database and run the focused Registry department browser acceptance flow.

Inspect the rendered `/registry` page against Figma frame `11:1887` at desktop and narrow viewport sizes, and correct any visual or interaction regressions before expanding scope.

After the department slice is verified, continue with the next complete vertical slice for member listing and add/edit member workflows, including Department-ID assignment and Administrator-only backend enforcement.

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
- Inspect the relevant `.model/` interaction and Figma through Figma MCP or the connected integration for substantial user-facing work.
- Use `.model/` for intended interaction behavior, Figma for visual detail, and canonical requirements for data, authorization, and persistence.
- If live Figma access is unavailable, disclose it and do not claim visual verification is complete.
- Do not mark Phase 2 complete until its acceptance gate, previous-phase regression, and phase documentation are complete.

## Handoff Maintenance Rule

Update this file whenever the active phase changes, a major blocking issue changes the next step, the primary Figma implementation reference changes, or a session ends at a materially different point than the one documented here.

Do not turn this into a detailed engineering diary.

Use the phase journal for permanent history and this file only for current handoff state.
