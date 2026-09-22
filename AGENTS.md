# AGENTS.md

## Purpose

This file contains the always-active rules for coding agents working in Prometheus-DX.

Keep this file small enough to remain useful as persistent context.

Detailed procedures live under `.agents/skills/` and should be loaded only when relevant.

Prometheus-DX is the production implementation repository for the Prometheus Centralized Workflow Management System.

Changes must preserve product intent, authorization rules, architectural consistency, maintainability, visual quality, and the phased implementation strategy.

Do not treat prototype code as production architecture.

## Source of Truth

Before implementing behavior, identify which artifact owns the decision.

Use this hierarchy:

- `.context/Software Requirements Specification - Prometheus Centralized Workflow Management System.md` owns functional requirements, business rules, and product intent.
- `.context/user-flows.md` owns canonical authorization and workflow rules that must be enforced in production.
- `.context/data-model.md` owns the current persistent entities, relationships, constraints, history, and derived state.
- `.context/tech-stack.md` owns technical architecture and approved technologies.
- `.context/phases.md` owns implementation order, phase scope, dependencies, and exit criteria.
- `.context/ui-reference.md` owns the UI implementation reference policy.
- Figma is the source of truth for current UI layout, visual composition, navigation placement, spacing, typography, colors, icons, and component appearance.
- `.model/finalmodel.html` is an interaction and workflow reference for the main authenticated application where the target Figma frame does not fully specify behavior.
- `.model/login-page.html` is an authentication interaction reference where the target Figma frame does not fully specify behavior.
- `.testcases/` owns phase acceptance gates.
- `.docs/phases/` records what was actually implemented, important decisions, difficult problems, lessons, and next approaches.

For substantial user-facing implementation, inspect the relevant current Figma frame with the connected Figma integration before coding.

Use the HTML prototypes to fill interaction or workflow gaps that are not fully expressed by the Figma frame.

When Figma and an HTML prototype disagree about layout or visual presentation, follow Figma.

When they disagree about behavior, use the SRS and `.context/user-flows.md` to resolve the intended workflow unless a newer explicit product decision already resolves it.

Do not invent a different interaction simply because it is easier to implement.

Do not silently drop a prototype feature because the current data model does not yet support it.

If a prototype feature requires a missing persistent field or relationship, identify the mismatch and reconcile the canonical requirements and data model rather than deleting the prototype behavior from production.

Prototype JavaScript, mock state, DOM structure, and frontend-only permission checks are not production architecture.

Preserve the prototype experience while implementing it through React, NestJS, Prisma, PostgreSQL, Supabase, and the approved backend authorization model.

Security, authorization, and data-integrity rules must still be enforced on the backend.

If a genuine conflict exists between the required prototype experience and a security or persistence invariant, surface and resolve the conflict explicitly instead of silently weakening either side.

When sources disagree, use the source that owns that type of decision.

Do not silently choose the easiest implementation.

If equal-authority sources conflict, identify and resolve the conflict before permanently encoding the behavior.

## Agent Skills

Reusable workflows are stored under `.agents/skills/` so they can be used by different coding agents rather than being tied to one vendor-specific directory.

If the agent supports skill discovery, load the matching skill when its description applies.

If the agent does not support automatic skill discovery, read the relevant `SKILL.md` directly before performing that workflow.

Available project skills:

- Phase implementation, verification, documentation, or completion: `.agents/skills/prometheus-phase-delivery/SKILL.md`
- Bug diagnosis and fixes: `.agents/skills/prometheus-debugging/SKILL.md`
- User-facing UI implementation or substantial visual changes: `.agents/skills/prometheus-ui-implementation/SKILL.md`
- Prisma, migrations, constraints, or persistent data-model changes: `.agents/skills/prometheus-database-change/SKILL.md`

A task may require more than one skill.

Do not copy the full skill procedures back into this file.

## Phase Discipline

Implement Prometheus incrementally according to `.context/phases.md`.

Do not substantially implement later-phase product functionality unless it is required infrastructure for the active phase.

When implementation state is unclear, determine the earliest incomplete phase from repository evidence.

Every phase must have a live implementation journal under `.docs/phases/`.

A phase is not complete merely because the happy path works.

Phase completion requires the matching acceptance gate, appropriate regression of previous phases, and finalized phase documentation.

Use the phase-delivery skill for the complete workflow.

## Non-Negotiable Architecture Boundaries

Prometheus uses one coherent model of reality:

