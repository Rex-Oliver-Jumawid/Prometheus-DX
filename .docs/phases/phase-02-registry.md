# Phase 2 - Registry

## Status

**In progress**

This document is the live implementation journal for Phase 2.
It should be updated during implementation and finalized before Phase 2 is marked complete.

## Objective

Create the organization-level source of truth for departments, members, workspace roles, access status, and authentication linkage.

## Planned Scope

- `/registry`
- Members view
- Departments view
- Add Member modal or drawer
- Edit Member modal or drawer
- Department create/edit interface
- Member activation/deactivation controls
- Authentication status display
- Administrator-only Registry APIs

## Current Prototype and Figma References

For interaction behavior, inspect `.model/finalmodel.html` before substantial Registry UI changes.

The Registry prototype uses an Administrator-only Registry page with separate Departments and Members surfaces.

Its department flow opens a modal from `+ Add department`, focuses the department-name field, supports backdrop and Escape dismissal, validates the required name, and confirms creation before returning to the Registry view.

The prototype's `Short label` field is implemented as persisted Department metadata with a 12-character maximum.

Use this user-selected Prometheus Figma reference during Phase 2 user-facing implementation:

`https://www.figma.com/design/8zgQ4pcWtku7rSWzjlP9K9/Prometheus?node-id=11-1887`

File key: `8zgQ4pcWtku7rSWzjlP9K9`

Registry node: `11:1887`

The inspected frame includes the surrounding application shell as well as the Registry content.

Figma governs visual layout and presentation while `.model/finalmodel.html` governs functional interaction.

Registry behavior, access control, persistence, validation, and workflow remain governed by the canonical repository requirements.

## Security Rules Carried Forward From Phase 1

1. Only `ADMINISTRATOR` may access Registry.
2. Project Lead status does not grant Registry authority.
3. Frontend visibility is not authorization.
4. Every Registry API endpoint must enforce Administrator authorization server-side.
5. Supabase authentication identity remains separate from Prometheus organization membership.
6. Deactivated members must not retain workspace access.
7. Authentication linkage should use the stable Supabase user ID after initial account linkage.

## Implementation Strategy

The preferred order is:

```text
Requirements / data model review
        |
        v
Prisma schema + migration
        |
        v
Administrator-protected Registry APIs
        |
        v
Shared contracts and validation
        |
        v
Registry queries and mutations
        |
        v
Inspect Registry interaction in `.model/finalmodel.html`
        |
        v
Inspect Registry-specific Figma frame
        |
        v
Members / Departments UI
        |
        v
Manual + automated acceptance
        |
        v
Finalize this document
```

The backend authorization and data model should be established before relying on the final Registry UI.

## First Vertical Slice

The first Phase 2 vertical slice is department management.

It runs end to end through the Prisma model and migration, Administrator-protected NestJS endpoints, shared Zod contracts, TanStack Query data flow, React Hook Form validation, and the Figma-aligned Registry interface.

The slice includes department listing, persisted creation, persisted editing, member-count display, loading and error states, empty state handling, and accessible create/edit dialog interactions.

The second vertical slice adds member listing, Department-ID assignment, invited-member creation, member editing, organization role changes, member status changes, and backend-derived authentication linkage status.

## Database Changes

Migration: `prisma/migrations/20260916000000_registry_departments/migration.sql`

The migration adds the `departments` table with `id`, `name`, `short_label`, `description`, `created_at`, and `updated_at`.

The migration adds `members.department_id`, its index, and a foreign key to `departments.id` with delete restriction.

`members.department_id` is intentionally nullable during this staged Phase 2 migration so existing Phase 1 member rows are not assigned invented organization data.

The relationship should be tightened only after the member-assignment slice provides a deliberate backfill path for existing members.

No uniqueness constraint is currently applied to department names because the canonical requirements do not define one.

The migration also adds a case-insensitive unique index on `LOWER(members.email)` because one email address must identify at most one Prometheus membership regardless of letter casing.

A pre-migration query confirmed that the configured database contained no conflicting case-insensitive member emails.

The migration has been applied to the configured Supabase database and `prisma migrate status` reports the schema as up to date.

## API Changes

