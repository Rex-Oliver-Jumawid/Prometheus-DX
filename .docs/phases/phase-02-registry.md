# Phase 2 - Registry

## Status

**Ready to start**

This document is the live implementation journal for Phase 2. It should be updated during implementation and finalized before Phase 2 is marked complete.

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
Members / Departments UI
        |
        v
Manual + automated acceptance
        |
        v
Finalize this document
```

The backend authorization and data model should be established before relying on the final Registry UI.

## Database Changes

_To be recorded during implementation._

## API Changes

_To be recorded during implementation._

## Environment / Configuration Changes

_To be recorded during implementation. Variable names only, never secret values._

## Testing and Acceptance

Acceptance source:

```text
.testcases/phase-02-registry-tests.md
```

Phase 1 authentication-shell regression must continue to pass before Phase 2 can exit.

Final results will be recorded here when acceptance is complete.

# Decision & Challenge Log

Add only meaningful architectural, security, database, integration, workflow, or testing decisions.

Use stable IDs beginning with `P2-D01`.

For every major issue or decision, record:

- what gave us a hard time
- root cause / constraint
- options considered
- proposed solution
- final decision
- why we chose it
- result
- what we learned
- next approach
- related files, migrations, tests, or commits

_No Phase 2 decisions have been finalized yet._

## Known Limitations

_To be recorded at phase exit._

## Technical Debt

_To be recorded at phase exit._

## Lessons From This Phase

_To be recorded as implementation progresses and summarized at phase exit._

## Recommendations / Next Approach

Initial recommendations inherited from Phase 1:

- build Administrator enforcement into every Registry endpoint from the start
- keep authentication linkage distinct from editable organization profile fields
- use accessible semantic form controls so browser tests do not depend on brittle selectors
- introduce deliberate test fixtures/data for multiple member roles rather than depending indefinitely on one real Administrator account
- preserve Phase 1 browser regression coverage

## Phase Exit Result

**Not complete.**

Phase 2 may be marked complete only after implementation, acceptance, regression, and this document are finalized.
