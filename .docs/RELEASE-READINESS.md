# Release readiness and disaster recovery

**Status:** A review checklist, not an approval to merge or deploy. Production migrations, database writes, Vercel promotion and actual production backup restoration require separate approval.

## Inspection snapshot (2026-09-25)

- Connected Supabase project: Prometheus-DX in `ap-south-1` (Mumbai), healthy, organization on the Free plan.
- Production reports **27 successfully applied Prisma migration names plus one historical rolled-back attempt**, while the release branch has **29 tracked migration directories**. Of the 29, the Outcome-scope, API-rate-limit and function-security migrations are absent from production's Prisma ledger. Production also reports one applied legacy notification migration absent from the repository. See the dedicated reconciliation gate below; **do not run unmodified `migrate deploy` on production**. The new API rate-limit table does not yet exist.
- [Supabase's backup guidance](https://supabase.com/docs/guides/platform/backups) recommends regular off-site manual exports for Free projects. Paid-plan daily backup/PITR functionality must not be assumed here.
- Supabase's security advisor flagged one unqualified trigger search path and inherited browser-role execution of an auto-RLS event-trigger function. A **draft follow-up migration** pins the trusted search path and revokes public execution where the platform-managed function exists; production remains untouched. The RLS-without-policies findings are expected for server-only tables whose browser roles have no grants, but should be checked again after migration.
- Supabase Auth leaked-password checking is a **Pro-only feature** and is disabled on this Free project. Verify the available minimum-length/complexity controls, invitation restrictions and password recovery as the Free-plan alternative; do not label leaked-password checking enabled.
- Production-only Vercel Git deployment configuration was committed to `main` in config-only commit `88c8eaf072fdd698658109205fd7f49e38894f0e`. Only `main` triggers automatic Vercel Git deployments; PRs and feature branches do not. This does not remove old previews or prevent manual CLI deployments. Reconfirm the latest `main` and deployed SHA immediately before approval; a passing GitHub build does not establish a live production deployment.
- Live Vercel `/api/health` and `/api/health/database` could not be independently reached from the review environment. A successful **read-only** Supabase connection does not replace the live API test.

## Draft release stack

1. PR #34: Schedule test and CI baseline; GitHub CI passed.
2. PR #36: earlier participant-only Activity rule, superseded by the follow-up company-wide collaboration PR; the earlier checks passed for their prior scope.
3. PR #38: Notifications pagination and reduced collaboration polling; GitHub CI passed.
4. PR #41: PostgreSQL API quota migration and request monitoring; GitHub CI passed.
5. Release-readiness PR #42: isolated application-schema backup/restore drill, follow-up database function security migration and this checklist.
6. Review follow-up PR #43: notification pagination and server-error redaction fixes.
7. Company-wide collaboration follow-up PR: all active authorized members may view any Project's display-safe Activity, send general Project Chat messages, and post announcements. Any active authorized member can pin or unpin announcements; only authors can edit or delete their own chat messages.

Consolidated review PR **#45** targets `main` and incorporates the final state of the seven preceding drafts. PRs #35/#37/#39/#40 represent overlapping alternatives and must not also be merged. No feature changes or production schema changes are merged. **Do not run new rate-limit API code against a database that has not received its migration.**

## Verified migration-history discrepancy — blocking release

Read-only production verification on 2026-09-25 found:

- **29** tracked migration directories in this release branch versus **27** successfully applied distinct migration names in production, plus one rolled-back attempt for the later notifications migration.
- `20260918020000_phase_07_notifications` is marked successfully applied in production, but **its original migration SQL is missing from the current repository and the accessible historical Phase 7 branch**. The database records checksum `7b543d14d7c5ec0e38fc5856a76a884890b1cdbc205fa12b2c645186f3d02166`. Do not invent a replacement SQL file, delete this production ledger entry or assert the histories match until the original SQL/checksum can be recovered or the discrepancy is explicitly reviewed.
- `20260924210000_project_message_outcome_scope` exists in source but is absent from production's Prisma history. Production already contains the exact observed end-state: nullable UUID `project_messages.outcome_id`, an `outcomes(id)` foreign key with `ON DELETE CASCADE ON UPDATE CASCADE`, and the `(outcome_id, created_at, id)` index. Supabase's **separate** migration ledger records `20260924161041_project_message_outcome_scope`.
- `20260925010000_release_api_rate_limits` and `20260925020000_release_function_security` are new and unapplied. `public.api_rate_limit_buckets` does not exist yet.

**Reviewed order after an actual encrypted production backup, isolated restore and separate owner approval:**

1. Recover the original SQL for the legacy notification migration from an authenticated project backup/worktree and verify its SHA-256 checksum against the recorded value. If unavailable, document an explicit migration-history exception and its verified schema effects; do not fabricate or silently erase applied history.
2. Recheck the Outcome-scope column, foreign-key actions and index, compare any extra Supabase-managed migration effects, and record the evidence. Only then mark the already-applied tracked Prisma migration using `pnpm exec prisma migrate resolve --applied 20260924210000_project_message_outcome_scope` on a **verified production connection**. This updates migration metadata; it does not execute the migration SQL.
3. Review `pnpm exec prisma migrate status`. Account for the missing legacy migration and ensure there are no unexpected unreviewed differences.
4. Apply only the two genuinely pending new release migrations using a separately authorized `pnpm prisma:migrate:deploy`. Verify the quota table exists, inspect Prisma's ledger and recheck Supabase's security advisor **before** promoting the app.
5. Deploy the approved app SHA to Production only after the schema is verified. The Vercel Preview build-rate failure is separate from successful GitHub CI.

This procedure is **documentation, not permission to write production data**. Prisma's migration tooling does not detect all schema drift during `migrate deploy`, so a successful CI migration on an empty database alone cannot settle the existing production ledger mismatch.

## Database backup and recovery

### What is and is not protected

`scripts/backup-restore-drill.sh` exports the app-owned PostgreSQL `public` schema to a private custom-format dump and restores it into a local, isolated database named `prometheus_restore`. The script rejects a same-source restore, nonloopback targets and all target database names other than `prometheus_restore`.

This backup **does not include the separate Supabase-managed Auth user schema or Storage object bytes**. Auth identities, Storage objects and configuration must have a separately tested recovery plan before calling disaster recovery complete. See [Supabase's official backup and restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

### Minimum operator process

1. Use a machine with PostgreSQL client tools (`pg_dump`, `pg_restore`, `psql`, `createdb`) **at least as new as the source server's major version** (currently PostgreSQL 17), an isolated local Postgres instance and securely obtained production connection details. Use a direct connection or a *session* pooler rather than the transaction pooler for logical dumps.
2. Create an empty local database named `prometheus_restore`; never target a live or shared database for the drill.
3. Configure `SOURCE_DATABASE_URL` from the approved source, `RESTORE_DATABASE_URL` pointing only to local `prometheus_restore`, and a private `BACKUP_OUTPUT_DIR` **outside the Git repository**. Never commit `.env`, DB URLs, dump files or passwords.
4. Run `bash scripts/backup-restore-drill.sh`. Check the dump checksum, applied migration count, expected application tables and a known non-sensitive row count. Do not mark a recovery test successful merely because the dump command exited zero.
5. Encrypt the dump before transferring it to a separate, access-controlled off-site location. Record date, size, checksum, covered schemas, restore result and responsible operator. Do not attach private dumps to public GitHub issues, commits or public Actions artifacts.
6. Test the separately agreed Auth/Storage recovery path. Restore only into an isolated environment unless the owner approves an incident recovery.

Proposed initial retention: take a private app-schema dump before each approved production migration and at least once a week, keep four verified weekly copies, and repeat an isolated restore drill quarterly. Confirm the separate Auth/Storage retention policy before inviting real users. Chat, notifications and ActivityLog **are not automatically purged** by this release; any later deletion window requires a separately approved policy. Expired API rate buckets may be pruned after a seven-day safety margin once a reviewed maintenance job exists.

The CI `Backup and Restore Drill` proves the scripted public-schema backup/restore against synthetic fixtures on PostgreSQL 17. It **does not** prove that a real production dump has been captured, stored off-site or restored, so keep the production-backup checklist open until that occurs.

## Release gates

- [x] Milestone 1 CI passed on PR #34.
- [x] The final company-wide collaboration and announcement pin/unpin behavior passed CI on PR #44; the restrictive participant-only rule in PR #36 is superseded.
- [x] Milestone 3 notification/polling CI passed on PR #38.
- [x] Milestone 3 quota/migration CI passed on PR #41.
- [x] Isolated backup/restore script passed its PostgreSQL 17 CI drill with synthetic data (see [workflow run](https://github.com/Rex-Oliver-Jumawid/Prometheus-DX/actions/runs/36084952973)).
- [ ] Recover or formally reconcile the legacy notification migration SQL and compare all production-ledger checksums with tracked migration files.
- [ ] Before any production migration, reconcile the already-present Outcome-scope schema using the reviewed process above.
- [ ] Production app-schema backup created, encrypted and retained off-site.
- [ ] Production data restore rehearsed on an isolated non-production database, including non-sensitive data counts.
- [ ] Auth user and Storage recovery procedures verified independently.
- [ ] Owner authorizes production database migration and a release commit.
- [ ] After migration-history reconciliation and an approved backup, explicitly run Prisma `migrate deploy` against production **before** releasing code that requires the rate-limit table. Inspect `prisma migrate status`, verify both new migration records and check the table exists.
- [ ] After explicit migration approval, recheck the Supabase security advisor and confirm the trigger has a fixed search path and the auto-RLS event-trigger function no longer grants browser-role EXECUTE (if present).
- [ ] On Free Supabase Auth, review minimum password length/complexity and document the residual lack of paid leaked-password protection.
- [ ] Verify release commit SHA equals the intended Vercel **Production** deployment, not merely a Ready Preview build.
- [ ] With test identities, check login, Home, Projects, cross-member Activity, Project Chat/announcements, Notifications, Schedule/Team, VisiWork, Reports, session expiry and logout. Unassigned authorized members must be able to view Activity through the UI and direct API, send Project Chat messages, and post announcements; any active authorized employee may pin or unpin announcements in non-archived Projects.
- [ ] Read live `GET /api/health` and `GET /api/health/database` and review server logs for request IDs, 429 responses and unexpected 5xx errors.
- [ ] Explicit owner approval before merging consolidated PR #45 to `main` and production promotion. Milestone 4 comprehensive authenticated/cross-browser automation remains outside the approved implementation scope.

## Safe production read-only checks

Do not paste database passwords or API tokens into GitHub comments or issue trackers.

```sql
SELECT migration_name, finished_at
FROM public._prisma_migrations
WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
ORDER BY started_at DESC
LIMIT 8;

SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'api_rate_limit_buckets'
) AS rate_limit_migration_present;
```

After an authorized release, compare the deployment commit SHA with the approved PR merge commit and run:

```bash
curl --fail --show-error --silent https://prometheus-dx.vercel.app/api/health
curl --fail --show-error --silent https://prometheus-dx.vercel.app/api/health/database
```

A successful health response is necessary but **not sufficient** for authenticated collaboration and persistence acceptance.

## Rollback safety

A Vercel code rollback is separate from database recovery. The new quota table migration is additive, so earlier app code need not use it; do not drop production tables automatically during an application rollback. Check old-code compatibility with the actual schema before reverting. For lost data, use only a verified backup and a separately reviewed recovery procedure, never a speculative production restore.