All Registry endpoints remain protected by `SupabaseAuthGuard`, `RolesGuard`, and the class-level `ADMINISTRATOR` workspace-role requirement.

The current slices add:

- `GET /api/registry/departments`
- `POST /api/registry/departments`
- `PATCH /api/registry/departments/:departmentId`
- `GET /api/registry/members`
- `POST /api/registry/members`
- `PATCH /api/registry/members/:memberId`

Create and edit requests use the shared Zod department schema and reject blank department names before persistence.

Member writes validate the Department ID, normalize email input, enforce case-insensitive email uniqueness at both service and database boundaries, and prevent an unlinked invited member from being marked active.

The frontend API helper now supports JSON request bodies and explicit HTTP methods while preserving the existing response-schema validation and API error handling.

## UI Changes

`/registry` now renders the first real Registry page after the existing Administrator access check succeeds.

The page follows the visual language of Figma Registry frame `11:1887`, including the warm frosted surface, Registry heading treatment, Administrator-access pill, summary cards, structure panel, department cards, and orange primary action.

The create interaction follows `.model/finalmodel.html` by opening a focused department modal from `+ Add department`, supporting backdrop and Escape dismissal, and returning to the Registry after a successful save.

The production dialog adds edit mode because department editing is a canonical Phase 2 requirement even though the current prototype only demonstrates creation.

The department dialog persists the prototype's `Short label` input and derives an eight-character fallback from the Department name when it is left blank.

The department dialog traps focus while open, restores focus to the invoking control when closed, labels every form control, exposes validation errors, and prevents accidental dismissal while a save request is pending.

The Members panel now lists real persistent membership data and exposes add and edit dialogs for full name, email, Department, position, organization role, and lifecycle status.

New members begin in `INVITED` state and must use a persisted Department ID.

Existing Phase 1 members remain visible as unassigned until an Administrator edits their record.

Authentication status is derived on the backend from the stable Supabase `auth_user_id` linkage and is displayed only as `Linked` or `Setup pending`.

Provider combinations such as Google, Password, or Google plus Password are not fabricated because the current backend does not have a trustworthy provider-detail source.

The application shell was reconciled against the full Registry Figma frame and `.model/finalmodel.html`.

The invented `Collapse sidebar` row, duplicate top-right profile control, duplicate notification control, and redundant opaque content cards were removed.

Registry and Notifications now occupy the intended sidebar footer, the single profile card remains at the bottom, root-page breadcrumbs stay hidden, and shared shell surfaces use the Figma-aligned translucent glass treatment.

At narrow widths the desktop rail becomes an overlay drawer opened by the existing menu affordance without adding a persistent collapse control.

## Environment / Configuration Changes

No new environment variables are required for the department slice.

The existing `E2E_MEMBER_EMAIL` and `E2E_MEMBER_PASSWORD` credentials are reused by the live Registry browser acceptance test when configured.

## Testing and Acceptance

Acceptance source:

```text
.testcases/phase-02-registry-tests.md
```

The current slices add `tests/e2e/registry-departments.spec.ts` and `tests/e2e/registry-members.spec.ts` for Administrator browser flows.

The test exercises blank-name prevention, department creation, persistence after refresh, department editing, and persistence after a second refresh.

These checks cover the current implementation surface of F2-01, F2-02, and F2-04.

F2-03 remains conditional because duplicate department names are not currently forbidden by canonical requirements.

F2-05 will be completed by the member-assignment slice because existing Phase 1 members do not yet have department assignments.

When the shared live E2E member credential is configured, Playwright uses one worker so Registry acceptance cannot race Phase 1 tests that temporarily change that same member's role or access status.

Phase 1 authentication-shell regression must continue to pass before Phase 2 can exit.

The member test exercises invalid email validation, invited-member creation, Department assignment, setup-pending authentication display, persistence after refresh, case-insensitive duplicate rejection, editing, role and status changes, and persistence after a second refresh.

The Phase 1 shell regression now also verifies that a normal Member receives `403` from the member Registry API and cannot navigate to `/registry`.

Verification completed on 2026-09-16:

