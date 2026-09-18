# Phase 7 - Notifications and Home

## Status

In progress.
The notification backend and persistence foundation and the Notifications UI and shell integration are delivered in two bounded slices.
Phase 7 is not complete.

## Objective

Create durable, user-specific in-app notifications from real Outcome workflow events, expose an authenticated backend surface, and connect it to a complete notification inbox and application-shell unread indicator.

## Slice 1 Scope Delivered

This slice implements notifications for Outcome joins, submissions, revision requests, and Outcome acceptance.
No Notifications UI, shell bell integration, Home aggregation, Home UI, realtime delivery, communication, presence, attachments, or announcements were added.

## Slice 2 Scope Delivered

`/notifications` now renders the authenticated Member's real server-backed inbox in newest-first backend order.
The page includes loading skeletons, an intentional zero-notification state, an unread-filter empty state, a failed-load state with retry, populated notification rows, and mutation failure feedback.
Each row communicates the event meaning, actor, Project, Outcome when present, timestamp, and an explicit Unread label that does not rely on color alone.
The shell now provides a top-right notification bell and a matching sidebar utility badge backed by the real unread-count endpoint.
Zero unread notifications render no badge.
Marking one or all notifications read synchronizes both shell indicators and the inbox.
The prototype's All and Unread filtering and Mark all as read interaction were retained without adding deferred mention or communication behavior.

## Notification Navigation

Notification destinations are derived from canonical response references rather than duplicated persistent navigation state.
Notifications with an Outcome navigate to `/projects/:projectId/outcomes/:outcomeId`.
Project-only notifications navigate to `/projects/:projectId`.
The existing Project and Outcome not-found states handle deleted, invalid, or inaccessible references without introducing a notification-specific dead-end screen.
React Router navigation preserves normal browser Back and Forward behavior.

## Frontend Query and Read-State Behavior

Stable TanStack Query keys cover the notification list and unread count.
The shell and sidebar observe the same unread-count query, so TanStack Query deduplicates the request.
Individual and bulk read mutations optimistically update the list and unread count, snapshot prior cache values, restore both caches on failure, and narrowly invalidate only notification queries for server reconciliation.
Persistent read state remains owned by PostgreSQL through the existing NestJS endpoints and survives refresh.

## Architecture and Data Flow

Existing Project workflow and Outcome delivery services create notifications in the same Prisma transaction as the underlying domain event.
Notification reads and read-state changes derive the recipient exclusively from the authenticated `CurrentMember`.
Responses resolve current Project, Outcome, and actor display data through relations instead of persisting duplicate mutable names.

## Database Changes

Migration `20260918020000_phase_07_notifications` adds `NotificationType` and `notifications`.
Each notification stores recipient, type, stable event key, Project, optional Outcome, optional actor, creation time, and read time.
Foreign keys use restricted deletion to preserve meaningful records.
Indexes support newest-first inbox reads and unread queries.
A unique `(recipient_member_id, event_key)` index makes event fan-out idempotent per recipient.
Row-level security is enabled, and `anon` and `authenticated` receive no direct table privileges because NestJS owns this business-data boundary.

## Recipient and Transaction Rules

- `OUTCOME_JOINED` notifies the Project Lead.
- `SUBMISSION_CREATED` notifies the Project Lead.
- `REVISION_REQUESTED` notifies all current Outcome Members.
- `OUTCOME_ACCEPTED` notifies all current Outcome Members.

The canonical sources do not define self-notification behavior.
This slice excludes the actor from recipients as the least surprising default and records that choice for later product review.
Duplicate recipient IDs are collapsed before insertion.
`createMany({ skipDuplicates: true })` works with the database uniqueness constraint so command retries cannot duplicate the same recipient-event notification.

## API Changes

- `GET /api/notifications` returns only the authenticated Member's notifications in descending creation time and ID order.
- `GET /api/notifications/unread-count` returns only the authenticated Member's unread count.
- `PUT /api/notifications/:notificationId/read` marks a notification read only when it belongs to the authenticated Member.
- `PUT /api/notifications/read-all` marks all notifications for the authenticated Member read.

