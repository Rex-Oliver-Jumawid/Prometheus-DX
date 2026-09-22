# Phase 1 - Authentication and Application Shell

## Status

**Complete**

Phase 1 established real Supabase authentication, Prometheus workspace authorization, protected routing, the reusable application shell, role-sensitive navigation, and browser-level acceptance coverage.

### Current UI Supersession Note

This journal records the shell as it existed at Phase 1 exit.

The current Figma design now owns application-shell layout and visual presentation.

References below to a top navigation or generic notification placeholder are historical implementation notes, not current layout requirements.

The current shell places Notifications in the lower sidebar utility area with an unread-count badge when applicable and does not use a separate top-right notification bell or notification control.

Use `.context/ui-reference.md` and the current Figma frame for new UI work rather than reconstructing the original Phase 1 shell layout.

## Objective

Replace prototype identity assumptions with a real authenticated identity and a separate Prometheus authorization layer.

The core rule at phase exit is:

```text
Authentication answers: Who is this account?
Authorization answers: May this account enter Prometheus and perform this action?
```

A successful Supabase login does not automatically grant workspace access.

## Scope Delivered

- Email/password sign-in with Supabase Auth
- Google OAuth through Supabase Auth
- `/login`
- `/access-denied`
- Protected application routes
- Authenticated session persistence
- Current-member resolution through `/api/me`
- Active Prometheus member verification
- `ADMINISTRATOR` and `MEMBER` workspace roles
- Active/deactivated member handling
- Supabase Auth user linkage through `authUserId`
- Protected application shell
- Role-sensitive sidebar navigation
- Sidebar collapse/expand behavior
- Top navigation
- Breadcrumb behavior for deeper routes
- Notification placeholder
- Profile drawer
- Sign out
- Registry access gate for Administrator-only access
- Backend role guard
- Browser acceptance automation for critical Phase 1 flows

## Runtime Data Flow

```text
User
  |
  | credentials / Google OAuth
  v
Supabase Auth
  |
  | verified session + access token
  v
React AuthProvider
  |
  | Bearer token
  v
NestJS SupabaseAuthGuard
  |
  v
AuthService
  |
  | resolve auth user -> Prometheus Member
  v
Prisma / PostgreSQL
  |
  +--> ACTIVE member -> protected application
  |
  +--> missing / DEACTIVATED member -> access denied
```

For administrator-only APIs:

```text
SupabaseAuthGuard
      |
      v
currentMember
      |
      v
RolesGuard
      |
      +--> ADMINISTRATOR -> allowed
      +--> MEMBER -> forbidden
```

## Database Changes

Phase 1 introduced:

```text
prisma/migrations/20260915010000_auth_members
```

### `WorkspaceRole`

```text
ADMINISTRATOR
MEMBER
```

### `MemberStatus`

```text
INVITED
ACTIVE
DEACTIVATED
```

### `members`

Important fields include:

- `id`
- `auth_user_id`
- `email`
- `full_name`
- `workspace_role`
- `status`
- `position`
- `profile_image_path`
- `deactivated_at`
- timestamps

Important constraints include:

- unique Supabase `auth_user_id`
- case-insensitive unique member email
- consistency between `DEACTIVATED` status and `deactivated_at`

## API Changes

### `GET /api/me`

Resolves the authenticated Supabase identity into the current active Prometheus member.

It is the bridge between authentication and workspace authorization.

### `GET /api/registry/access`

Phase 1 administrator-only access probe used to verify that frontend Registry visibility is backed by server authorization.

The full Registry implementation belongs to Phase 2.

### Health endpoints

Phase 0 health and database connectivity endpoints remain part of the regression baseline.

## Security Model

Phase 1 establishes the following security rules:

- Authentication is delegated to Supabase Auth.
- The backend verifies bearer tokens rather than trusting frontend identity state.
- An authenticated account must resolve to an authorized Prometheus member.
- A deactivated member cannot enter the workspace.
- Role-sensitive UI is only a usability layer.
- Administrator-only backend endpoints independently enforce Administrator authorization.
- The frontend cannot switch production identity through a demo/viewer control.
- Backend-only secrets must never be exposed through `VITE_*` variables.

## Environment Configuration

Important Phase 1 variable names include:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `E2E_MEMBER_EMAIL`
- `E2E_MEMBER_PASSWORD`

