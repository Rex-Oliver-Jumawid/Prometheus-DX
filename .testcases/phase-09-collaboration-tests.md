# Phase 9 Manual Test Cases - Collaboration, Realtime, and Attachments

## Phase Context

Realtime capabilities are enhancements.

Persistent records remain in PostgreSQL.

Presence is not a substitute for Work Sessions.

Collaboration currently spans VisiWork General and Department chat, with Project Chat still part of the Phase 9 target scope.

Chat permissions should follow the final approved room-specific communication rules.

Automatic polling or Supabase Realtime may be used where live behavior has clear value, but persistent records remain authoritative.

Supabase Storage may be used for attachments while PostgreSQL stores metadata and authorization-relevant references.

## Required Pages and Interfaces

- VisiWork General chat
- VisiWork Department chat
- Project Chat
- Message search and exact-message navigation
- Mentions and mention notifications
- Message editing and deletion
- Realtime or automatic live message updates
- Presence where useful
- Realtime notifications where useful
- Attachment upload
- Attachment retrieval
- Attachment permission handling
- Reconnect and missed-event recovery behavior

## Required Test Setup

Use at least two browsers or browser profiles simultaneously.

Prepare:

- Two authorized Prometheus members
- A member with access to the target Department chat
- A member without access where a room is restricted
- A Project participant or viewer according to the final Project Chat rule
- Supported attachment
- Unsupported attachment type
- Oversized attachment


## How to Execute These Tests

Execute the tests manually from the browser using real application routes and API behavior.

Mark each case as:

- `PASS`
- `FAIL`
- `BLOCKED`

When a case fails, record:

- Browser and viewport
- User account and role
- Exact steps performed
- Expected result
- Actual result
- Screenshot or screen recording when useful
- Browser console error
- Network request and response status when relevant
- Related database record when relevant

Do not mark a test as passed only because the interface looks correct.

Permission-sensitive tests must be verified against backend behavior as well.

## Global Visual and Interaction Checks

Apply these checks to every page in this phase:

- No overlapping elements.
- No clipped controls or text.
- No accidental page-level horizontal scrollbar.
- No unexpected vertical scrollbar inside fixed layouts.
- Modal and drawer positioning is correct.
- Long names and descriptions do not destroy the layout.
- Loading states do not cause major layout jumps.
- Empty states are intentional.
- Error states are understandable.
- Keyboard focus is visible.
- Buttons cannot be accidentally triggered twice.
- Refresh preserves server-backed state.
- Browser Back and Forward behave naturally.
- Direct URL navigation works.
- There are no unexplained console errors.


## Chat Tests

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F9-01 | Send message | User A sends valid message. | Message appears and persists. |
| F9-02 | Realtime receive | User B keeps conversation open while A sends. | B receives message without refresh. |
| F9-03 | Refresh history | Refresh conversation. | Previous messages remain. |
| F9-04 | Blank message | Attempt to send blank content. | Prevented. |
| F9-05 | Rapid messages | Send several messages quickly. | Ordering remains correct. |
| F9-06 | Unauthorized conversation access | Attempt direct route/API as unauthorized user. | Denied. |
| F9-07 | Reconnect | Disconnect network briefly, reconnect, then send/receive. | Realtime recovers without duplicated history. |

## VisiWork Collaboration Regression

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F9-24 | General chat persistence | Send a General chat message, reload, and reopen VisiWork. | Message remains in the correct room and retains its author and timestamp. |
| F9-25 | Department room isolation | Send different messages in two Department rooms and switch between them. | Each room shows only its authorized conversation history. |
| F9-26 | Search exact message | Search for known message text and select a result. | VisiWork opens the correct room, loads the surrounding context, and highlights or targets the exact message. |
| F9-27 | Mention notification | Mention User B from User A's message. | The mention is persisted and User B receives a Mentions notification that navigates to the referenced room and message. |
| F9-28 | Edit own message | User A edits their own message and User B keeps the same room open. | The changed content persists, the edited state is visible, and the other client updates without a manual reload. |
| F9-29 | Cannot edit another member's message | User B attempts the edit mutation against User A's message. | Backend authorization rejects the mutation and the original content remains. |
| F9-30 | Soft delete own message | User A deletes their own message. | Conversation position is preserved with a deleted placeholder, deleted content is excluded from search, and obsolete mention notifications are removed as defined. |
| F9-31 | Cannot delete another member's message | User B attempts the delete mutation against User A's message. | Backend authorization rejects the mutation and the message remains unchanged. |

## Presence Tests

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F9-08 | Presence online | Open Prometheus in Browser A. | User appears active according to presence rules. |
| F9-09 | Presence offline | Close/disconnect Browser A. | Presence eventually updates. |
| F9-10 | Multiple tabs | Open same user in multiple tabs. | Presence does not create confusing duplicate people. |
| F9-11 | Presence versus Work Session | User remains timed in but closes app. | Work Session remains valid even if presence becomes offline. |
| F9-12 | Reconnect presence | Reopen after disconnect. | Presence recovers cleanly. |

## Attachment Tests

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F9-13 | Supported upload | Upload supported file. | Upload completes and metadata persists. |
| F9-14 | Unsupported type | Upload forbidden file type. | Rejected clearly. |
| F9-15 | Oversized file | Upload file above configured limit. | Rejected without breaking page. |
| F9-16 | Refresh attachment | Refresh after upload. | Attachment remains available. |
| F9-17 | Download or open | Access attachment as authorized user. | Correct file is retrieved. |
| F9-18 | Unauthorized direct file access | Attempt storage/file URL as unauthorized user where protection is required. | Access is denied. |
| F9-19 | Failed upload cleanup | Interrupt upload midway. | No fake completed attachment record remains. |
| F9-20 | Duplicate filename | Upload two files with same filename. | Storage references remain unique and both records are handled correctly. |

## Realtime Notification Tests

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F9-21 | Live notification | Trigger a notification event while recipient has app open. | Notification appears without refresh. |
| F9-22 | Persistence | Refresh after live notification. | Notification remains because it is persistent data. |
| F9-23 | Reconnect missed event | Disconnect recipient, trigger event, reconnect. | Persistent notification is recovered even if live event was missed. |

## Phase 9 Main E2E Flow

```text
User A and User B open the same authorized collaboration room
-> User A sends a persisted message
-> User B receives the update without manual reload
-> User A mentions User B
-> User B opens the mention notification
-> navigation returns to the exact room and message
-> User A edits and then deletes one of their own messages
-> User B sees the persisted mutation state
-> Project Chat follows its approved Project permission rules
-> User A uploads an attachment
-> User B can access it according to permissions
-> User A disconnects and reconnects
-> missed persistent data is recovered
-> Work Session truth remains independent from presence
```

## Phase 9 Exit Checklist

- [ ] VisiWork General and Department chat are persistent and correctly isolated.
- [ ] Search returns authorized messages and exact-message navigation works.
- [ ] Mentions persist and route notifications to the correct room and message.
- [ ] Edit/delete rules are enforced by the backend and soft deletion preserves conversation integrity.
- [ ] Project Chat follows the approved Project communication rules.
- [ ] Live message updates do not require manual reload during normal connected use.
- [ ] Reconnect behavior recovers missed persistent state without duplicate history.
- [ ] Presence does not alter Work Session truth.
- [ ] Attachment metadata and storage references are consistent.
- [ ] Unauthorized attachment access is blocked where required.
- [ ] Live notifications are recoverable from persistent data.
- [ ] Collaboration rules do not bypass core authorization.
