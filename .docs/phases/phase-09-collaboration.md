# Phase 9 - Collaboration, Realtime, and Attachments

## Status

In progress.

Several collaboration capabilities are already implemented and integrated on `main` through VisiWork.

Project Chat, the final realtime transport and reconnect behavior, attachment handling, and formal Phase 9 acceptance remain pending.

## Objective

Add durable collaboration behavior across VisiWork and Projects without allowing realtime transport, presence, or notification delivery to become a second source of truth.

## Scope Delivered

The integrated VisiWork collaboration implementation currently includes:

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
- automatic polling/refresh behavior so cross-account message changes and work-presence changes appear without a manual page reload.

The current polling behavior improves live synchronization but is not treated as proof that the final realtime/reconnect scope is complete.

## Scope Pending

The remaining planned Phase 9 scope includes:

- Project Chat.
- final approved Project Chat permission rules.
- realtime message delivery where adopted.
- realtime notification delivery where useful.
- reconnect and missed-event recovery behavior.
- attachment upload and retrieval.
- attachment authorization.
- attachment metadata and storage lifecycle.
- final cross-browser and multi-user acceptance.

## Architecture and Data Flow

Persistent collaboration records remain stored in PostgreSQL.

VisiWork messages have persisted author, room context, body, edit state, deletion state, and timestamps.

Mentions are persisted relationships rather than presentation-only text parsing.

Mention notification creation is integrated with the message persistence boundary so the notification record and mention relationship remain aligned.

Soft deletion keeps message position stable while preventing deleted content from appearing as active searchable message text.

Current automatic refresh behavior uses application polling/invalidation.
If Supabase Realtime or another push transport is introduced, it must remain supplemental to persisted PostgreSQL state.

## Database Changes

The current data model includes persisted VisiWork messages and VisiWork message mentions.

Message records include edit and deletion timestamps.

Notification records support the VisiWork mention notification type.

Any future attachment implementation should keep file metadata and authorization-relevant references in PostgreSQL even if binary storage lives outside PostgreSQL.

## API Changes

The VisiWork service and shared contracts support:

- message retrieval.
- message creation.
- message search.
- mention data.
- message editing.
- message deletion.

Notification querying supports collaboration-oriented Mentions and Projects filtering.

Exact endpoints and final Project Chat APIs should be recorded here when that slice is implemented.

## Security and Authorization

Members may edit or delete only their own VisiWork messages.

Room access and future Project Chat access must follow the final approved product rules and be enforced by the backend.

Notification navigation must not grant access to a room or resource that the recipient is otherwise unauthorized to open.

Attachment access must be authorized independently of merely knowing a storage URL.

## Environment and Configuration

No new client-side source of truth is introduced for collaboration.

If Supabase Realtime is adopted later, its configuration must remain compatible with persisted message recovery and reconnect behavior.

If Supabase Storage is adopted for attachments, storage configuration and authorization policy must be documented without committing secrets.

## Testing and Acceptance Result

Focused automated coverage exists for VisiWork message behavior, including persisted mentions, notification creation, search, edit/delete state, and notification navigation.

The manual acceptance file is:

`.testcases/phase-09-collaboration-tests.md`

Formal Phase 9 acceptance has not been completed.

The existing automated evidence for VisiWork collaboration does not prove the pending Project Chat, final realtime transport, reconnect, or attachment scope.

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

Message history, mentions, edit/delete state, and notifications survive refresh and do not depend on an active realtime connection.

### P9-D02 - Persist mention relationships

**Status:** Accepted

**Area:** Database / Notifications

**Impact:** High

#### Root cause / constraint

Rendering `@name` text alone is insufficient for durable notification routing and exact member identity.

#### Decision

Persist mention relationships and create mention notifications at the message persistence boundary.

#### Result

Notifications can route the mentioned member back to the referenced VisiWork room and message context.

### P9-D03 - Use author-only edit/delete with soft deletion

**Status:** Accepted

**Area:** Security / Product

**Impact:** Medium

#### Root cause / constraint

Hard deletion can destroy conversational context and leave search, mentions, and notification references inconsistent.

#### Decision

Allow only the author to edit or delete a message and represent deletion as a persisted soft-delete state.

#### Result

Conversation ordering remains stable while deleted content is removed from normal presentation and search.

### P9-D04 - Polling is an interim live-sync mechanism, not the phase exit criterion

**Status:** Accepted

**Area:** Frontend / Realtime

**Impact:** Medium

#### Root cause / constraint

Cross-account updates need to appear without manual reloads before the final realtime transport decision is complete.

#### Decision

Use automatic query refresh and invalidation for the current integrated behavior.

Do not describe that mechanism as completion of the final realtime and reconnect scope.

#### Result

Message mutations and Work Session presence refresh across active clients while the durable database remains authoritative.

## Known Limitations

Project Chat is still pending.

Attachments are still pending.

The final realtime transport and reconnect strategy is still pending.

Current collaboration behavior is strongest in VisiWork General and Department chat and should not be generalized to Project Chat permissions until that implementation is complete.

## Technical Debt

Avoid duplicating VisiWork message rules when Project Chat is implemented.

Prefer a shared collaboration domain or deep module where common message behavior, author mutation rules, mention parsing, search semantics, and notification creation can be reused without coupling room-specific authorization.

## Lessons from the Phase

Search, mentions, edit/delete behavior, notifications, and deep links are one collaboration workflow rather than isolated UI controls.

Durable message state should be correct before realtime delivery is optimized.

Soft deletion simplifies reference integrity compared with hard deletion when messages can be searched, mentioned, and linked from notifications.

## Recommendations and Next Approach

Implement Project Chat as the next vertical collaboration slice.

Reuse the existing durable message and notification concepts where they fit, but keep Project-specific authorization explicit.

After Project Chat is correct with persisted state, decide whether polling remains acceptable or whether Supabase Realtime materially improves message and notification delivery.

Add reconnect tests that prove missed events are recovered from persistent state.

Implement attachments only after message and room authorization boundaries are stable.

## Phase Exit Result

Not yet complete.

VisiWork collaboration has delivered meaningful Phase 9 functionality, but Project Chat, final realtime/reconnect behavior, attachments, and formal acceptance remain open.