The E2E member password is the Supabase Auth login password for the test member, not the PostgreSQL database password.

Secret values are not documented here.

## Testing and Acceptance

Phase 1 has unit, routing, guard, and browser-level coverage.

Important automated areas include:

- current active member resolution
- deactivated-member denial
- invalid authentication token handling
- authenticated user without Prometheus membership
- Administrator role access
- Member role denial
- role-sensitive navigation
- breadcrumb generation
- controlled authorization API failures
- direct signed-out protected-route navigation
- required login validation
- unknown-account rejection
- wrong-password rejection
- authorized sign-in
- shell navigation
- sidebar collapse and expand
- notification placeholder
- browser Back and Forward
- refresh/session persistence
- profile drawer
- sign out
- Member Registry denial
- deactivated-member denial

Final browser acceptance result:

```text
8 tests passed
0 failed
```

The Phase 1 Playwright suite passed after the final selector/accessibility fixes.

# Decision & Challenge Log

## P1-D01 - Authentication must be separate from Prometheus authorization

**Status:** Accepted  
**Area:** Security / Architecture  
**Impact:** High

### What gave us a hard time

A user can successfully authenticate with Supabase while still not being a valid Prometheus workspace member. Treating login success as workspace access would make account identity and organization authorization the same concept.

### Root cause / constraint

Supabase Auth owns account authentication, but Prometheus owns organization membership, role, and account status.

These systems have different responsibilities and lifecycle rules.

### Options considered

1. Allow any successfully authenticated Supabase user into Prometheus.
2. Store organization role only in frontend/session metadata.
3. Authenticate with Supabase, then resolve the identity against the Prometheus `members` table on the backend.

### Proposed solution

Require every authenticated request to resolve to an active Prometheus member before protected data is exposed.

### Decision

Use Supabase Auth for identity and the Prometheus database for workspace authorization.

### Why we chose it

This prevents a valid external authentication account from automatically becoming an authorized company member and gives Prometheus independent control over roles and deactivation.

### Result

The system distinguishes:

- invalid/expired authentication
- authenticated but unauthorized users
- deactivated Prometheus members
- active authorized members

### What we learned

Identity provider success is not equivalent to application authorization.

### Next approach

All future protected modules must authorize against Prometheus domain rules after authentication. Never introduce a feature that trusts login state alone.

### Related changes

- `server/auth/auth.service.ts`
- `server/auth/supabase-auth.guard.ts`
- `src/features/auth/AuthProvider.tsx`
- `src/features/auth/AuthGate.tsx`
- `src/features/auth/AccessDeniedPage.tsx`
- `GET /api/me`

## P1-D02 - Link Supabase identities to Prometheus members without making email the permanent identity key

**Status:** Accepted  
**Area:** Authentication / Database  
**Impact:** High

### What gave us a hard time

Before first login, an invited/seeded Prometheus member may exist only by email, while Supabase has a separate immutable user ID after authentication.

Using email forever as the identity key would make account linkage vulnerable to later email changes and would blur identity-provider data with domain data.

### Root cause / constraint

Prometheus member records and Supabase Auth user records are separate data models that need a stable association.

### Options considered

1. Always resolve members by email.
2. Duplicate Supabase user information as the main member model.
3. Add a unique nullable `authUserId`, allow initial email matching, then persist the stable Supabase user ID.

### Proposed solution

Use email only for initial safe linkage when the member has no `authUserId`, then rely on the Supabase user ID afterward.

### Decision

Add `auth_user_id` as a unique nullable UUID on `members` and link it after verified authentication.

### Why we chose it

It supports pre-created/invited member records while converging on a stable identity-provider key after account activation.

### Result

The real authenticated account is linked to the Prometheus member record, and future authorization resolves through that stable relationship.

### What we learned

Email is useful for invitation/bootstrap matching but should not be the long-term identity primary key when the identity provider exposes a stable user ID.

### Next approach

Phase 2 member-management flows should preserve this separation and clearly display authentication linkage/status without allowing arbitrary reassignment of identity relationships.

### Related changes

- `prisma/schema.prisma`
- `prisma/migrations/20260915010000_auth_members/migration.sql`
- `server/auth/auth.service.ts`

## P1-D03 - Local Supabase database connectivity required using the reachable pooler mode

**Status:** Resolved  
**Area:** Database / Infrastructure  
**Impact:** High

### What gave us a hard time

