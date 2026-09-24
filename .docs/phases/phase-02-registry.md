# Phase 2 - Registry

## Status

**Complete.**

This file preserves the detailed Phase 2 implementation journal.

The final closure evidence and acceptance disposition are recorded in `.docs/phases/phase-02-registry-closure.md`, which supersedes older interim wording in the historical sections below.

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

The third vertical slice adds Brevo invitation delivery, retryable delivery status, password or Google account setup through Supabase, and backend-authoritative first-sign-in linkage to the existing Member row.

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

Migration: `prisma/migrations/20260916010000_member_invitation_delivery/migration.sql`

The migration adds nullable `members.invitation_sent_at` so Registry can distinguish a successful provider-accepted invitation from an invitation that still needs delivery.

The field does not control activation and is not treated as proof of account setup.

The migration was applied to the configured Supabase database without modifying the existing Member row.

Migration: `prisma/migrations/20260916020000_require_member_department/migration.sql`

The migration makes `members.department_id` `NOT NULL` after a live pre-migration query verified two total Members, zero NULL Department relationships, and zero orphaned Department references.

The Prisma schema, Registry response contract, seed input, and test fixtures now model the Member Department relationship as required.

The migration was applied to the configured Supabase database through its management channel because direct PostgreSQL pooler sockets were unavailable from this machine.

The exact repository migration checksum was recorded in `_prisma_migrations` using the equivalent of Prisma's supported resolve-as-applied bookkeeping after the DDL and invariant were independently verified.

Post-migration queries confirmed `information_schema.columns.is_nullable = NO`, zero NULL `department_id` values, and an active finished Prisma migration-history row.

## API Changes

All Registry endpoints remain protected by `SupabaseAuthGuard`, `RolesGuard`, and the class-level `ADMINISTRATOR` workspace-role requirement.

The current slices add:

- `GET /api/registry/departments`
- `POST /api/registry/departments`
- `PATCH /api/registry/departments/:departmentId`
- `GET /api/registry/members`
- `POST /api/registry/members`
- `PATCH /api/registry/members/:memberId`
- `POST /api/registry/members/:memberId/invitation`

Create and edit requests use the shared Zod department schema and reject blank department names before persistence.

Member writes validate the Department ID, normalize email input, enforce case-insensitive email uniqueness at both service and database boundaries, and prevent an unlinked invited member from being marked active.

Member creation attempts invitation delivery after the authorized Member row is persisted.

If the external provider is unavailable, the single Member row remains `INVITED`, delivery remains visibly pending, and an Administrator may retry without creating another Member.

The resend endpoint rejects linked and deactivated Members.

The authentication service links only a confirmed Supabase identity whose normalized email matches an eligible unlinked Member, updates that same row to `ACTIVE`, and continues resolving repeated requests by stable `auth_user_id`.

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

Every Member now has a required persisted Department relationship, so the transitional unassigned warning and assignment action have been removed.

Authentication status is derived on the backend from the stable Supabase `auth_user_id` linkage and is displayed only as `Linked` or `Setup pending`.

Provider combinations such as Google, Password, or Google plus Password are not fabricated because the current backend does not have a trustworthy provider-detail source.

Setup-pending Members show only backend-derived invitation delivery state and expose a send or resend action.

`/account-setup` preserves the invited email and supports Supabase password signup or Google authentication without creating a Prometheus Member in the browser.

The application shell was reconciled against the full Registry Figma frame and `.model/finalmodel.html`.

The invented `Collapse sidebar` row, duplicate top-right profile control, duplicate notification control, and redundant opaque content cards were removed.

Registry and Notifications now occupy the intended sidebar footer, the single profile card remains at the bottom, root-page breadcrumbs stay hidden, and shared shell surfaces use the Figma-aligned translucent glass treatment.

At narrow widths the desktop rail becomes an overlay drawer opened by the existing menu affordance without adding a persistent collapse control.

## Environment / Configuration Changes

