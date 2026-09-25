# Release readiness and disaster recovery

**Status:** A review checklist, not an approval to merge or deploy. Production migrations, database writes, Vercel promotion and actual production backup restoration require separate approval.

## Inspection snapshot (2026-09-25)

- Connected Supabase project: Prometheus-DX in `ap-south-1` (Mumbai), healthy, organization on the Free plan.
- Database reports **27 completed Prisma migrations**. The Project Chat Outcome reference column exists. The new Milestone 3 API-rate-limit table is **not** in production and must remain undeployed until approved.
- [Supabase's backup guidance](https://supabase.com/docs/guides/platform/backups) recommends regular off-site manual exports for Free projects. Paid-plan daily backup/PITR functionality must not be assumed here.
- Supabase's security advisor flagged one unqualified trigger search path and inherited browser-role execution of an auto-RLS event-trigger function. A **draft follow-up migration** pins the trusted search path and revokes public execution where the platform-managed function exists; production remains untouched. The RLS-without-policies findings are expected for server-only tables whose browser roles have no grants, but should be checked again after migration.
- Supabase Auth leaked-password checking is a **Pro-only feature** and is disabled on this Free project. Verify the available minimum-length/complexity controls, invitation restrictions and password recovery as the Free-plan alternative; do not label leaked-password checking enabled.
- Current GitHub `main` (inspection snapshot) is `4812c02ded61141990db6782556ae479ab04b10d`. Subsequent release commits must be identified again immediately before approval. GitHub/Vercel check success alone does not identify the live production deployment.
- Live Vercel `/api/health` and `/api/health/database` could not be independently reached from the review environment. A successful **read-only** Supabase connection does not replace the live API test.

## Draft release stack

1. PR #34: Schedule test and CI baseline; GitHub CI passed.
2. PR #36: Project-wide Lead/Member Activity with Administrator access, denied unrelated member Activity reads; Chat read-only visibility for nonmembers stays separate; GitHub CI passed.
3. PR #38: Notifications pagination and reduced collaboration polling; GitHub CI passed.
4. PR #41: PostgreSQL API quota migration and request monitoring; GitHub CI passed.
5. Release-readiness PR: isolated application-schema backup/restore drill, follow-up database function security migration and this checklist.

All changes stay in draft branches until the owner explicitly approves individual merges. **Do not run the new rate-limit API code against a database that has not received its migration.**

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
- [x] Milestone 2 CI and Project Activity authorization regression passed on PR #36.
- [x] Milestone 3 notification/polling CI passed on PR #38.
- [x] Milestone 3 quota/migration CI passed on PR #41.
- [x] Isolated backup/restore script passed its PostgreSQL 17 CI drill with synthetic data (see [workflow run](https://github.com/Rex-Oliver-Jumawid/Prometheus-DX/actions/runs/36084952973)).
- [ ] Production app-schema backup created, encrypted and retained off-site.
- [ ] Production data restore rehearsed on an isolated non-production database, including non-sensitive data counts.
- [ ] Auth user and Storage recovery procedures verified independently.
- [ ] Owner authorizes production database migration and a release commit.
- [ ] Explicit Prisma `migrate deploy` applied against production **before** releasing code that requires the rate-limit table. Inspect `prisma migrate status` and verify the table exists.
- [ ] After explicit migration approval, recheck the Supabase security advisor and confirm the trigger has a fixed search path and the auto-RLS event-trigger function no longer grants browser-role EXECUTE (if present).
- [ ] On Free Supabase Auth, review minimum password length/complexity and document the residual lack of paid leaked-password protection.
- [ ] Verify release commit SHA equals the intended Vercel **Production** deployment, not merely a Ready Preview build.
- [ ] With test identities, check login, Home, Projects, cross-member Activity, Project Chat/announcements, Notifications, Schedule/Team, VisiWork, Reports, session expiry and logout. Nonmember Activity must reject direct API requests.
- [ ] Read live `GET /api/health` and `GET /api/health/database` and review server logs for request IDs, 429 responses and unexpected 5xx errors.
- [ ] Explicit owner approval before merge to `main` and production promotion. Milestone 4 comprehensive authenticated/cross-browser automation remains outside the approved implementation scope.

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
