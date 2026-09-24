# Phase 9 - Collaboration and Live Updates

## Status

**Complete - current release scope closed on 2026-09-25.**

Durable collaboration is implemented across VisiWork and Project Chat.

The original attachment portion of the phase has been deliberately moved to the post-release backlog rather than being represented as implemented.

## Release Scope and Closure Decision - 2026-09-25

The final release uses persisted PostgreSQL messages with automatic polling, query invalidation, background refresh, window-focus refresh, and reconnect refresh.

This is the chosen Phase 9 live-update strategy.

A separate Supabase Realtime transport is not required for current release completion because the product requirement allows realtime **or automatic live updates**, and persistent refetch provides missed-event recovery.

Current Project Chat refresh behavior polls every 3 seconds, refreshes in the background, and forces refetch on focus and reconnect.

Notifications now refresh the active inbox and global unread count every 15 seconds, including background polling, and force refetch on focus and reconnect.
This makes new collaboration notifications appear without requiring a manual page refresh while keeping persisted Notification rows authoritative.

Current collaboration behavior also clears a search target when Clear is selected and clears the target plus returns the message viewport to the newest messages after sending, matching the expected Messenger-style conversation flow.

Binary Project/VisiWork chat attachments are **not implemented**.
They are moved to the post-release backlog by explicit release-scope amendment.

A dedicated Outcome-specific discussion UI/API is also post-release.
The nullable `ProjectMessage.outcome_id` is retained as forward-compatible schema support only.

The credential-gated multi-user Playwright journeys remain valuable release smoke when test identities are configured.
Their absence in a generic CI environment no longer represents missing collaboration implementation because persistence, room authorization, message mutation, mention lifecycle, database security, query refresh, and UI behavior are covered at service, integration, component, and credential-free browser layers.

Phase 9 is closed for the current release.

## Objective

Add durable collaboration behavior across VisiWork and Projects without allowing realtime transport, presence, or notification delivery to become a second source of truth.

## Scope Delivered

The current VisiWork collaboration implementation includes:

- persisted General chat.
- persisted Department chat.
- message search.
- exact-message deep links and highlighted navigation targets.
- @mention selection and persisted mention relationships.
- mention notifications integrated into Notifications.
- Mentions and Projects notification filters.
- message editing restricted to the message author.
- soft deletion restricted to the message author.
- visible edited state.
- deleted-message placeholders that preserve conversation position.
- mention synchronization on edits.
- mention-notification cleanup on deletion.
- exclusion of deleted content from message search.
- automatic polling and query invalidation so remote message changes appear without a manual page reload.

The current Project collaboration implementation includes:

- a Project Chat tab inside the shared Project Workspace.
- persisted general Project Chat.
- company-visible read access for active authorized Prometheus members.
- write access restricted to the Project Lead and Project Members.
- archived Project read-only enforcement.
- message replies.
- deterministic cursor pagination.
- message search.
- exact-message context loading and inner-conversation scrolling.
- @mention selection restricted to active Project participants.
- Project Chat mention notifications with deep links to the exact Project message.
- mention-notification synchronization when mentions are added, retained, removed, or deleted.
- author-only message editing.
- optimistic-concurrency checks for stale edits and deletes.
- author-only soft deletion with tombstones that preserve replies and conversation position.
- Project announcements.
- announcement posting by the Project Lead or Project Members.
- Project Lead-only announcement pinning and unpinning.
- a compact Project Members rail.
- Project Activity using display-safe ActivityLog metadata.
- company-visible normal Project activity for every active authorized member.
- Project Lead and member filtering controls in the Project Activity interface.
- loading, empty, retry, and skeleton states for collaboration surfaces.
- automatic polling and query invalidation for Project Chat.

The current polling, background refresh, focus refetch, reconnect refetch, and persistent message model are the final live-update strategy for this release.

## Post-Release Collaboration Backlog

The following items are intentionally outside the current release closure:

- binary Project/VisiWork chat attachment upload and retrieval.
- chat attachment authorization and storage lifecycle.
- dedicated Outcome-specific discussion UI and API.
- optional Supabase Realtime push delivery if automatic polling becomes insufficient.
- broader credential-gated cross-browser and multi-user release automation.