```text
Supabase Auth identifies the account.
Prometheus membership determines workspace access.
NestJS owns protected business rules and authorization.
Prisma is the primary database access layer.
PostgreSQL owns persistent business state.
React presents and interacts with server state.
Realtime supplements persistent state but never replaces it.
```

Frontend visibility is a UX feature, not a security boundary.

Every protected backend operation must independently authenticate and authorize the caller.

Do not trust client-supplied roles, member IDs, permissions, membership state, or cached browser state as authority.

Do not use frontend stores, local storage, realtime presence, or prototype state as replacements for persistent business records.

Prefer deriving values from canonical records rather than maintaining uncontrolled duplicate state.

## Authentication and Authorization

Authentication and Prometheus authorization are separate.

Successful Supabase authentication does not automatically grant access to Prometheus.

The authenticated identity must resolve to an authorized Prometheus member according to canonical requirements.

Keep these concepts separate:

```text
Organization Role
Project Lead authority
Project Member access
Outcome Membership
```

Never collapse them into one global role field.

## Critical Domain Invariants

Preserve these rules unless the canonical requirements explicitly change:

- Organization roles are `ADMINISTRATOR` and `MEMBER`.
- Administrator authority applies to organization-level functionality such as Registry.
- Administrator status does not automatically grant Project Lead authority.
- Project Lead is a relationship between one member and one project, not a global organization role.
- Any active authorized member may create a project where the requirements allow it.
- Project creation alone does not grant continuing authority beyond the canonical rules.
- Project Membership is derived from Outcome Membership.
- Project Members default to `CAN_VIEW`.
- Only the Project Lead may grant or revoke `CAN_EDIT` where specified by the canonical workflow.
- `CAN_EDIT` does not make a member the Project Lead.
- Outcome Membership is outcome-specific and must preserve required history.
- Do not add a normal leave mechanism for Outcome Membership unless requirements change.
- Submission history must be preserved.
- Acceptance and reopening history must be preserved.
- Reopening an outcome must preserve the records required by the canonical workflow.
- Schedule represents planned availability.
- Work Sessions represent actual Time In and Time Out activity.
- Presence must not replace persistent Work Session records.

## Engineering Approach

Prefer the smallest architecture and process that protects correctness, security, simplicity, maintainability, robustness, testability, and architectural consistency.

Prefer complete vertical slices over broad collections of unfinished layers.

Do not introduce abstractions merely for architectural appearance.

Keep modules cohesive and names domain-specific.

Use TanStack Query for server-managed frontend data.

Use Zustand only for shared temporary UI state when normal React state is insufficient.

Use React Hook Form for structured forms and Zod for runtime validation/shared contracts where appropriate.

Frontend validation improves UX, but backend validation remains mandatory.

Database models, API contracts, and UI view models are related but are not automatically identical.

## Security and Secrets

Never expose or commit:

- Supabase service-role credentials.
- Database credentials.
- Brevo credentials.
- Private secrets.
- Server-only environment variables.

Only expose environment variables intentionally designed for browser use.

File access, Registry operations, project actions, and workflow transitions must follow backend authorization.

## Verification

After a meaningful change, run the smallest relevant verification first and expand according to the change surface.

### Agent browser-test budget

During normal implementation and debugging, do not run the entire Chromium suite by default.

Agents must not run `pnpm test:e2e`, `pnpm verify:e2e`, `pnpm verify:release`, or a bare `pnpm exec playwright test` during the normal inner loop unless one of the broad-gate conditions below applies.

Start browser verification with the guarded focused runner:

```bash
pnpm test:e2e:focused -- tests/e2e/<relevant>.spec.ts -g "<relevant journey>"
```

The focused runner requires at least one explicit Playwright spec, accepts at most three spec files, forces Chromium, uses compact output, and stops after the first failure by default.

Prefer one spec and one matching `-g` journey first.

Expand to at most three directly affected specs only when the change surface justifies it.

If verification appears to require more than three Playwright specs or a large portion of the E2E suite, stop and identify why broader regression is needed before running it.

A full Chromium suite is appropriate only when the user explicitly requests it, when a phase or merge gate genuinely requires broad browser regression, when shared authentication/routing/shell/persistence changes make focused coverage insufficient, or in CI.

Firefox and WebKit remain release-level checks unless the task is specifically browser compatibility work.

Do not rerun a broad suite after a small follow-up fix when the failed or affected focused path can prove the correction first.

When reporting test results, summarize the command, pass/fail result, and relevant failures.

Do not paste long successful Playwright logs into the final report or agent context.

Use the lowest test layer that proves the behavior reliably.

The default ownership is:

