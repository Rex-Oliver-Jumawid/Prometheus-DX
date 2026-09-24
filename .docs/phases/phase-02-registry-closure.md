# Phase 2 - Registry Closure Addendum

## Status

**Complete**

This addendum is the final Phase 2 closure record.

It supersedes the older `In progress` and `Not complete` status text retained in `.docs/phases/phase-02-registry.md` as implementation history.

## Closure Decision

Phase 2 is complete because the canonical Phase 2 exit milestone in `.context/phases.md` is satisfied:

- Administrators can manage organization data.
- Members cannot access Registry through navigation, direct URL, or API.

Literal F2-21 execution requires a persisted non-admin Project Lead.

That relationship does not exist until Phase 3 Project Core.

F2-21 is therefore transferred to Phase 3 as a required regression rather than keeping Phase 2 open for a fixture that only a later phase can create.

This deferral does not weaken the authorization rule.

Project Lead remains project-specific and grants no Registry authority.

## Final Verification

Final Phase 2 closure verification on 2026-09-16:

- Focused Registry Member Playwright test: 1/1 passed.
- Full Playwright suite: 15/15 passed.
- `pnpm verify`: passed with 32 unit tests and both production builds.
- `pnpm prisma migrate status`: all five migrations applied and database schema up to date.
- Every live Member has a persisted Department relationship.
- `members.department_id` is `NOT NULL`.
- F2-16 passed with real Registry invitation delivery, Gmail receipt, Google-only Gmail setup, normalized-email linkage, activation, persisted `auth_user_id`, no duplicate Member, and successful subsequent access.
- E2E invitation delivery is deterministic and excludes every `BREVO_*` credential from the Playwright-owned API subprocess.
- Real Brevo delivery remains bounded by a server-side timeout and failed delivery does not falsely mark an invitation as sent.

## Acceptance Disposition

- F2-01, F2-02, F2-04 through F2-20, and F2-22 through F2-24: `PASS`.
- F2-03: `N/A` because canonical requirements do not forbid duplicate Department names.
- F2-21: `PASS` on 2026-09-16 during Phase 3 Slice 1 with a real persisted active non-admin Project Lead fixture.

## Executed Phase 3 Regression

As soon as Phase 3 persists the first real Project Lead relationship:

1. Use an active `MEMBER` who is Project Lead but not `ADMINISTRATOR`.
2. Verify Registry navigation is absent.
3. Verify direct `/registry` navigation is denied.
4. Verify a direct Registry API request returns forbidden.

The browser regression passed: Registry navigation was absent, direct `/registry` access was denied, and the direct Registry API request returned `403`.

No workspace-level Project Lead role was created.

## Post-Phase Maintenance - Department Reference Diagnostics

Phase 2 remains complete.

Registry Department deletion was improved after closure so Administrators can see why a Department with zero Members may still be undeletable.

A Department may remain referenced by Members, Project associations, or Outcome associations.
The Registry UI exposes those reference counts and the backend keeps relational integrity authoritative.

```text
0 Members
does not imply
0 Department references
```

Administrators must reassign Members and remove or change the applicable Project or Outcome associations before deleting a referenced Department.

Canonical deletion/reference semantics are documented in `.context/data-model.md`.

## Next Phase

Proceed to Phase 3 - Project Core.

The first implementation slice should establish Project persistence and authorization before replacing the `/projects` placeholder UI.

Keep `created_by_member_id` and `lead_member_id` as separate relationships.

All active authorized Members may view all Projects.

Any active authorized Member may create a Project.

Creating a Project grants no special authority by itself.

Administrator status grants no Project Lead authority by itself.
