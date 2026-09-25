# API quotas and production monitoring

Release Milestone 3 adds quotas to mutation and search endpoints and structured warning logs for 5xx responses or requests exceeding 1,000 ms.

## Endpoint-specific quotas

These quotas count **per authenticated member** across every Vercel function instance through the same PostgreSQL table. Quotas use a fixed window beginning with the first request. A 429 response includes `Retry-After` in seconds.

| Operation | Limit | Period |
| --- | ---: | --- |
| Project Chat send | 30 | 60 seconds |
| Project Chat search | 60 | 60 seconds |
| VisiWork General/Department send (shared) | 30 | 60 seconds |
| VisiWork search | 60 | 60 seconds |
| Registry member creation and invitation resend (shared) | 20 | 1 hour |

Authentication is required before quota evaluation. The quotas here are **not** a substitute for Supabase Auth's own anonymous sign-in and password-reset protections. A failed quota-database query fails closed and should be investigated from server logs, not silently bypassed.

The `api_rate_limit_buckets` table must exist before code containing the guard is deployed. Deploy Prisma migrations through the established release procedure. The table stores only hashed bucket identities, a hit count and expiration. Browser roles have no table access.

Once a scheduled maintenance workflow is available, expired rows may be removed in an off-peak window using `DELETE FROM api_rate_limit_buckets WHERE reset_at < NOW() - INTERVAL '7 days';`. Validate this first in staging; no automatic job or production deletion is installed by this release branch.

## Log monitoring

Every API response includes `X-Request-ID`. When a request fails with HTTP 500+ or exceeds 1,000 ms, NestJS emits a structured `api_request` warning containing request ID, method, sanitized route, status and elapsed milliseconds. Unexpected exceptions also flow to the existing error filter. URLs with query parameters, request bodies, session tokens and IPs are not deliberately logged in the request metrics.

Inspect logs for recurring 5xx events and unusually slow endpoints during staging and controlled production smoke checks. Connect an external alert/retention provider only if one is available; this release does **not** claim that automated alerts or a third-party error dashboard are configured.

## Verification

- Run the full CI suite, then the isolated PostgreSQL quota integration test against all migrations.
- Confirm two requests under quota, a 429 with a positive `Retry-After`, another member's independent quota and a reset after expiry.
- Confirm errors do not include search query terms or bearer tokens in application logs.
- Before production promotion, apply database migrations, verify the endpoint configuration and check logs for unexpected rate-limit failures.
