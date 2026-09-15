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

The prototype also includes a `Short label` field, but that field is intentionally not implemented because it is absent from the canonical Department data model.

Use this user-selected Prometheus Figma reference during Phase 2 user-facing implementation:

`https://www.figma.com/design/8zgQ4pcWtku7rSWzjlP9K9/Prometheus?node-id=17-4603&t=9bvq2LAHiC0GPJs7-1`

File key: `8zgQ4pcWtku7rSWzjlP9K9`

Starting node: `17:4603`

The connected Figma integration can access this node, which is currently named `Outcome Workspace Top`.

This node should be treated as an entry point into the current Prometheus visual system and authenticated workspace shell, not as a replacement for a Registry-specific frame.

The Registry-specific frame inspected for the first user-facing slice is `11:1887` and is named `Registry`.

Figma governs visual design only.

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

Member CRUD, department assignment, workspace role changes, activation/deactivation, and authentication-mode status remain for the next slices.

## Database Changes

Migration: `prisma/migrations/20260916000000_registry_departments/migration.sql`

The migration adds the `departments` table with `id`, `name`, `description`, `created_at`, and `updated_at`.

The migration adds `members.department_id`, its index, and a foreign key to `departments.id` with delete restriction.

`members.department_id` is intentionally nullable during this staged Phase 2 migration so existing Phase 1 member rows are not assigned invented organization data.

The relationship should be tightened only after the member-assignment slice provides a deliberate backfill path for existing members.

No uniqueness constraint is currently applied to department names because the canonical requirements do not define one.

## API Changes

All Registry endpoints remain protected by `SupabaseAuthGuard`, `RolesGuard`, and the class-level `ADMINISTRATOR` workspace-role requirement.

The first slice adds:

- `GET /api/registry/departments`
- `POST /api/registry/departments`
- `PATCH /api/registry/departments/:departmentId`

Create and edit requests use the shared Zod department schema and reject blank department names before persistence.

The frontend API helper now supports JSON request bodies and explicit HTTP methods while preserving the existing response-schema validation and API error handling.

## UI Changes

`/registry` now renders the first real Registry page after the existing Administrator access check succeeds.

The page follows the visual language of Figma Registry frame `11:1887`, including the warm frosted surface, Registry heading treatment, Administrator-access pill, summary cards, structure panel, department cards, and orange primary action.

The create interaction follows `.model/finalmodel.html` by opening a focused department modal from `+ Add department`, supporting backdrop and Escape dismissal, and returning to the Registry after a successful save.

The production dialog adds edit mode because department editing is a canonical Phase 2 requirement even though the current prototype only demonstrates creation.

The prototype-only `Short label` input is omitted because the canonical Department model defines only `name` and `description`; Figma and prototype state do not create new persistence requirements.

The department dialog traps focus while open, restores focus to the invoking control when closed, labels every form control, exposes validation errors, and prevents accidental dismissal while a save request is pending.

The Members panel currently carries only the canonical membership context because member management is outside this first vertical slice.

## Environment / Configuration Changes

No new environment variables are required for the department slice.

The existing `E2E_MEMBER_EMAIL` and `E2E_MEMBER_PASSWORD` credentials are reused by the live Registry browser acceptance test when configured.

## Testing and Acceptance

Acceptance source:

```text
.testcases/phase-02-registry-tests.md
```

The first slice adds `tests/e2e/registry-departments.spec.ts` for the Administrator browser flow.

The test exercises blank-name prevention, department creation, persistence after refresh, department editing, and persistence after a second refresh.

These checks cover the current implementation surface of F2-01, F2-02, and F2-04.

F2-03 remains conditional because duplicate department names are not currently forbidden by canonical requirements.

F2-05 will be completed by the member-assignment slice because existing Phase 1 members do not yet have department assignments.

When the shared live E2E member credential is configured, Playwright uses one worker so Registry acceptance cannot race Phase 1 tests that temporarily change that same member's role or access status.

Phase 1 authentication-shell regression must continue to pass before Phase 2 can exit.

Focused CI and live browser results should be recorded here after this slice is pushed and exercised against a configured database.

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

### P2-D05 - Keep prototype interaction without adding prototype-only Department fields

**Status:** Accepted

**Area:** Frontend, Database, Product

**Impact:** Medium

#### What gave us a hard time

The current `.model/finalmodel.html` department modal contains a `Short label` input, while the canonical Department data model defines only `name` and `description`.

#### Root cause / constraint

Repository rules make the prototype authoritative for intended interaction behavior but explicitly keep canonical requirements authoritative for persistence and business rules.

#### Options considered

1. Add a new `short_label` field to the database because the prototype contains it.
2. Ignore the prototype entirely and design a different department interaction.
3. Preserve the modal interaction while omitting the prototype-only field that is not part of the canonical model.

#### Proposed solution

Use the prototype's add-department modal behavior and Figma's Registry visuals without expanding the Department persistence contract beyond canonical requirements.

#### Decision

The production dialog uses the prototype's modal interaction with canonical `name` and optional `description` fields only.

#### Why we chose it

This keeps interaction fidelity without allowing a prototype implementation detail to create an undocumented business field.

#### Result

Department creation behaves like the documented prototype and persists only canonical Department data.

#### What we learned

Prototype and Figma review works best when each source is used for its intended layer instead of copying every visible field into production architecture.

#### Next approach

Apply the same reconciliation rule to member-management UI: prototype for interaction, Figma for visuals, and canonical requirements for data and authorization.

#### Related changes

- `.model/finalmodel.html`
- `.context/data-model.md`
- `src/features/registry/RegistryPage.tsx`
- `shared/contracts/registry.ts`

## Known Limitations

Member list management, department assignment, role changes, activation/deactivation, and detailed authentication status are not implemented yet.

Existing Phase 1 Member rows may have `department_id = NULL` until the next Registry slice assigns them deliberately.

The live Registry E2E test requires configured Supabase browser credentials and an Administrator member account, so credential-free CI skips that acceptance path.

## Technical Debt

The nullable `members.department_id` relationship is intentional transitional debt and should be revisited before Phase 2 exit.

The current live E2E setup still depends on one mutable shared account and should move to dedicated role-specific fixtures.

## Lessons From This Phase

The Registry prototype is useful for interaction behavior, while Figma guides visual language and neither source overrides canonical authorization or data-model rules.

The existing Phase 1 class-level Registry guards are a strong seam because new department endpoints inherit backend Administrator enforcement automatically.

The Department entity is a useful first persistence boundary because later member assignment can reference a stable organization record instead of duplicating free-text department names.

## Recommendations / Next Approach

- Apply the new migration to the configured development database.
- Run the focused Registry browser acceptance test with the Administrator E2E credential.
- Inspect the rendered Registry page against Figma frame `11:1887` at desktop and narrow viewport sizes.
- Keep the Phase 1 browser suite green.
- Build the next slice around member listing plus add/edit member workflows, using Department IDs rather than free-text organization fields.
- Resolve authentication-mode status from a trustworthy backend source rather than inferring it from UI state.
- Introduce dedicated role-specific E2E fixtures before the complete Phase 2 acceptance run.

## Phase Exit Result

**Not complete.**

Phase 2 may be marked complete only after implementation, acceptance, regression, and this document are finalized.
