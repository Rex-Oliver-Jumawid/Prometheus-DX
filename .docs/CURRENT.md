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
- The Department slice implements persisted list, create, and edit behavior, including the prototype short label, behind Administrator-only Registry APIs.
- The member slice implements persistent listing, Department-ID assignment, invited-member creation, editing, organization role and status changes, duplicate-email protection, and backend-derived authentication linkage status.
- The invitation slice implements retryable Brevo delivery, durable delivery evidence, Supabase password or Google account setup, and backend-authoritative linkage to the existing Member row.
- The live first-sign-in acceptance path proves an invited Member becomes linked and active without creating a duplicate Member.
- The Brevo API v3 key was rotated after exposure, and an active verified `Prometheus-DX` sender remains configured locally.
- The retained `Brevo Acceptance Test` Member was resent through Registry, `invitation_sent_at` persisted, the UI changed to `Resend invitation`, and the invitation arrived in Gmail.
- Local Prisma runtime access through the Supabase transaction pooler on port `6543` is verified.
- `pnpm prisma migrate status` succeeds through the Supabase session pooler on port `5432` and reports all four migrations up to date.
- One Wi-Fi network blocked outbound PostgreSQL traffic to Supabase on ports `5432` and `6543` even though normal HTTPS access still worked.
- A mobile hotspot allowed both PostgreSQL paths, so if Prisma times out on that Wi-Fi, test the pooler ports with `nc` or switch networks before changing database configuration.
- Registry now highlights unassigned legacy Members and opens a deliberate Department-assignment workflow.
- The application shell has been reconciled against `.model/finalmodel.html` and Figma Registry node `11:1887`, including removal of invented collapse and duplicate top-right controls.
- Shared navigation and content surfaces now use the intended translucent glass treatment at desktop, compact, and mobile widths.
- Registry dialogs now render through a body-level portal so their fixed backdrop covers the viewport instead of being clipped by the workspace glass stacking context.
- Add/Edit Member and Add/Edit Department share the compact liquid-glass treatment and were visually checked at desktop and narrow viewports.
- The configured Supabase database has all four current migrations applied.
- `pnpm verify` passes with 27/27 unit tests, and the expanded live Playwright suite passes 13/13.
- The first-linkage concurrency race is resolved and five simultaneous live `/api/me` requests were verified successfully.
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

Figma is the visual source of truth for measurements, spacing, typography, icons, hierarchy, glass treatment, and responsive presentation.

Use Figma MCP or the connected Figma integration to inspect those details before substantial shell or page changes.

If Figma and `finalmodel.html` disagree, use Figma for presentation and `finalmodel.html` for functionality and interaction unless a canonical rule or explicit newer product decision overrides them.

Current Figma reference:

`https://www.figma.com/design/8zgQ4pcWtku7rSWzjlP9K9/Prometheus?node-id=11-1887`

File key: `8zgQ4pcWtku7rSWzjlP9K9`

Registry frame already inspected: `11:1887`, named `Registry`.

## Phase 2 Prototype Reconciliation

The Department `Short label` mismatch is resolved across the canonical data model, Prisma migration, shared contract, protected API, production dialog, and browser acceptance coverage.

The shell mismatch is also resolved by removing UI absent from the prototype and Figma and aligning the navigation hierarchy and shared glass surfaces.

## Next Action

Open the received `Brevo Acceptance Test` account-setup link and complete Supabase authentication with the invited email.

Verify normalized-email linkage to the existing Member row, no duplicate Member, active linked state, and subsequent resolution through `auth_user_id`.

Assign `DX User 1` to the Administrator-selected real Department through Registry.

Then confirm zero NULL Department relationships, apply the `members.department_id NOT NULL` migration, and run the complete Phase 2 acceptance gate.

Do not mark Phase 2 complete while the account-setup linkage check and the Department invariant remain incomplete.

Detailed Google, Password, or combined provider labels remain deferred until a trustworthy backend source is available.

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
- Use Figma and Figma MCP as the visual authority while keeping prototype behavior and canonical business rules in their own ownership boundaries.
- Do not silently omit prototype fields or interactions because the current production model lacks them; reconcile the mismatch instead.
- Preserve backend security, authorization, persistence, and data-integrity guarantees while reproducing the prototype experience.
- Do not mark Phase 2 complete until its acceptance gate, previous-phase regression, prototype reconciliation, and phase documentation are complete.

## Handoff Maintenance Rule

Update this file whenever the active phase changes, a major blocking issue changes the next step, the prototype source-of-truth policy changes, or a session ends at a materially different point than the one documented here.

Do not turn this into a detailed engineering diary.

Use the phase journal for permanent history and this file only for current handoff state.
