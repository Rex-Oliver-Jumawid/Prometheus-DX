# Prometheus release readiness and recovery

> Draft operational gate. No production migrations, restoration, deployment or branch merge are authorized by this document.

## Current verified state (2026-09-25)

- GitHub `main` audited at `4812c02ded61141990db6782556ae479ab04b10d`; 27 tracked Prisma migration directories.
- The connected Prometheus-DX Supabase project was reported `ACTIVE_HEALTHY` in `ap-south-1`.
- Read-only production SQL found 26 distinct successfully completed Prisma migration names, plus one prior rolled-back attempt. The latest tracked migration, `20260924210000_project_message_outcome_scope`, is **absent from Prisma's migration history**.
- The production `project_messages.outcome_id` column, `project_messages_outcome_id_fkey` foreign key and `project_messages_outcome_id_created_at_id_idx` index are all present.
- Supabase's separate migration ledger lists `20260924161041_project_message_outcome_scope`. This may explain the existing schema; Supabase and Prisma ledgers are separate.
- These observations do **not** constitute a backup, a verified restore, a production deployment or a signed-in smoke test.

## Release blockers and required approvals

1. **Back up before any production migration-history reconciliation.** Store a protected export outside the public repository and confirm a usable isolated restore.
2. Independently compare the Supabase-applied Outcome scope migration with the tracked Prisma SQL, including the nullable column type, foreign-key actions and index definition. Check any extra objects created by the Supabase migration.
3. After the owner separately approves the production write and the schema is confirmed equivalent, reconcile the missing Prisma ledger entry using `pnpm exec prisma migrate resolve --applied 20260924210000_project_message_outcome_scope` against the **verified production database connection**. Do not run `prisma migrate deploy` before reconciliation: it could attempt to add the existing column.
4. Re-run `pnpm exec prisma migrate status` and compare every repository migration name against production history. Check that no failed, unexpected, or unapplied migrations remain.
5. Separately approve and execute a production deployment only after CI and recovery gates pass. Verify the exact deployed commit rather than interpreting a successful Vercel Preview check as Production.
6. Health-check `/api/health` and `/api/health/database`, then complete the credential-gated smoke test in `.docs/DEPLOYMENT.md`. The external health URLs were not independently reachable by the audit tool.

## Backup and isolated restore

Supabase's platform documentation says automatic daily backups apply to paid plans. Free projects should make their own off-site exports. Confirm the actual subscription and current product entitlements before assuming a managed backup exists.

Use the **session pooler** or another compatible **verified** database connection and never commit connection strings or database dumps. Use Supabase CLI commands after checking the installed CLI's `--help` and the current documentation:

```bash
supabase db dump --db-url "$BACKUP_DB_URL" -f roles.sql --role-only
supabase db dump --db-url "$BACKUP_DB_URL" -f schema.sql
supabase db dump --db-url "$BACKUP_DB_URL" -f data.sql --data-only --use-copy
```

Keep the exports in a restricted, encrypted, off-site location, not in GitHub Actions public artifacts or the repository. Database exports include sensitive workspace, membership and message data. Storage objects, when introduced, require separate object backups; logical PostgreSQL exports are not a complete Storage backup.

Restore the files into an **isolated compatible local test environment or separate authorized test project**, never over production. Follow Supabase's current backup/restore guide, including prerequisite extensions, managed roles, schema order and identity/auth caveats. Verify:

- Database opens successfully; required roles and schemas exist.
- Tracked schema constraints and indexes are present.
- Project, membership, Outcome, Project Chat and notification row counts match the source snapshot.
- Prisma migration history is intact after restoring and schema validation succeeds.
- Application starts against the isolated restored data with appropriately secured test credentials.

Record the backup timestamp, recovery-point objective, restoration duration, verification evidence, backup access owner and expiry. A backup is not considered verified until it has been restored and inspected.

## Proposed minimum retention policy (requires owner sign-off)

- **Encrypted database exports:** at least one weekly and one immediately before a production schema release; retain several rolling copies when storage allows. Decide concrete frequency and retention based on acceptable data-loss exposure.
- **Project activity and message history:** retain while the Project or organization requires it; implement deletion only after privacy and audit requirements are agreed.
- **Notifications:** define a bounded retention period and preserve unread/actionable records long enough for operational needs.
- **Invitations and authentication events:** follow the service's operational and privacy requirements; do not retain passwords, reset tokens or raw bearer tokens in app logs.
- **Backups containing deleted data:** apply an explicit expiry and access control; backup rotation and application deletion are separate processes.

These are proposals, not deployed retention jobs.

## Production go/no-go record

Record the owner-approved Git SHA, CI run URLs, migration-status output, backup/restore evidence, deployment ID, API/database health responses, real-account smoke test outcome, known skips, and rollback compatibility in a release issue. Require explicit owner approval before merging to `main`, running production migrations, touching production migration history, or promoting/deploying Production.