- `pnpm prisma:validate` passed.
- `pnpm prisma:generate` passed.
- `pnpm exec prisma migrate status` reported three migrations and an up-to-date database.
- `pnpm verify` passed, including project doctor, lint, typecheck, 16 unit tests, web build, and API build.
- `pnpm test:e2e tests/e2e/registry-members.spec.ts` passed 1/1.
- `pnpm test:e2e` passed 10/10 across Phase 0, Phase 1, Departments, and Members.
- Authenticated rendered inspection passed at 1244 by 642, 900 by 700, and 390 by 844 viewports with no document-level horizontal overflow.
- The mobile navigation overlay and internal member-table scrolling were inspected after transition completion.
- Department and member dialogs were verified for initial focus, Escape dismissal, backdrop dismissal, and focus restoration to the invoking control.

# Decision & Challenge Log

### P2-D01 - Start Phase 2 with a complete department-management slice

**Status:** Resolved

**Area:** Backend, Frontend, Database, Product

**Impact:** High

#### What gave us a hard time

Phase 2 contains data modeling, authorization, member lifecycle, authentication linkage, and a visually dense Registry screen that could easily encourage horizontal scaffolding.

#### Root cause / constraint

The phase workflow requires complete vertical slices and explicitly warns against starting with UI before data, API, authorization, and acceptance dependencies are resolved.

#### Options considered

1. Build the entire Registry at once.
2. Build backend-only scaffolding first.
3. Choose one acceptance-backed organization capability and carry it end to end.

#### Proposed solution

Use department management as the first slice because member assignment depends on departments and the capability has clear persistence and UI acceptance cases.

#### Decision

Implement department list, create, and edit through Prisma, protected NestJS APIs, shared validation, TanStack Query, React Hook Form, and the Registry UI before beginning member management.

#### Why we chose it

This creates a real user-visible capability while establishing the Phase 2 data and authorization boundaries that later member work can reuse.

#### Result

The first slice has a narrow stable API and a Figma-aligned user interface without fabricating member or authentication data.

#### What we learned

Registry can grow safely by extending one protected organization workflow at a time rather than rendering the whole final screen against placeholder state.

#### Next approach

Apply and exercise the migration in the configured development environment, then build the member list and add/edit flow on top of the department contract.

#### Related changes

- `prisma/schema.prisma`
- `server/registry/*`
- `shared/contracts/registry.ts`
- `src/features/registry/*`
- `tests/e2e/registry-departments.spec.ts`

### P2-D02 - Stage the Member to Department relationship as nullable

**Status:** Revisit later

**Area:** Database

**Impact:** High

#### What gave us a hard time

The canonical model says a Member has one primary Department, but Phase 1 already created real Member rows before Department existed.

#### Root cause / constraint

Making `department_id` immediately required would require inventing a default department, deleting existing members, or blocking migration on organization data that is not yet available.

#### Options considered

1. Create an automatic default department.
2. Make the migration destructive.
3. Require a manual pre-migration backfill.
4. Add the relationship as nullable during the first slice and tighten it later.

#### Proposed solution

Add a nullable foreign key now and make the member-assignment slice responsible for deliberate backfill and eventual tightening.

#### Decision

`members.department_id` is nullable during the staged Phase 2 rollout.

#### Why we chose it

It preserves valid Phase 1 accounts without silently assigning incorrect organization data.

#### Result

Department persistence can ship independently while existing authentication and authorization records remain usable.

#### What we learned

Schema correctness sometimes needs a staged migration when a new invariant is introduced after production-like data already exists.

#### Next approach

Require department selection for newly managed members, provide an explicit path to assign existing members, then evaluate a follow-up `NOT NULL` migration before Phase 2 exit.

#### Related changes

- `prisma/schema.prisma`
- `prisma/migrations/20260916000000_registry_departments/migration.sql`

### P2-D03 - Do not invent department-name uniqueness

**Status:** Accepted

**Area:** Product, Database

**Impact:** Medium

#### What gave us a hard time

The Phase 2 acceptance matrix includes duplicate-name rejection only when duplicate departments are forbidden, but the canonical requirements do not currently define that rule.

#### Root cause / constraint

A database uniqueness constraint would create a new business rule rather than implement an existing one.

#### Options considered

1. Enforce case-sensitive uniqueness.
2. Enforce case-insensitive uniqueness.
3. Permit duplicate names until the product requirement is explicit.