Initial Prisma/database setup produced authentication/connectivity failures. Direct-host attempts and the transaction pooler path were not consistently reachable from the local development environment.

### Root cause / constraint

The local network/runtime environment could not reliably reach the initially expected Supabase PostgreSQL endpoint configuration.

The application still needed working Prisma migrations, seed execution, and runtime database access.

### Options considered

1. Continue using the direct database host despite connectivity failure.
2. Use the transaction pooler endpoint.
3. Use the reachable Supabase Session pooler for local `DATABASE_URL` and `DIRECT_URL` while preserving the architecture's Prisma/PostgreSQL model.

### Proposed solution

Use the Supabase Session pooler configuration that was reachable from the development machine.

### Decision

Use the working Session pooler locally so Prisma migration, seed, and runtime queries can proceed.

### Why we chose it

The goal was reliable local development without changing the database technology or bypassing Prisma.

### Result

- migrations deployed successfully
- seed execution succeeded
- database health checks succeeded
- authenticated member resolution could query PostgreSQL

### What we learned

A database error that looks like bad credentials may actually be endpoint/network reachability. Test connection mode and host reachability separately from application code.

### Next approach

When database connectivity fails in future environments:

1. verify credentials
2. verify DNS/IP reachability
3. verify Supabase connection mode and port
4. run a minimal database health query
5. only then debug application-level ORM behavior

Document production connection mode separately when deployment begins rather than assuming the local workaround is automatically the best production configuration.

### Related changes

- `.env` local configuration
- Prisma migrations
- database health endpoint

## P1-D04 - NestJS guard dependency injection failed under the development runtime

**Status:** Resolved  
**Area:** Backend / Authentication  
**Impact:** High

### What gave us a hard time

Authenticated `/api/me` requests returned a generic server error even though Supabase login itself was working.

The failure initially looked like an authentication/authorization problem.

### Root cause / constraint

`AuthService` was `undefined` inside `SupabaseAuthGuard` under the current NestJS + `tsx` development runtime/decorator metadata behavior.

A similar problem then appeared with `Reflector` in `RolesGuard`.

### Options considered

1. Change the TypeScript/decorator/runtime configuration.
2. Refactor the guards to avoid constructor injection.
3. Make the intended dependencies explicit with `@Inject(...)`.

### Proposed solution

Use explicit dependency tokens in the affected guards.

### Decision

Use:

```ts
constructor(
  @Inject(AuthService)
  private readonly authService: AuthService,
) {}
```

and explicitly inject `Reflector` in `RolesGuard`.

### Why we chose it

It fixed dependency resolution without weakening the guard architecture or requiring a broad runtime/toolchain change.

### Result

- `/api/me` resolved authenticated members correctly
- Registry authorization requests worked
- guard unit tests passed

### What we learned

When a NestJS service appears unexpectedly undefined, dependency-injection metadata should be checked before assuming the business logic is wrong.

### Next approach

For future guards/providers introduced under this runtime, verify constructor injection early and use explicit `@Inject(...)` when metadata inference is unreliable.

### Related changes

- `server/auth/supabase-auth.guard.ts`
- `server/auth/roles.guard.ts`
- commit `7706b49` - `fix: correct auth guard dependency injection`

## P1-D05 - Google OAuth configuration spans two systems and must use the exact callback path

**Status:** Resolved  
**Area:** Authentication / Integration  
**Impact:** Medium

### What gave us a hard time

Google authentication required configuration in both Google Cloud and Supabase, plus correct local application redirect behavior. A mismatch in any layer prevents OAuth completion even when the frontend button is correct.

### Root cause / constraint

OAuth depends on an exact redirect chain:

```text
Prometheus
-> Supabase Auth
-> Google
-> Supabase callback
-> Prometheus /login
```

### Options considered

1. Defer Google authentication and support password-only Phase 1.
2. Implement Google OAuth directly against Google in the application.
3. Use Google as an OAuth provider through Supabase Auth.

### Proposed solution

Let Supabase Auth own the OAuth exchange while Prometheus owns post-authentication workspace authorization.

### Decision

Configure a Google OAuth web client, register the exact Supabase callback, enable Google in Supabase, and redirect back to Prometheus `/login` after authentication.

### Why we chose it

It keeps all authentication providers behind the same Supabase session model and avoids building a second authentication system.

### Result

Google OAuth successfully authenticated the real account, after which the normal Prometheus member authorization flow ran.

