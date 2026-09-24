# Prometheus Environment Variable Reference

## Classification Rule

Variables prefixed with `VITE_` are bundled for browser use.

Never put secrets in a `VITE_*` variable.

Server-only values must remain unprefixed.

## Backend and Runtime

### `PORT`

NestJS API port.

Local default in the example:

```text
3001
```

### `CLIENT_ORIGINS`

Comma-separated browser origins permitted by the API CORS configuration.

Local example:

```text
http://localhost:5173,http://localhost:4173
```

Include only origins the environment actually needs.

## PostgreSQL

### `DATABASE_URL`

Server-only Prisma application connection.

The example uses a pooled PostgreSQL connection.

### `DIRECT_URL`

Server-only direct PostgreSQL connection used for migration-sensitive Prisma operations.

Both values contain credentials and must never be browser-exposed.

## Supabase Auth - Server

### `SUPABASE_URL`

Supabase project URL used by backend authentication verification.

### `SUPABASE_ANON_KEY`

Public anon key used by the server where supported by the authentication design.

The anon key is not the Supabase service-role key.

Do not substitute a service-role key into browser configuration.

## Supabase Auth - Browser

### `VITE_SUPABASE_URL`

Browser-visible Supabase project URL.

### `VITE_SUPABASE_ANON_KEY`

Browser-visible Supabase anon key.

These are intentionally public client configuration values.

## API Base

### `VITE_API_BASE_URL`

Optional browser API base.

Use:

```text
/api
```

for normal same-origin behavior.

Local worktrees may use their Vite proxy rather than hard-code a backend origin.

## Public Application Origin

### `APP_URL`

Server-only application origin used when generating account-setup/invitation links.

Production must use the real deployed origin.

This value is separate from the browser password-recovery redirect, which is built from `window.location.origin`.

## Brevo

All Brevo variables are server-only.

### `BREVO_API_KEY`

Brevo API credential.

Secret.

### `BREVO_SENDER_EMAIL`

Verified sender address.

### `BREVO_SENDER_NAME`

Sender display name.

Default example:

```text
Prometheus
```

## Work Sessions

### `WORK_SESSION_MAX_HOURS`

Maximum open-session age before Prometheus flags the WorkSession for correction.

The documented default is 16 hours.

The system does not silently invent a Time Out when the threshold is crossed.

## Seed Configuration

### `PROMETHEUS_SEED_MEMBERS_JSON`

Optional development-only seed input.

It does not create Supabase Auth accounts or passwords.

Use non-production identities.

## Browser E2E

### `E2E_MEMBER_EMAIL`

Credential-gated Playwright identity.

### `E2E_MEMBER_PASSWORD`

Supabase Auth password for the E2E Member.

These are test credentials, not database credentials.

Do not commit their values.

## Production Checklist

Before a production release confirm:

- server and browser Supabase project values point at the intended project.
- database URLs point at the intended environment.
- `APP_URL` uses the production origin.
- production origin is present in `CLIENT_ORIGINS` where required.
- Supabase Auth redirect allow-list includes production login/account-setup/recovery destinations used by the app.
- Brevo sender is verified.
- no server secret is stored in a `VITE_*` variable.
- `WORK_SESSION_MAX_HOURS` is intentionally configured or the documented default is accepted.

## Local Worktree Checklist

When running several worktrees:

- give each frontend/API pair non-conflicting ports.
- keep each frontend proxy pointed at its own API.
- verify each worktree's `.env` rather than assuming it matches another checkout.
- regenerate Prisma Client after dependency/schema changes.
- apply committed migrations before testing schema-dependent features.