Shared Zod contracts define notification types, inbox items, list responses, and unread counts.

## Security and Authorization

Every route uses `SupabaseAuthGuard` and `CurrentMember`.
No inbox or read-state endpoint accepts a recipient Member ID.
Cross-recipient read mutation returns not found without revealing another Member's notification.
Direct browser-role database access remains revoked.

## Testing and Verification

Verification performed on 2026-09-18:

- `pnpm prisma:migrate:deploy`: passed and applied migration `20260918020000_phase_07_notifications`; all 16 migrations are applied.
- `pnpm prisma:generate`: passed with Prisma Client 6.19.3.
- `pnpm prisma:validate`: passed.
- Focused contract, notification service/controller, Project workflow, and Outcome delivery tests: 46/46 passed across five files.
- `RUN_DATABASE_INTEGRATION=1 pnpm exec vitest run server/notifications/notifications.service.integration.test.ts`: 1/1 passed against configured PostgreSQL.
- The live integration test proves all four event recipient rules, join and submission retry idempotency, isolated inbox reads, cross-member mark-read denial, unread-count change, and persisted read state through an independent Prisma client.
- `pnpm test`: 144 passed and 18 configured database integration tests skipped; the Phase 7 database test passed separately with database integration enabled.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with zero errors and the pre-existing `RegistryPage.tsx` hook dependency warning.
- `pnpm build`: web and API production builds passed with the existing main-chunk size warning.

Slice 2 focused verification performed on 2026-09-18:

- Focused notification component test: 6/6 passed.
- Full configured React component suite observed during the slice: 28/28 passed across eight files after the notification coverage was added.
- Focused Chromium notification journey: 1/1 passed.
- The Chromium journey proves real persisted notification rendering, shell-bell entry, Outcome navigation, one and only one read mutation, unread-count decrease, Back and Forward behavior, refresh persistence, and responsive document overflow checks.
- Responsive browser checks passed at the existing Desktop Chrome viewport, 820x900, and 390x844.
- The focused browser test observed no console errors, failed notification requests, permanently pending notification requests, or duplicate read mutations.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with zero errors and only the pre-existing `RegistryPage.tsx` hook dependency warning.
- `pnpm build`: passed for the web and API production builds with the existing main-chunk size warning.
- `git diff --check`: passed.

## Decision and Challenge Log

### P7-D01 - Stable notification identity and self-notification behavior

**Status:** Accepted
**Area:** Database and Product
**Impact:** Medium

The workflow requires retry-safe fan-out, while Outcome Membership has a composite identity and the canonical requirements do not define self-notifications.
The implementation derives a stable event key from notification type plus the durable source record ID, or Outcome plus joining Member for the composite join event.
PostgreSQL uniquely constrains that key per recipient.
The actor is excluded from the recipient set to avoid notifying a person about their own action.
If product requirements later choose self-notifications, the filtering rule can change without changing the persistence model.

### P7-D02 - Derived destinations and coordinated optimistic read state

**Status:** Accepted
**Area:** Frontend and Navigation
**Impact:** Medium

The inbox and shell need immediate, consistent read feedback without creating another source of truth or persisting duplicated URLs.
The implementation derives Project and Outcome destinations from existing notification references and keeps only server responses in TanStack Query.
Read mutations update the list and unread-count caches together, preserve rollback snapshots, and reconcile only those two query keys.
This keeps navigation deterministic, avoids global UI state, and allows the backend to remain authoritative after refresh or mutation failure.

## Remaining Phase 7 Work

- Home aggregation over canonical Project, Outcome, work-session, and attention data.
- Home UI.
- Full Phase 7 acceptance and appropriate previous-phase regression.
- Final Phase 7 documentation and closure.

## Phase Exit Result

Not complete.
This journal records the notification foundation and Notifications UI slices.
Home and the complete Phase 7 acceptance gate remain open.