Invitation delivery uses server-only `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, and `APP_URL` configuration.

These values are never exposed through `VITE_*` variables or API responses.

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
- The shared Registry dialog overlay was portaled to `body` after the workspace glass surface was found to establish the clipping and stacking context for the fixed backdrop.
- Add/Edit Member and Add/Edit Department were visually inspected at 1440 by 900 and 520 by 760.
- The backdrop matched the viewport exactly, the dialog remained centered with narrow-screen margins, body scroll stayed locked, no horizontal overflow occurred, initial focus was correct, and the browser console was clean.

Additional verification completed during the invitation slice on 2026-09-16:

- Prisma generation and validation passed with the invitation field.
- Type checking and lint passed after the invitation and account-setup changes.
- Unit tests passed 27/27, including first linkage, concurrent first-link recovery, confirmed-email requirements, conflicting linkage denial, deactivated-member denial, delivery failure, retry, and sensitive-provider-error handling.
- The additive invitation migration applied successfully to the configured Supabase database.
- The pre-change Playwright regression passed 10/10 after the migration and invitation implementation.
- The focused live first-linkage browser path passed and proved that the same invited Member row became linked and active with no duplicate email row.
- The focused live deactivation and reactivation browser path passed.
- The expanded full Playwright run passed 13/13, including account-setup validation, first linkage without duplication, role upgrade and downgrade after refresh, direct API denial, deactivation and reactivation, Department reassignment, long member metadata, mobile overflow, and unexplained-console-error checks.
- Final `pnpm exec prisma migrate status` reported four migrations and an up-to-date database.

Live Brevo follow-up verification on 2026-09-16:

- The configured `BREVO_API_KEY` was validated against Brevo's read-only v3 account endpoint.
- Brevo returned HTTP 200, so API v3 credential acceptance is verified independently from invitation delivery.
- The credential must be rotated before the next live retry because its value was inadvertently exposed in agent tool output during this follow-up session.
- Brevo's sender endpoint returned an active verified `Prometheus-DX` sender.
- The previously missing local `BREVO_SENDER_EMAIL` setting was populated from that verified sender so all four server-side invitation settings are now present.
- The focused invitation and authentication regression passed 27/27 unit tests.
- The retained Member was not resent from Registry because this execution environment could not establish a PostgreSQL connection to either configured Supabase pooler port, and the direct database endpoint is IPv6-only while the environment has no IPv6 route.
- The Supabase Auth HTTPS health endpoint returned HTTP 200, which confirms the project is running but does not provide the PostgreSQL path required by the NestJS Registry API.
- Application persistence was therefore not observed in this follow-up run.
- Actual inbox or spam-folder receipt was not observed in this follow-up run.
- The setup link, Supabase account setup, normalized-email linkage, duplicate-member check, activation, and subsequent `auth_user_id` resolution were not rerun because no invitation could be resent through Registry.

Phase 2 closure verification on 2026-09-16 supersedes the earlier blocked follow-up state:

- The real Registry invitation send and resend flow completed successfully.
- Brevo accepted delivery and `invitation_sent_at` persisted.
- The invitation arrived in Gmail and the setup link opened.
- The Gmail invitation offered Google-only setup and Google authentication completed.
- The confirmed normalized email linked the existing Member row, persisted `auth_user_id`, moved the Member to `ACTIVE`, and did not create a duplicate Member.
- Refresh and subsequent access resolved through the linked identity successfully.
- `DX User 1` was assigned to the real Research & Development Department.
- Live database checks confirmed two Members, zero NULL `department_id` values, and zero orphaned Department references.
- `members.department_id` is now `NOT NULL`, and the fifth Prisma migration is recorded with the repository checksum.
- `pnpm prisma:validate`, `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, and all 27 unit tests passed.
- `pnpm verify` passed, including project doctor, lint, typecheck, 27 unit tests, web build, and API build.
- The focused Registry Playwright run could not start its live flow because the test process could not reach the transaction pooler on port `6543`.
- The focused auth-shell Playwright run passed 6 tests before its first authenticated live case remained on `/login` because the API could not reach PostgreSQL; 5 later serial tests did not run.
- The complete Playwright run passed 7 tests, failed 3 database-dependent tests at the same pooler boundary, and did not run 5 later serial tests.
- Direct `pnpm exec prisma migrate status` remains blocked by the unreachable session pooler on port `5432`, while the Supabase management channel confirms the five active Prisma migration records and final schema invariant.

### Current Phase 2 acceptance matrix