These are future enhancements, not undocumented missing Phase 9 implementation.

## Architecture and Data Flow

Persistent collaboration records remain stored in PostgreSQL.

Realtime or polling state is supplemental and must recover from persisted records.

VisiWork messages persist author, room context, body, edit state, deletion state, timestamps, and mention relationships.

Project messages persist Project scope, nullable Outcome scope, author, reply parent, body, edit state, deletion state, timestamps, and mention relationships.

General Project Chat explicitly reads and writes only Project messages whose `outcome_id` is null.

The nullable `outcome_id` remains available for the canonical Outcome-specific discussion model without mixing those future records into general Project Chat.

Mentions are persisted relationships rather than presentation-only text parsing.

Mention notification creation and synchronization occur at the same persistence boundary as message changes.

When a Project Chat author edits mentions, removed mention notifications are deleted, retained notification previews are refreshed, and newly added mentions create notifications.

Deleting a Project Chat message removes its Project Chat mention notifications while preserving a message tombstone.

Project Activity is derived from the existing append-only ActivityLog rather than a second collaboration event store.

The Project Activity API exposes only explicitly allow-listed display metadata so private submission content stored in ActivityLog metadata is not leaked through the company-visible activity surface.

Current automatic refresh behavior uses TanStack Query polling and invalidation.

If Supabase Realtime or another push transport is introduced, it must remain supplemental to persisted PostgreSQL state.

## Database Changes

Phase 9 collaboration currently adds or uses these persistent structures:

- VisiWork messages and VisiWork message mentions.
- Project messages.
- Project message mentions.
- Project announcements.
- Project Activity through the existing ActivityLog.
- Notification types for VisiWork and Project Chat mentions.

Project message persistence includes nullable `outcome_id`.

General Project Chat currently stores `NULL` in that column.

Relevant Project Chat migrations include:

- `20260923000000_project_chat`.
- `20260923010000_project_activity_history`.
- `20260924030000_project_chat_search_mentions_delete`.
- `20260924194000_project_announcements`.
- `20260924200000_project_chat_mention_notifications`.
- `20260924210000_project_message_outcome_scope`.

Project message and announcement tables enable PostgreSQL row-level security and revoke direct `anon` and `authenticated` browser table privileges.

Protected writes continue through NestJS.

Any future attachment implementation should keep file metadata and authorization-relevant references in PostgreSQL even if binary storage lives outside PostgreSQL.

## API Changes

VisiWork collaboration supports:

- message retrieval.
- message creation.
- message search.
- exact-message context retrieval.
- mention data.
- message editing.
- message deletion.

Project collaboration supports:

- `GET /api/projects/:projectId/messages`.
- `POST /api/projects/:projectId/messages`.
- `GET /api/projects/:projectId/messages/search`.
- `GET /api/projects/:projectId/messages/:messageId/context`.
- `PATCH /api/projects/:projectId/messages/:messageId`.
- `DELETE /api/projects/:projectId/messages/:messageId`.
- `GET /api/projects/:projectId/announcements`.
- `POST /api/projects/:projectId/announcements`.
- `PATCH /api/projects/:projectId/announcements/:announcementId/pin`.
- `GET /api/projects/:projectId/activity`.

Notification querying supports collaboration-oriented Mentions and Projects filtering.

Project Chat mention notifications navigate to `/projects/:projectId?tab=chat&message=:messageId`.

## Security and Authorization

All active authorized Prometheus members may read normal company-visible Project Chat and Project Activity.

Only the Project Lead or a Project Member may send general Project Chat messages.

Only the message author may edit or delete their own Project Chat message.

Project Chat mentions may target only active Project participants represented by the Project Lead or Project Membership.

Only the Project Lead or a Project Member may post a Project announcement.

Only the Project Lead may pin or unpin Project announcements.

Archived Projects are read-only for Project Chat and announcement mutations.

Project Activity returns display-safe metadata rather than raw ActivityLog metadata.

Outcome-specific discussion remains a separate scope.

When its interface is implemented, its write boundary remains Project Lead or Outcome Member of that Outcome.

