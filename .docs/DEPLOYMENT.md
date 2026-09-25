# Prometheus Deployment Runbook

## Purpose

This is the operational reference for deploying Prometheus-DX to Vercel with Supabase PostgreSQL/Auth and Brevo email delivery.

The application can build successfully while the database is still on an older schema.
Database migrations therefore require their own explicit deployment step.

Before a release, review [.docs/RELEASE-READINESS.md](RELEASE-READINESS.md) for backup/restore gates and the verified 2026-09-25 Prisma migration-history discrepancy. Do not run a production migration or migration-history repair merely because this runbook describes the procedure.

## Production Components

- Vercel - frontend and server deployment
- Supabase PostgreSQL - persistent application database
- Supabase Auth - authentication and password recovery
- Prisma - schema/client and tracked migrations
- Brevo - invitation email delivery
- GitHub Actions - repository verification

## Build Contract

The committed Vercel build command is:

```text
pnpm prisma:generate && pnpm build
```

The Vercel build does **not** run:

```text
pnpm prisma:migrate:deploy
```

Do not assume a successful Vercel build means production database migrations were applied.

## Required Deployment Order

For a change that includes a Prisma migration:

```text
1. Verify code and migration locally/CI
2. Apply tracked migration to production database
3. Verify migration state and critical invariants
4. Deploy application code
5. Run API/database health checks
6. Run production smoke test
```

For a change with no migration, step 2 is not required.

Never hand-edit production tables as a substitute for a tracked migration unless an emergency recovery is explicitly documented and reconciled back into Prisma migration history.

## Environment Variables

See `.docs/ENVIRONMENT.md` for the canonical variable reference.

Production must provide the server and browser values required by the deployed architecture.

At minimum, verify:

- `DATABASE_URL`
- `DIRECT_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `APP_URL`
- `CLIENT_ORIGINS`
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME`
- `WORK_SESSION_MAX_HOURS`

Never put database passwords, Brevo API keys, Supabase service-role keys, or other server secrets in a `VITE_*` variable.

## Supabase Auth Configuration

### Application URLs

Production authentication and recovery depend on Supabase allowing the deployed origin.

The password-recovery implementation calls:

```text
<current browser origin>/reset-password
```

Add the deployed recovery URL to the Supabase Auth redirect allow-list.

For local development, allow the local application origins that are actually used by the worktree.

### Password Recovery

Flow:

```text
/forgot-password
-> Supabase resetPasswordForEmail
-> recovery email
-> /reset-password
-> PASSWORD_RECOVERY/session establishment
-> updateUser(password)
-> local sign out
-> /login
```

The forgot-password page intentionally responds with a non-enumerating success message:

```text
If an account exists for that email, a password reset link has been sent.
```

Do not change this into account-existence disclosure.

## Brevo

Brevo values are server-only.

Requirements:

- `BREVO_API_KEY` is valid.
- `BREVO_SENDER_EMAIL` is a verified Brevo sender.
- `BREVO_SENDER_NAME` is the desired display name.
- `APP_URL` is the public application origin used in account-setup links.

A successful provider request is not the same as Member activation.
Member activation remains tied to account setup and authenticated linkage.

## Prisma Deployment

Generate the client:

```bash
pnpm prisma:generate
```

Validate the schema:

```bash
pnpm prisma:validate
```

Apply tracked production migrations:

```bash
pnpm prisma:migrate:deploy
```

Inspect migration status when needed:

```bash
pnpm prisma migrate status
```

Do not use `prisma migrate dev` as the production deployment command.

## Vercel Deployment

Normal deployment is triggered from the configured Git branch.

If a main-branch commit must be redeployed and Vercel is accepting builds, a harmless empty Git commit can be used to trigger a fresh deployment:

```bash
git switch main
git pull
git commit --allow-empty -m "chore: redeploy production"
git push origin main
```

Never force-push production history merely to trigger a deployment.

## Vercel Build-Rate Limit

A Vercel status target containing:

```text
upgradeToPro=build-rate-limit
```

indicates an infrastructure/account build-rate limit rather than an application compilation failure.

When this occurs:

1. Confirm GitHub `main` contains the intended commit.
2. Confirm GitHub Actions verification separately.
3. Do not repeatedly create commits while the Vercel quota remains blocked.
4. Wait for deployment capacity or change the Vercel plan/quota.
5. Trigger one fresh deployment after the limit clears.

A Ready Preview deployment for an older branch commit does not mean the newer `main` commit reached Production.

## Health Checks

After deployment verify the application origin and:

```text
GET /api/health
GET /api/health/database
```

Expected:

- application health responds successfully.
- database health can reach the configured PostgreSQL database.

A frontend page rendering does not prove database connectivity.

## Production Smoke Test

At minimum:

```text
Sign in
-> Home loads real data
-> Projects opens
-> one Project opens
-> Notifications opens
-> Schedule/Team loads
-> VisiWork loads
-> Reports loads
-> Time In/Time Out state is visible
-> sign out
```

When the release changes collaboration also verify:

```text
send message
-> second client receives it automatically
-> search message
-> exact-message jump
-> Clear removes highlight
-> send after search returns to newest messages
```

When the release changes schema-sensitive workflow also verify the affected write against production.

## Rollback

Application rollback and database rollback are different operations.

A previous Vercel deployment can restore older application code.

Do not automatically reverse a production database migration.
Many migrations are intentionally forward-only and may contain data transformations.

Before rolling application code backward, confirm the older code remains compatible with the current schema.

If not, prepare an explicit forward recovery migration or a reviewed rollback plan.

## Failure Triage

### Build fails before application compilation

Check package installation, Node/pnpm versions, Prisma generation, and Vercel quota.

### Application builds but API fails

Check server environment variables, runtime logs, API routing, and database connectivity.

### Prisma module/client errors

Run:

```bash
pnpm prisma:generate
```

Then restart the API process.

### New code reports missing column/table

Check whether `pnpm prisma:migrate:deploy` was applied to the production database.

### Password reset opens wrong origin

Check the Supabase Auth redirect allow-list and the origin from which the forgot-password request was initiated.

### Email invitation fails

Check Brevo API key, verified sender, server-only environment configuration, and provider response.

## Release Verification Commands

Repository-level:

```bash
pnpm project:doctor
pnpm lint
pnpm typecheck
pnpm test
pnpm test:ui
pnpm build
pnpm test:e2e
```

Full configured shortcut:

```bash
pnpm verify:e2e
```

Cross-browser release verification when required:

```bash
pnpm verify:release
```

Credential-gated browser tests are not evidence when they are skipped.
Record the identities/environment used for a signed-in release smoke separately.