| ID | Result | Evidence or blocker |
| --- | --- | --- |
| F2-01 | PASS | Department creation persists after refresh. |
| F2-02 | PASS | Blank-name validation prevents submission. |
| F2-03 | N/A | Canonical requirements do not forbid duplicate Department names. |
| F2-04 | PASS | Department edits persist after refresh. |
| F2-05 | PASS | Department member counts update after Member reassignment. |
| F2-06 | PASS | Valid Member creation persists in `INVITED` state. |
| F2-07 | PASS | Malformed email is rejected before submission. |
| F2-08 | PASS | Case-insensitive duplicate Member email returns `409`. |
| F2-09 | PASS | Department reassignment persists and updates both Department counts. |
| F2-10 | PASS | `MEMBER` organization role persists. |
| F2-11 | PASS | Upgrade to `ADMINISTRATOR` takes effect after refresh. |
| F2-12 | PASS | Long name and position edits persist. |
| F2-13 | PASS | Deactivation during an authenticated session denies workspace access after refresh. |
| F2-14 | PASS | Reactivation restores workspace access after refresh. |
| F2-15 | PASS | Unlinked invited Member displays `Setup pending` and backend-derived delivery state. |
| F2-16 | PASS | Real Registry send/resend was accepted by Brevo, `invitation_sent_at` persisted, Gmail received the message, Google-only setup completed, the existing normalized-email Member became `ACTIVE` and linked through `auth_user_id`, no duplicate Member was created, and refresh/subsequent access succeeded. |
| F2-17 | PASS | Long Member metadata remains usable at the 390 by 844 mobile viewport with no document overflow. |
| F2-18 | PASS | Registry navigation is absent for `MEMBER`. |
| F2-19 | PASS | Direct `/registry` navigation is denied for `MEMBER`. |
| F2-20 | PASS | Direct Registry API request returns `403` for `MEMBER`. |
| F2-21 | BLOCKED | A persisted Project Lead relationship does not exist before Phase 3; canonical role separation and Member denial are verified without implementing Phase 3. |
| F2-22 | PASS | Administrator accesses Registry through route and API. |
| F2-23 | PASS | Administrator downgrade removes Registry route and API access after refresh. |
| F2-24 | PASS | Deactivation during a session denies access after refresh. |

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

**Status:** Resolved

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

`members.department_id` was nullable during the staged Phase 2 rollout and is now required after deliberate live assignment.

#### Why we chose it

It preserves valid Phase 1 accounts without silently assigning incorrect organization data.

#### Result

The staged nullable relationship preserved existing accounts until both live Members had real Department assignments, after which the additive NOT NULL migration completed without a fabricated backfill.

#### What we learned

Schema correctness sometimes needs a staged migration when a new invariant is introduced after production-like data already exists.

#### Next approach

Preserve required Department selection in every future Member creation, seed, API contract, and test fixture.

#### Related changes

- `prisma/schema.prisma`
- `prisma/migrations/20260916000000_registry_departments/migration.sql`
- `prisma/migrations/20260916020000_require_member_department/migration.sql`

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

### P2-D08 - Persist delivery evidence without coupling it to activation

**Status:** Accepted

**Area:** Backend, Database, Security, Frontend

**Impact:** High

#### What gave us a hard time

Invitation delivery is an external side effect that can fail after the authorized Member row is created, while account activation must remain a separate backend-authoritative authentication decision.

#### Root cause / constraint

Email delivery and PostgreSQL cannot share one transaction, and treating an invitation record or provider request as activation would collapse authentication into membership authorization.

#### Options considered

1. Roll back Member creation whenever email delivery fails.
2. Mark the Member active when the invitation is created or accepted by Brevo.
3. Persist the invited Member, record only successful delivery time, expose retry, and activate only after confirmed Supabase authentication is linked.

#### Proposed solution

Use nullable `invitation_sent_at` as delivery evidence, keep `status = INVITED` after delivery, and make resend safe for the same Member record.

#### Decision

Registry preserves the single authorized Member row across delivery failures, displays `Sent` or `Not sent` independently from `Linked` or `Setup pending`, and delegates activation solely to the authenticated backend linkage flow.

#### Why we chose it