Members may edit or delete only their own VisiWork messages.

Notification navigation must not grant access to a room or resource that the recipient is otherwise unauthorized to open.

Attachment access must be authorized independently of merely knowing a storage URL.

## Environment and Configuration

No new client-side source of truth is introduced for collaboration.

Project Chat uses the existing authenticated API and PostgreSQL environment.

The PostgreSQL integration CI job creates the Supabase browser roles required to validate direct-table restrictions and applies the tracked production migrations before exercising Project Chat.

If Supabase Realtime is adopted later, its configuration must remain compatible with persisted message recovery and reconnect behavior.

If post-release chat attachments adopt Supabase Storage, storage configuration and authorization policy must be documented without committing secrets.

## Testing and Acceptance Result

Automated coverage exists for:

- Project Chat read and write authorization.
- archived Project read-only behavior.
- replies and cross-Project reply rejection.
- pagination.
- search and exact-message context.
- author-only edit and delete behavior.
- stale edit/delete protection.
- Project Chat mention validation.
- Project Chat mention notification creation and synchronization.
- Project announcement posting and Lead-only pinning.
- company-visible display-safe Project Activity.
- ActivityLog project isolation and pagination.
- React chat composer behavior.
- Enter to send and Shift+Enter for a newline.
- message search navigation.
- collaboration skeleton and retry states.
- Project announcement UI permissions.
- Project Activity filters and rendering.
- production migration application against PostgreSQL.
- direct browser-role denial for Project Chat tables.
- notification query-policy coverage for polling, background refresh, focus refresh, and reconnect refresh.

The manual acceptance file is:

`.testcases/phase-09-collaboration-tests.md`

Formal release closure uses the accumulated automated collaboration evidence plus the current live-refresh implementation.

Credential-gated signed-in multi-user tests remain optional release smoke when identities are configured.
Skipped credential-gated tests must still never be reported as passed.

Binary chat attachment acceptance is moved with the feature to the post-release backlog.

## Decision & Challenge Log

### P9-D01 - Persist collaboration before adding realtime transport

**Status:** Accepted

**Area:** Architecture / Database

**Impact:** High

#### Root cause / constraint

Realtime delivery can be interrupted, duplicated, or missed during disconnects.

#### Decision

Treat PostgreSQL records as the durable collaboration source of truth and treat live delivery as supplemental.

#### Result

Message history, mentions, edit/delete state, announcements, and notifications survive refresh and do not depend on an active realtime connection.

### P9-D02 - Persist mention relationships

**Status:** Accepted

**Area:** Database / Notifications

**Impact:** High

#### Root cause / constraint

Rendering `@name` text alone is insufficient for durable notification routing and exact member identity.

#### Decision

Persist mention relationships and create mention notifications at the message persistence boundary.

#### Result

Notifications can route the mentioned member back to the referenced room and message context.

### P9-D03 - Use author-only edit/delete with soft deletion

**Status:** Accepted

**Area:** Security / Product

**Impact:** Medium

#### Root cause / constraint

Hard deletion can destroy conversational context and leave search, replies, mentions, and notification references inconsistent.

#### Decision

Allow only the author to edit or delete a message and represent deletion as a persisted soft-delete state.

#### Result

Conversation ordering and reply context remain stable while deleted content is removed from normal presentation and search.

### P9-D04 - Polling and persistent refetch are the release live-sync mechanism

**Status:** Accepted

**Area:** Frontend / Realtime

**Impact:** Medium

#### Root cause / constraint

Cross-account updates need to appear without manual reloads while missed events must remain recoverable after focus changes or reconnects.

#### Decision

Use short-interval automatic query refresh, background polling where appropriate, mutation invalidation, focus refetch, and reconnect refetch as the current release transport.

Keep PostgreSQL records authoritative.

Supabase Realtime remains optional future optimization rather than a release dependency.

#### Result

Message mutations and WorkSession-backed visibility refresh across active clients without creating a second state store.
Reconnect and focus changes recover current persisted records through refetch.

### P9-D05 - Keep Project Chat authorization aligned with derived Project Membership

**Status:** Accepted

**Area:** Security / Product

