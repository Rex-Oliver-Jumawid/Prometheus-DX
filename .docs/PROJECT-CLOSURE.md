# Prometheus Current Release Closure

## Release Status

**Complete for the defined current release scope as of 2026-09-25.**

This document records the final reconciliation of the implementation, canonical requirements, phase journals, acceptance files, operational documentation, and known post-release backlog.

The purpose of this closure is to prevent already-delivered work from remaining indefinitely marked as unfinished merely because an older phase journal still contained an interim status.

It also prevents the opposite mistake: deferred features are listed explicitly rather than being described as implemented.

## Phase Disposition

| Phase | Scope | Release disposition |
| --- | --- | --- |
| 0 | Foundation | Complete |
| 1 | Authentication and Application Shell | Complete |
| 2 | Registry | Complete |
| 3 | Project Core | Complete |
| 4 | Project Workflow Structure | Complete |
| 5 | Outcome Work, Submission, Review, and Dependencies | Complete |
| 6 | Schedule, Work Sessions, and Team | Complete |
| 7 | Notifications and Home | Complete |
| 8 | VisiWork and Reports & Analytics | Complete |
| 9 | Collaboration and Live Updates | Complete for current release scope |

The canonical status index is `.docs/phases/README.md`.

## Delivered Product Boundary

The current release includes:

- Supabase authentication and Prometheus workspace authorization.
- Registry Department and Member administration.
- invitation/account-setup delivery.
- forgot-password and reset-password recovery.
- Project creation, status, Lead assignment, and company-wide visibility.
- Project Members with `CAN_VIEW` / `CAN_EDIT`.
- Project editor authority for Stage/Outcome management, review, revision, acceptance/reopening, and dependency overrides.
- Outcome Membership, Features, Tasks, output drafts, shared submissions, review/revision, acceptance, reopening, dependency behavior, and history.
- Schedule configuration.
- persisted WorkSessions, Time In / Time Out, correction handling, Team visibility, and Working Now.
- persisted Notifications and context navigation.
- Home command-center aggregation.
- VisiWork Department and Project operational views.
- Reports & Analytics.
- VisiWork General and Department chat.
- Project Chat.
- replies.
- message search and exact-message navigation.
- mentions and mention notifications.
- author edit/delete with soft deletion.
- company-wide Project Chat participation and announcement posting for all active authorized employees; Lead-only announcement pinning.
- company-visible display-safe Project Activity for every active authorized member, including employees who are not part of the Project.
- automatic collaboration refresh and reconnect/focus recovery from persistent records.
- automatic notification inbox and unread-count refresh with focus/reconnect recovery.
- Messenger-style Project Chat search behavior where Clear removes the search target and sending returns the conversation to the newest messages.

## Canonical Documentation Added During Closure

### Derived metrics

`.context/derived-metrics.md` now owns the exact definitions for:

- Project progress.
- Home Working Now.
- Active Projects.
- Awaiting Review.
- Revision Requests.
- My Week actual/planned values.
- Reports Project Health.
- Outcome Pipeline.
- Member and overall capacity.
- Department workload.
- VisiWork working-member and grouping derivations.

Future implementations must not redefine the same metric independently.

### Authorization

`.context/authorization.md` centralizes the current role/relationship matrix while preserving the detailed workflow rules in `.context/user-flows.md`.

### Operations

- `.docs/DEPLOYMENT.md`
- `.docs/ENVIRONMENT.md`
- `.docs/DEVELOPMENT.md`

These documents now cover Vercel, Supabase, Prisma migrations, Brevo, Auth redirects, password recovery, environment-variable safety, worktrees, port conflicts, Prisma generation, health checks, deployment rate limits, and rollback/redeploy considerations.

### UI orientation

`.context/ui-reference.md` now includes a central Figma frame index for known pinned frames and named frames whose current node should be resolved before substantial visual work.

## Phase Reassessment Summary

### Phase 5

The implementation journal already contained substantial signed-in browser evidence, including a distinct-account core suite covering the real delivery workflow.

Later service/component/integration coverage and the `CAN_EDIT` permission amendment were reconciled into the current authorization rules.

The phase is closed.

### Phase 7

Notifications and Home were already integrated.

The remaining gap was primarily documentation and closure reconciliation.

Home metrics are now canonical and the Reports Quick Access shortcut is correctly documented as active.

The phase is closed.

### Phase 8

VisiWork and Reports & Analytics were already integrated.

Reports formulas are now canonical rather than living only in UI/model code.

The phase is closed.

### Phase 9

Durable collaboration was already implemented across VisiWork and Projects.

The release live-update decision is now explicit:

```text
PostgreSQL persistence
+
short-interval polling
+
mutation invalidation
+
background refresh
+
focus refetch
+
reconnect refetch
```

This provides automatic live updates and missed-state recovery without introducing a second message source of truth.

The phase is closed around that current release strategy.

## Deliberate Post-Release Backlog

The following are **not implemented** and are intentionally outside the current release closure:

1. Binary Project/VisiWork chat attachments.
2. Dedicated Outcome-specific discussion UI/API.
3. Optional Supabase Realtime push transport.
4. Assistant Lead permissions.
5. Archived Project restore workflow.
6. Final long-term audit/data-retention policy.
7. Additional credential-gated cross-browser/multi-user release automation.

These items should be opened as new, independently scoped product work rather than silently reopening completed phases.

The nullable Project-message Outcome scope and Supabase Storage architecture leave room for future collaboration extensions without claiming they exist today.

## Verification Evidence

The repository CI run on green release-baseline commit `bcb0c83dcdab7cdc9cd48ed05fe1843e3f37c170` completed successfully.

That baseline contains the Project Chat search/send behavior, CAN_EDIT authorization amendments, phase closure reconciliation, canonical metrics/authorization documents, and operational runbooks.

Subsequent maintenance commits add automatic notification refresh and further documentation/test cleanup; use the latest `main` CI result as the current verification state.

That run includes the standard verification pipeline:

- project configuration checks.
- Prisma generation and schema validation.
- lint.
- typecheck.
- unit/service tests.
- React component tests.
- production build.
- PostgreSQL Project Chat integration/migration verification.
- Chromium browser smoke tests.

Credential-gated Playwright tests are skipped when their identities are not configured.
A skipped test must never be described as passed.

The acceptance files remain repeatable regression checklists even though their owning phases are closed.

## Deployment State Is Separate From Product Completion

A GitHub/Vercel deployment failure caused specifically by the Vercel Hobby build-rate limit is an infrastructure/account quota condition, not evidence that the code failed compilation.

Production still requires:

1. required Prisma migrations applied explicitly.
2. a successful Vercel deployment of the intended `main` commit.
3. health checks.
4. production smoke testing.

Use `.docs/DEPLOYMENT.md` for the operational procedure.

## Maintenance Rule After Closure

Do not reopen a completed phase merely because a new feature request touches the same screen.

For future work:

```text
new product capability
-> define current product rule
-> update canonical docs
-> implement
-> add focused regression
-> record as maintenance or new scoped work
```

Only reopen a phase if the release decision itself is intentionally reversed.

## Final Principle

Prometheus release completion means the documented current product boundary is implemented, persisted, authorized, testable, and operationally understood.

It does **not** mean no future feature can be added.

The repository now separates:

```text
completed release scope
from
explicit post-release backlog
```

so future development can continue without carrying stale "in progress" phase state.