### What we learned

OAuth integration should be debugged as a redirect chain, not as a single frontend button.

### Next approach

When adding or changing identity providers, verify each redirect boundary independently and keep provider authentication separate from Prometheus authorization.

### Related changes

- `src/features/auth/LoginPage.tsx`
- Supabase Auth provider configuration
- Google OAuth client configuration

## P1-D06 - Registry security must exist before Registry implementation

**Status:** Accepted  
**Area:** Security / Architecture  
**Impact:** High

### What gave us a hard time

Registry belongs to Phase 2, but the application shell already needed role-sensitive navigation in Phase 1. Waiting until Phase 2 to establish the security boundary would leave role visibility unproven.

### Root cause / constraint

Frontend hiding of the Registry nav item is not a security mechanism.

### Options considered

1. Hide Registry for Members and defer backend protection until Phase 2.
2. Remove Registry entirely until Phase 2.
3. Introduce a small Administrator-only backend access probe in Phase 1 and keep the full feature as a placeholder.

### Proposed solution

Create the authorization boundary now, then build Registry CRUD behind it in Phase 2.

### Decision

Add `RolesGuard`, `@WorkspaceRoles('ADMINISTRATOR')`, and an Administrator-only `/api/registry/access` endpoint while leaving the Registry content itself as a Phase 2 placeholder.

### Why we chose it

It verifies the security model before the sensitive administration feature is implemented.

### Result

- Administrators see Registry and pass the backend gate.
- Members do not see Registry in navigation.
- Members are denied on direct Registry access.
- Backend role enforcement is independently unit tested.

### What we learned

Authorization boundaries should be established before the feature behind them becomes complex.

### Next approach

Every Phase 2 Registry endpoint must reuse Administrator backend enforcement. No CRUD endpoint should rely on the frontend gate alone.

### Related changes

- `server/auth/roles.guard.ts`
- `server/auth/workspace-roles.decorator.ts`
- `server/registry/registry.controller.ts`
- `src/features/shell/RegistryGate.tsx`
- `src/features/shell/navigation.ts`

## P1-D07 - Turn the phase acceptance checklist into executable browser regression coverage

**Status:** Accepted  
**Area:** Testing  
**Impact:** High

### What gave us a hard time

Phase 1 had many related cases: valid login, invalid login, protected routes, refresh, role visibility, deactivation, profile behavior, shell navigation, and sign out.

Relying only on repeated manual verification made it easy to forget edge cases and made the completion decision subjective.

### Root cause / constraint

Authentication bugs frequently appear only when state transitions are combined, not when components are tested independently.

### Options considered

1. Keep the entire Phase 1 gate manual.
2. Test only the happy-path login/logout flow in Playwright.
3. Automate the repeatable security/navigation cases and retain manual verification for visual behavior and scenarios that require external-provider interaction.

### Proposed solution

Expand `tests/e2e/auth-shell.spec.ts` so Phase 1 has an executable regression suite.

### Decision

Automate critical Phase 1 acceptance flows, including temporary database state changes for Member-role and deactivated-member cases, restoring the original record in `finally` blocks.

### Why we chose it

It turns the phase gate into a repeatable check and ensures later phases can detect regressions in the authentication shell.

### Result

The final Phase 1 E2E run completed with:

```text
8 passed
0 failed
```

### What we learned

A phase checklist becomes significantly more useful when repeatable cases are executable rather than only descriptive.

### Next approach

For every future phase:

- keep the manual testcase file as the complete acceptance contract
- automate critical repeatable paths
- retain manual visual/UX inspection
- run prior phase smoke regression before declaring completion

### Related changes

- `tests/e2e/auth-shell.spec.ts`
- `.testcases/phase-01-auth-shell-tests.md`
- Playwright configuration

## P1-D08 - Accessibility semantics directly affected test reliability

**Status:** Resolved  
**Area:** Frontend / Testing / Accessibility  
**Impact:** Medium

### What gave us a hard time

Playwright could not reliably locate the password input using its accessible label even though a visible `PASSWORD` label existed in the layout.

### Root cause / constraint

The DOM structure placed the password input and show/hide control inside a wrapper where the intended accessible input name was not sufficiently explicit for the test locator.

### Options considered

1. Use a fragile CSS selector in the test.
2. Locate the password field by placeholder text.
3. Fix the input's accessible name so user-facing semantics and tests agree.

