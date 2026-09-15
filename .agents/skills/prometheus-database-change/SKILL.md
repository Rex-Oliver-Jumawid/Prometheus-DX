---
name: prometheus-database-change
description: Use when changing Prometheus persistent data structures, Prisma models, migrations, constraints, or multi-record persistence behavior. Covers canonical data-model review, migration safety, integrity, transactions, verification, and phase documentation.
---

# Prometheus Database Change

Use this workflow for Prisma schema changes, migrations, persistent relationships, constraints, indexes, data backfills, or workflows that update multiple related records.

## 1. Read the canonical data model first

Before changing persistent structure, inspect `.context/data-model.md` and the relevant functional requirements.

Do not invent a persistent relationship that contradicts the canonical model.

If implementation needs reveal that the canonical model is incomplete or contradictory, resolve that documentation conflict before permanently encoding a workaround.

## 2. Inspect the current database implementation

Review:

- `prisma/schema.prisma`.
- Existing migrations under `prisma/migrations/`.
- Relevant Prisma queries and services.
- Existing database constraints and indexes.
- Seed behavior if the changed entities are seeded.

Understand existing deployed history before creating a migration.

## 3. Preserve canonical ownership of data

Persistent business state belongs in PostgreSQL.

Do not use:

- Frontend stores.
- Local storage.
- Realtime presence.
- Prototype state.

as replacements for persistent records.

Prefer deriving values from canonical records rather than maintaining manually synchronized shadow state.

Controlled caching, views, materialized views, or denormalization require an explicit justification when introduced.

## 4. Encode invariants at the right boundary

Use database constraints when an invariant belongs at the persistence boundary.

Use appropriate:

- Foreign keys.
- Unique constraints.
- Check constraints.
- Indexes.
- Nullability.
- Enum/domain modeling.

Do not rely only on UI validation for data integrity.

Backend validation and domain rules remain necessary even when the database also enforces integrity.

## 5. Use safe Prisma migration practices

Keep Prisma schema changes and their migrations together.

Use tracked migrations for schema changes.

Do not casually rewrite or delete shared/deployed migration history.

Preserve historical records where Prometheus requires auditability or workflow history.

When a migration changes existing data assumptions, consider whether a controlled backfill or compatibility step is required.

Never put secrets or production credentials into migration files.

## 6. Consider transactional behavior

When one domain action modifies multiple related records, determine whether those writes must succeed or fail together.

Use a transaction when partial success would leave the system in an invalid or misleading state.

Examples may include membership transitions, workflow state changes, acceptance history, or other multi-record state transitions.

Do not add transactions mechanically when independent operations do not require atomicity.

## 7. Keep API contracts intentional

Database models, API contracts, and UI view models are related but are not automatically identical.

Do not expose internal database fields merely because Prisma returns them.

Use shared Zod contracts where they create a useful source of truth, but do not force every layer to share the exact same shape.

## 8. Verify database changes

After a Prisma change, run the repository's relevant commands, including:

```text
pnpm prisma:generate
pnpm prisma:validate
```

Apply or test the migration using the repository's approved migration workflow.

Then run focused tests around the changed persistence behavior.

Expand to broader verification when the schema affects authentication, authorization, routing, Registry, or shared domain workflows.

For phase-level work, follow the phase-delivery skill and matching `.testcases/` acceptance file.

## 9. Document meaningful data decisions

If the change introduces or resolves an important persistence decision, update the active phase journal under `.docs/phases/`.

Record:

- The modeling problem.
- Constraints and alternatives.
- The chosen relationship or invariant.
- Migration implications.
- Observed result.
- What was learned.
- The next approach for later phases.

Use stable decision IDs as defined in `.docs/phases/README.md`.