#### Proposed solution

Keep names indexed for lookup and ordering without a uniqueness constraint.

#### Decision

Duplicate department names are currently permitted.

#### Why we chose it

The implementation should not hard-code an organization rule that the SRS, user flows, and data model do not specify.

#### Result

F2-03 remains not applicable under the current canonical requirements.

#### What we learned

Conditional acceptance cases should not be converted into hidden business rules by implementation convenience.

#### Next approach

If the product requirement later forbids duplicates, add the rule to the canonical requirements first and then enforce it at validation and database boundaries.

#### Related changes

- `.testcases/phase-02-registry-tests.md`
- `prisma/schema.prisma`
- `shared/contracts/registry.ts`

### P2-D04 - Serialize live E2E tests that share one mutable member account

**Status:** Accepted

**Area:** Testing

**Impact:** Medium

#### What gave us a hard time

Phase 1 browser tests temporarily change the shared E2E member's workspace role and access status, while Registry acceptance needs that same account to remain an Administrator.

#### Root cause / constraint

Fully parallel browser execution can make two otherwise correct tests race on the same persistent member row.

#### Options considered

1. Accept the race.
2. Duplicate the Registry test into the Phase 1 serial file.
3. Add a second dedicated account immediately.
4. Serialize browser workers only when the shared live credential is configured.

#### Proposed solution

Keep normal CI smoke tests parallel when no live credential is present and use one Playwright worker when the configured shared member credential is in use.

#### Decision

`playwright.config.ts` now selects one worker only for live shared-account acceptance runs.

#### Why we chose it

This prevents test interference without permanently reducing parallelism for credential-free CI smoke coverage.

#### Result

Phase 1 role/status mutation and Phase 2 Registry acceptance cannot overlap when they use the same account.

#### What we learned

Shared mutable external fixtures need explicit serialization until dedicated isolated fixtures are introduced.

#### Next approach

Introduce deliberate role-specific E2E fixtures before the Phase 2 full acceptance gate so future suites can regain safe parallel execution.

#### Related changes

- `playwright.config.ts`
- `tests/e2e/auth-shell.spec.ts`
- `tests/e2e/registry-departments.spec.ts`

### P2-D05 - Persist the prototype Department short label

**Status:** Accepted

**Area:** Frontend, Database, Product

**Impact:** Medium

#### What gave us a hard time

The current `.model/finalmodel.html` department modal contains a `Short label` input that the first production slice omitted.

#### Root cause / constraint

The field is part of the approved product workflow and has a clear persistence purpose, but the earlier canonical data-model document had not recorded it.

#### Options considered

1. Keep omitting the field.
2. Store it only in frontend state.
3. Reconcile the canonical model and persist the field through the full vertical slice.

#### Proposed solution

Add `Department.short_label` with the prototype's 12-character limit and carry it through migration, contract, API, UI, and acceptance coverage.

#### Decision

The production dialog persists `name`, `shortLabel`, and optional `description`.

#### Why we chose it

This makes the approved product behavior explicit in the canonical data model rather than maintaining a known mismatch.

#### Result

Department create and edit now persist the short label, including across reloads.

#### What we learned

Prototype reconciliation must be resolved explicitly when the prototype exposes durable product metadata that the canonical model has not yet recorded.

#### Next approach

Continue using prototype behavior, Figma presentation, and canonical authorization together without silently dropping visible product fields.

#### Related changes

- `.model/finalmodel.html`
- `.context/data-model.md`
- `src/features/registry/RegistryPage.tsx`
- `shared/contracts/registry.ts`

### P2-D06 - Reconcile the shared shell before expanding Registry

**Status:** Accepted

**Area:** Frontend, Product

**Impact:** High

#### What gave us a hard time

The production shell had drifted into a generic dashboard with a persistent collapse row, duplicate account and notification controls, and opaque nested cards.

#### Root cause / constraint

Earlier implementation approximated the shell without treating the complete Registry Figma frame and the real prototype as one product surface.

#### Options considered

1. Preserve existing controls and only restyle them.
2. Redesign the shell from common dashboard patterns.
3. Remove unreferenced controls and rebuild the shared surfaces from the prototype and Figma evidence.

