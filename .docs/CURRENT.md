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
- Phase documentation exists under `.docs/phases/`.
- Phase 2 Registry journal has been initialized.
- Project workflows are now split between concise always-on rules in `AGENTS.md` and reusable procedures under `.agents/skills/`.

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
9. For user-facing implementation, load `.agents/skills/prometheus-ui-implementation/SKILL.md` and inspect the Figma design through the connected Figma tooling before writing or substantially changing UI.

Load additional project skills when relevant:

- UI work: `.agents/skills/prometheus-ui-implementation/SKILL.md`
- Debugging: `.agents/skills/prometheus-debugging/SKILL.md`
- Prisma or persistent data changes: `.agents/skills/prometheus-database-change/SKILL.md`

## Current Figma Reference

Use this user-selected Prometheus Figma reference during implementation:

`https://www.figma.com/design/8zgQ4pcWtku7rSWzjlP9K9/Prometheus?node-id=17-4603&t=9bvq2LAHiC0GPJs7-1`

File key: `8zgQ4pcWtku7rSWzjlP9K9`

Starting node: `17:4603`

The node is accessible through the connected Figma integration and is currently named `Outcome Workspace Top`.

Treat it as a visual entry point into the current Prometheus design file, including the shared authenticated workspace shell and visual language.

When implementing a specific Phase 2 screen, use the Figma integration to inspect the relevant Registry-specific frame or descendant/reference in the same file rather than guessing from screenshots or from this starting node alone.

Do not infer authorization, persistence, or business rules from Figma.

Those remain governed by the canonical repository requirements.

## Next Action

Begin Phase 2 by reviewing the canonical Registry requirements and the existing implementation, then define the first complete vertical slice before writing production code.

Do not jump directly into UI construction without first resolving the Phase 2 data model, API boundaries, authorization requirements, and acceptance cases that the first slice depends on.

When the first user-facing Registry slice is ready to implement, inspect the current Figma reference and the relevant Registry frame through the Figma integration before coding the visual layer.

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
- Inspect Figma through the connected integration for substantial user-facing work instead of relying only on screenshots or prototype HTML.
- Do not mark Phase 2 complete until its acceptance gate, previous-phase regression, and phase documentation are complete.

## Handoff Maintenance Rule

Update this file whenever the active phase changes, a major blocking issue changes the next step, the primary Figma implementation reference changes, or a session ends at a materially different point than the one documented here.

Do not turn this into a detailed engineering diary.

Use the phase journal for permanent history and this file only for current handoff state.