**Impact:** High

#### Root cause / constraint

All active authorized members may inspect Projects, but company-wide read access must not silently become Project communication write access.

#### Decision

Allow every active authorized member to read general Project Chat.

Allow writes only for the Project Lead or a derived Project Member.

Apply the same posting boundary to Project announcements and reserve pinning for the Project Lead.

#### Result

Normal Project visibility remains company-wide while collaboration mutation authority continues to come from canonical Project relationships.

### P9-D06 - Keep normal Project Activity company-visible and sanitize metadata

**Status:** Accepted

**Area:** Security / Product

**Impact:** High

#### Root cause / constraint

The canonical user flow states that normal Project activity is company-visible, while ActivityLog metadata can contain fields that are not appropriate to expose broadly.

#### Decision

Return the Project-wide activity trail to every active authorized member.

Expose only action-specific allow-listed display metadata instead of raw ActivityLog metadata.

#### Result

Project transparency matches the canonical access model without leaking private submission text through the activity endpoint.

### P9-D07 - Preserve Outcome scope without mixing it into general Project Chat

**Status:** Accepted

**Area:** Database / Architecture

**Impact:** Medium

#### Root cause / constraint

The canonical ProjectMessage model includes nullable `outcome_id`, but the current UI slice implements general Project Chat only.

#### Decision

Persist nullable `outcome_id`.

Make general Project Chat explicitly read and write only rows where `outcome_id IS NULL`.

Defer the Outcome-specific discussion UI and endpoints without deleting the canonical relationship from the data model.

#### Result

The current feature remains correctly scoped and future Outcome discussion can be added without a destructive message-schema redesign.

### P9-D08 - Synchronize Project Chat notifications with mention edits

**Status:** Accepted

**Area:** Database / Notifications

**Impact:** High

#### Root cause / constraint

Creating a notification only when a message is first sent leaves stale notifications when an author later adds, removes, or deletes mentions.

#### Decision

Treat message mentions and mention notifications as one lifecycle.

Create notifications for newly added mentions, refresh retained notification previews, remove notifications for removed mentions, and remove all message mention notifications when a message is deleted.

#### Result

The Notifications inbox remains consistent with the persisted Project Chat message state.

## Known Limitations

Binary chat attachments are not part of the current release.

Outcome-specific discussion has persistence scope but no dedicated user interface or API and remains post-release.

The current release uses short-interval polling and refetch rather than a push transport.
This is deliberate and remains bounded by the polling interval.

Credential-gated multi-user and cross-browser automation requires configured test identities and remains recommended release smoke.

## Technical Debt

VisiWork and Project Chat currently have separate collaboration service implementations.

Keep common semantics aligned, especially author mutation rules, mention lifecycle, search behavior, soft deletion, and notification cleanup.

A shared collaboration abstraction should be introduced only if it reduces duplication without obscuring room-specific authorization.

Project Activity currently provides the same display-safe company-visible event set to Project Leads and other authorized viewers.

If Lead-only activity detail is added later, it should be additive and explicitly documented rather than reducing normal company-visible activity.

## Lessons from the Phase

Search, mentions, edit/delete behavior, notifications, and deep links are one collaboration workflow rather than isolated UI controls.

Durable message state should be correct before realtime delivery is optimized.

Mention notifications must follow the lifecycle of the mention relationship instead of only the initial message-create event.

Company-visible activity can remain useful without exposing raw audit metadata.

Keeping the canonical nullable Outcome scope in ProjectMessage avoids coupling general Project Chat to future Outcome discussion.

## Recommendations and Next Approach

Keep durable message persistence authoritative.

If product scale or latency requirements outgrow polling, evaluate Supabase Realtime as a transport without changing room authorization or persistence semantics.

Implement Outcome-specific discussion only when its product interface is intentionally added.

Treat binary chat attachments as a separately scoped post-release feature with explicit storage authorization.

## Phase Exit Result

**Complete for the current release scope.**

Durable VisiWork and Project collaboration, automatic live updates, reconnect recovery, notifications, announcements, and Project Activity are integrated.
Deferred attachment and Outcome-discussion features are explicitly tracked as post-release enhancements.