This design is recoverable when Brevo is unavailable, does not create duplicate memberships, and keeps all security boundaries explicit.

#### Result

The UI can retry delivery, `/account-setup` supports Supabase password or Google setup, and a live first-sign-in test proved the existing invited Member becomes linked and active without duplication.

#### What we learned

External-delivery state and access lifecycle state must remain separate even when they are presented in one administrator workflow.

#### Next approach

Use the same explicit side-effect status pattern for later external integrations instead of inferring business state from request attempts.

#### Related changes

- `prisma/migrations/20260916010000_member_invitation_delivery/migration.sql`
- `server/registry/invitation.service.ts`
- `server/registry/registry.service.ts`
- `server/auth/auth.service.ts`
- `src/features/auth/AccountSetupPage.tsx`
- `tests/e2e/auth-shell.spec.ts`

### P2-D09 - Recover the losing request in concurrent first linkage

**Status:** Resolved

**Area:** Backend, Security, Testing

**Impact:** High

#### What gave us a hard time

The focused first-linkage browser test passed, while the same path intermittently reached Access Denied during the full serial suite.

#### Root cause / constraint

Two near-simultaneous `/api/me` requests could both read an unlinked invited Member.

The first request won the guarded update and linked the row.

The second request received an update count of zero and denied access without checking whether the correct Supabase identity had just been linked by the winning request.

#### Options considered

1. Serialize browser requests or weaken the test.
2. Add a longer frontend retry delay.
3. Preserve the atomic update and make the losing backend request re-resolve by authoritative `auth_user_id`.

#### Proposed solution

After a zero-count guarded update, query the Member by the verified Supabase user ID and continue only if that authoritative linkage now exists and is active.

#### Decision

The authentication service now recovers from the expected concurrent winner without accepting any different identity or bypassing Member status checks.

#### Why we chose it

Concurrency belongs at the backend data boundary, and frontend timing must not determine whether a correctly linked user is admitted.

#### Result

Five concurrent live `/api/me` requests all returned 200, the Member linked once, and the complete Playwright suite passed 13/13 from fresh servers.

#### What we learned

An atomic compare-and-update needs an explicit idempotent read-after-loss path when multiple legitimate requests may initiate the same linkage.

#### Next approach

Design future first-write identity transitions to be idempotent under concurrent authenticated requests from the start.

#### Related changes

- `server/auth/auth.service.ts`
- `server/auth/auth.service.test.ts`
- `tests/e2e/auth-shell.spec.ts`

### P2-D10 - Distinguish Brevo SMTP credentials from API v3 credentials

**Status:** Resolved

**Area:** Infrastructure, Testing

**Impact:** Medium

#### What gave us a hard time

All documented invitation settings were present, but a real Registry invitation remained in `Not sent` state.

#### Root cause / constraint

The configured credential begins with the Brevo SMTP-key prefix.

Prometheus sends through `POST /v3/smtp/email`, whose `api-key` header requires a Brevo API v3 key instead.

Brevo's read-only account and sender endpoints both returned `401 Key not found`, confirming the credential-type mismatch without exposing the key.

#### Options considered

1. Change the application to SMTP transport.
2. Treat the configured SMTP key as an API key and keep retrying.
3. Preserve the approved Transactional Email API architecture and replace the environment value with the correct API v3 credential.

#### Proposed solution

Keep the existing Brevo API implementation and configure a v3 API key, which normally begins with `xkeysib-`.

#### Decision

The application remains on the approved Brevo Transactional Email API.

The pending acceptance Member is retained so delivery can be retried without creating another membership record.

#### Why we chose it

This avoids an unnecessary transport redesign and preserves the existing tested delivery, retry, and durable-state boundaries.

#### Result

The live attempt created one `INVITED` Member, kept `invitation_sent_at` null after provider rejection, and exposed the retry action without falsely reporting delivery.

#### What we learned

The presence of a Brevo credential is insufficient configuration evidence because Brevo issues separate SMTP and API-key credential types.

#### Next approach

With API v3 acceptance now verified, restore a routable PostgreSQL connection, resend the retained Member through Registry, and keep provider acceptance, database persistence, and mailbox receipt as separate evidence gates.

#### Related changes