#### Proposed solution

Use one reusable liquid-glass shell treatment, keep the prototype navigation hierarchy, and remove controls not supported by the prototype, Figma, or canonical requirements.

#### Decision

Registry and Notifications live in the sidebar footer above one profile card, root breadcrumbs are hidden, and there is no persistent desktop collapse row or duplicate top-right account area.

#### Why we chose it

This preserves the actual Prometheus product identity and removes UI that had no product source.

#### Result

The shell now matches the Figma frame at desktop and compact widths and uses an overlay rail on mobile without document-level overflow.

#### What we learned

Shell fidelity requires inspecting the entire reference frame, not only the page content or individual components.

#### Next approach

Reuse the same shell primitives as later phase pages replace their placeholders.

#### Related changes

- `src/features/shell/*`
- `src/styles/globals.css`
- `tests/e2e/auth-shell.spec.ts`

### P2-D07 - Enforce member email identity and report only trustworthy authentication state

**Status:** Accepted

**Area:** Backend, Database, Security, Frontend

**Impact:** High

#### What gave us a hard time

The prototype displays detailed authentication labels, but current Prometheus persistence only has a stable Supabase user linkage and does not expose authoritative provider combinations.

#### Root cause / constraint

Frontend inference would fabricate security-relevant state, while email duplicates differing only by case could create ambiguous membership identity.

#### Options considered

1. Infer provider labels from member status or email.
2. Display only durable linkage state and defer provider detail.
3. Hide all authentication information.

#### Proposed solution

Derive `Linked` versus `Setup pending` from `auth_user_id`, normalize email input, and enforce case-insensitive email uniqueness in PostgreSQL as well as the service layer.

#### Decision

The Registry reports only trustworthy linkage state and rejects duplicate emails regardless of letter casing with a useful `409` response.

#### Why we chose it

Authentication presentation must come from backend authority, and database integrity must remain correct under concurrent writes.

#### Result

Member creation and editing are reliable without pretending to know whether Google, Password, or both are configured.

#### What we learned

It is better to expose a narrower truthful status than a visually richer guessed status.

#### Next approach

Add provider-detail labels only after a backend integration can query them authoritatively.

#### Related changes

- `prisma/migrations/20260916000000_registry_departments/migration.sql`
- `server/registry/registry.service.ts`
- `shared/contracts/registry.ts`
- `tests/e2e/registry-members.spec.ts`

## Known Limitations

Invitation email delivery and account-setup completion are not implemented yet.

Detailed authentication-provider combinations are unresolved because the current backend only has the stable Supabase user linkage.

Existing Phase 1 Member rows may have `department_id = NULL` until the next Registry slice assigns them deliberately.

The live Registry E2E tests require configured Supabase browser credentials and an Administrator member account, so credential-free CI skips those acceptance paths.

## Technical Debt

The nullable `members.department_id` relationship is intentional transitional debt and should be revisited before Phase 2 exit.

The current live E2E setup still depends on one mutable shared account and should move to dedicated role-specific fixtures.

The web production bundle still emits the existing Vite chunk-size warning and should be split when page-level loading boundaries are introduced.

## Lessons From This Phase

The Registry prototype is useful for interaction behavior, while Figma guides visual language and neither source overrides canonical authorization or data-model rules.

The existing Phase 1 class-level Registry guards are a strong seam because new department endpoints inherit backend Administrator enforcement automatically.

The Department entity is a useful first persistence boundary because later member assignment can reference a stable organization record instead of duplicating free-text department names.

## Recommendations / Next Approach

- Implement real invitation delivery and account-setup completion without weakening the separation between Supabase authentication and Prometheus membership.
- Provide an Administrator workflow to assign the existing unassigned Phase 1 member, then evaluate the follow-up `department_id NOT NULL` migration.
- Add authoritative authentication-provider detail only if the backend can obtain it from Supabase.
- Complete the remaining Phase 2 activation, deactivation, and project-impact acceptance cases as their dependent project records become available.
- Introduce dedicated role-specific E2E fixtures before the complete Phase 2 acceptance run.

## Phase Exit Result

**Not complete.**

Phase 2 may be marked complete only after implementation, acceptance, regression, and this document are finalized.