### Proposed solution

Improve the password input's accessible labeling rather than weakening the test selector.

### Decision

Give the password field an explicit accessible name.

### Why we chose it

The application should be accessible and testable through semantic roles/labels rather than DOM implementation details.

### Result

The password field became reliably targetable by Playwright and the login acceptance tests progressed normally.

### What we learned

Testability problems can reveal real accessibility/semantic weaknesses. Fixing the product is preferable to teaching tests to depend on brittle selectors.

### Next approach

For Phase 2 forms and controls, design accessible names and roles at implementation time so Playwright can target the same semantics users and assistive technology receive.

### Related changes

- `src/features/auth/LoginPage.tsx`
- commit `76c4d98` - `fix: make password field accessible to auth tests`

## P1-D09 - Playwright selectors must be precise when pages contain semantically related headings

**Status:** Resolved  
**Area:** Testing  
**Impact:** Low

### What gave us a hard time

The `Team` acceptance assertion matched both the page heading `Team` and a secondary heading beginning with `Team`, causing Playwright strict-mode failure even though the page itself was correct.

### Root cause / constraint

Role/name locators perform accessible-name matching and can match multiple elements when the name is not constrained exactly.

### Options considered

1. Change page copy to satisfy the test.
2. Use CSS selectors tied to layout structure.
3. Make the semantic heading assertion exact.

### Proposed solution

Keep the UI copy and make the Playwright selector express the intended exact heading.

### Decision

Use exact heading-name assertions for Team, Schedule, Registry denial, and related phase checks where ambiguity is possible.

### Why we chose it

Tests should describe the intended semantic element without forcing unnecessary product changes.

### Result

The ambiguous-heading failure was eliminated and the full Phase 1 suite passed.

### What we learned

Strict browser tests are useful because they expose ambiguous assumptions in selectors, but test failures must be classified correctly as product failures or test-definition failures.

### Next approach

Prefer semantic Playwright locators with `exact: true` when the page can legitimately contain longer labels/headings that share the same prefix.

### Related changes

- `tests/e2e/auth-shell.spec.ts`
- commit `6a62761` - `test: make Phase 1 heading assertions exact`

## Known Limitations at Phase Exit

- Registry is only an access-controlled placeholder. Full organization management belongs to Phase 2.
- Notification delivery is not implemented; the shell exposes a safe placeholder until the notification phase.
- Project, schedule, team, and other business pages are still placeholders or future-phase functionality.
- Google OAuth is verified as an authentication path, but the automated local Playwright suite primarily exercises repeatable email/password flows.

## Technical Debt at Phase Exit

- The local Supabase Session pooler workaround should be reviewed again for deployment/production configuration rather than copied blindly.
- Build-tool warnings should continue to be monitored even when they do not fail verification.
- Test-data strategy will need to become more deliberate as Phase 2 introduces multiple members and departments; mutating the primary local test member is acceptable for the current controlled Phase 1 suite but should not become the long-term fixture strategy.

## Lessons From This Phase

- Authentication and authorization are separate systems.
- Stable identity linkage should use the provider user ID, not email forever.
- Backend authorization must exist independently of UI visibility.
- Dependency-injection failures can masquerade as authentication failures.
- Database endpoint/network problems should be isolated before debugging ORM/business code.
- OAuth should be debugged as an end-to-end redirect chain.
- Accessibility semantics improve both product quality and test reliability.
- A phase completion gate should be executable wherever practical.

## Recommendations / Next Approach

Phase 2 should begin with the Registry domain model and Administrator-only backend APIs before building the full Registry interface.

The Phase 2 implementation should specifically carry forward these Phase 1 rules:

1. Every Registry API endpoint must enforce `ADMINISTRATOR` server-side.
2. Member authentication linkage must remain distinct from member organization data.
3. Deactivation must affect workspace access immediately and predictably.
4. Member and department forms should use accessible semantic controls from the start.
5. Phase 2 browser tests should use dedicated fixture/test data where possible rather than depending indefinitely on one real Administrator account.
6. Phase 1 E2E smoke coverage must continue passing before Phase 2 is marked complete.

## Phase Exit Result

**Phase 1 passed its acceptance gate and is complete.**

Final browser acceptance:

```text
8 passed
0 failed
```

Prometheus is ready to proceed to Phase 2 - Registry.