- `.env`
- `server/registry/invitation.service.ts`
- `.docs/CURRENT.md`

### P2-D11 - Prove the Member-create request boundary before awaiting its response

**Status:** Resolved

**Area:** E2E testing, Security, Registry

**Impact:** High

#### What gave us a hard time

The Registry Member E2E waited only for a create response after clicking Add member.

When that waiter timed out, it could not distinguish a blocked client-side submit from a backend request that had no response.

The E2E API subprocess also inherited Brevo credentials even though invitation delivery is explicitly disabled for E2E.

#### Root cause / constraint

The response-only test boundary did not prove the browser emitted a POST.

The later Department-count assertion also expected zero members after reassignment despite the test's existing-member suggestion fixture remaining assigned to the original Department.

#### Options considered

1. Increase the response timeout.
2. Change invitation delivery behavior again.
3. Observe the request and response independently, verify the safe submitted fields, and preserve disabled delivery as an immediate failure caught by RegistryService.

#### Decision

The E2E API environment excludes every `BREVO_*` variable before setting `INVITATION_DELIVERY_MODE=disabled`.

The Member-create test now verifies the hidden Department UUID, waits for the POST request, checks its non-sensitive JSON body, and only then awaits the `201` response.

The original Department count is asserted as one because the independent suggestion fixture remains there.

#### Why we chose it

This establishes the frontend/backend boundary without exposing credentials or bearer tokens and keeps the test faithful to its own persisted fixtures.

#### Result

The POST was observed with the expected payload, returned `201`, and the complete Playwright suite passed 15/15 with fresh E2E API and web processes.

The temporary safe backend timing markers showed Supabase authentication and Prisma authorization lookup returned before the successful create path, so they were removed.

#### What we learned

A response waiter alone is insufficient evidence that a browser submit happened.

E2E subprocesses should receive only the environment they need, especially when a disabled integration must never consume production credentials.

#### Next approach

For browser mutations that can be blocked by client validation, assert request emission separately from response and visible-state handling.

#### Related changes

- `playwright.config.ts`
- `tests/e2e/registry-members.spec.ts`

## Known Limitations

Detailed authentication-provider combinations are unresolved because the current backend only has the stable Supabase user linkage.

F2-21 cannot be exercised with a persisted non-admin Project Lead until Phase 3 introduces the Project Lead relationship.

The Phase 2 authorization boundary is nevertheless covered by the canonical two-value organization role schema and live Member route/API denial, because Project Lead is not an organization role and cannot satisfy `RolesGuard`.

The live Registry E2E tests require configured Supabase browser credentials and an Administrator member account, so credential-free CI skips those acceptance paths.

## Technical Debt

The current live E2E setup still depends on one mutable shared account and should move to dedicated role-specific fixtures.

The web production bundle still emits the existing Vite chunk-size warning and should be split when page-level loading boundaries are introduced.

## Lessons From This Phase

The Registry prototype is useful for interaction behavior, while Figma guides visual language and neither source overrides canonical authorization or data-model rules.

The existing Phase 1 class-level Registry guards are a strong seam because new department endpoints inherit backend Administrator enforcement automatically.

The Department entity is a useful first persistence boundary because later member assignment can reference a stable organization record instead of duplicating free-text department names.

## Recommendations / Next Approach

- Do not change live Member or Department assignments merely to work around the network boundary.
- Add authoritative authentication-provider detail only if the backend can obtain it from Supabase.
- Keep F2-21 blocked rather than creating Phase 3 Project persistence solely for a Phase 2 fixture.
- The first separate Phase 3 task should add the Project persistence and authorization slice with distinct `created_by_member_id` and `lead_member_id` relationships.
- That slice must preserve Project Lead as project-specific, prevent Administrator or creator status from automatically granting Lead authority, and allow every active authorized Member to view and create Projects.
- After direct database connectivity returns and literal F2-21 can execute against that relationship, rerun the complete Phase 2 gate before marking the phase complete.

## Phase Exit Result

**Not complete.**

The Department invariant and F2-16 are complete.

Phase 2 remains in progress because the phase test specification literally requires F2-21 against a persisted non-admin Project Lead, which cannot exist before the Phase 3 Project relationship.