```text
Pure logic, validation, permission calculations, service behavior
-> Vitest in the Node environment

React dialogs, forms, keyboard behavior, conditional rendering, local UI state
-> Vitest + React Testing Library + jsdom

API authorization, persistence, stale writes, concurrency
-> service or API integration tests without a browser where practical

Critical real user journeys across browser, authentication, API, and persistence
-> Playwright + Chromium

Cross-browser release confidence
-> Playwright + Firefox + WebKit

Visual fidelity, usability, and intentionally human phase checks
-> matching .testcases/ acceptance file
```

Do not default permission matrices, schema validation, service rules, or direct API status checks to Playwright when a lower layer proves them correctly.

Keep Playwright for behavior where the real browser, routing, authentication integration, frontend-to-backend interaction, refresh persistence, responsive behavior, or complete user journey is material to the evidence.

Component tests should own React interaction details that do not require a live backend.

Playwright tests should be independent whenever practical and provision the state they require.

Use a serial Playwright suite only when the real acceptance journey intentionally depends on sequential shared state.

Repository-level verification commands include:

```text
pnpm project:doctor
pnpm lint
pnpm typecheck
pnpm test
pnpm test:ui
pnpm build
pnpm test:e2e
pnpm test:e2e:cross-browser
pnpm verify
pnpm verify:e2e
pnpm verify:release
```

Use `pnpm verify` for the normal non-browser repository gate.

Use `pnpm verify:e2e` only for an intentional broad Chromium gate after focused browser verification has already passed.

Use `pnpm verify:release` for release-level Firefox and WebKit confidence rather than the normal development loop.

During ordinary feature work, use `pnpm test:e2e:focused -- <spec> [-g <journey>]` instead of `pnpm test:e2e`.

Use focused unit, component, service, API, or Chromium tests before these broad gates whenever a smaller check can provide faster feedback.

When a Playwright failure occurs, inspect retained traces and failure screenshots before increasing timeouts or retries.

Do not claim tests passed unless they were actually run.

Do not claim a bug is fixed unless the original reproduction path was verified after the change.

Do not hide known failures or unverified behavior.

Authentication, authorization, routing, persistence, and shared infrastructure require broader regression than isolated local changes.

## Documentation

Update the canonical document that owns behavior when that behavior changes.

Do not duplicate one rule into many documents when a reference is enough.

For phase work, keep the matching `.docs/phases/phase-XX-*.md` journal current as meaningful decisions and problems occur.

Do not reconstruct important engineering decisions only from memory at the end of the phase.

When writing or substantially editing long Markdown files, place each complete sentence on its own physical line.

Do not manually edit generated files when a canonical generator exists.

Never manually modify an auto-generated `CHANGELOG.md`.

## Git Safety

Keep commits focused and understandable.

Do not automatically add an agent, ChatGPT, Codex, bot, or other tool as a commit co-author.

Do not add agent-related `Co-authored-by` trailers.

Do not rewrite unrelated user changes.

Do not discard local modifications merely because they are outside the current task.

Avoid destructive Git operations unless explicitly required.

## Communication

Be concise about routine implementation details.

Explain decisions that materially affect future development.

When reporting completed work, state what changed, what important behavior was preserved, what verification was performed, what remains unverified, and any known limitation or risk.

## Code and Writing Style

Follow repository formatting, linting, and typechecking rules.

Prefer readable TypeScript and explicit domain terminology.

Avoid unnecessary `any`.

Use precise names such as `OutcomeMembership`, `ProjectMemberAccess`, `ProjectLead`, `WorkSession`, `Submission`, and `AcceptanceHistory` when those are the actual domain concepts.

Do not use the em dash character in documentation, comments, commit messages, or user-facing copy.

Use a normal hyphen instead.

## Lavish

Lavish is strictly opt-in.

Never invoke `lavish-axi` unless the user explicitly asks to use Lavish in the current request.

Requests for plans, reports, comparisons, prototypes, HTML, UI design, or visual explanations do not count as permission.

## Final Principle

When an implementation makes Prometheus's ownership boundaries less clear, simplify the design before expanding it.

Authentication identifies the user.

Registry determines workspace membership.

Projects determine Project Lead authority.

Outcome Membership determines outcome participation and derived Project Membership.

PostgreSQL owns persistent business state.

NestJS enforces protected business rules.

React presents that state.

Figma is the source of truth for current production UI layout and visual design.

`.model/finalmodel.html` and `.model/login-page.html` remain interaction references for behavior not fully represented by the target Figma frame.

Tests verify the behavior users depend on at the lowest reliable layer, with end-to-end coverage reserved for the workflows that genuinely require it.
