# Phase 9 Manual Test Cases - Collaboration and Live Updates

## Release Closure Disposition - 2026-09-25

This file remains a repeatable manual regression checklist.

The owning phase has been closed for the current release using the accumulated implementation evidence, automated service/component/integration coverage, recorded browser evidence, and current repository-wide regression.

A checkbox marked complete below records the release closure disposition.
It does not mean a credential-gated browser case was executed in an environment where its credentials were unavailable.

Future changes to the covered behavior should reuse the relevant cases.

## Phase Context

Realtime capabilities are enhancements.

Persistent records remain in PostgreSQL.

Presence is not a substitute for Work Sessions.

Collaboration currently spans VisiWork General and Department chat together with Project Chat.

Project Chat is company-visible for reading, while general Project Chat and announcement writes are restricted to the Project Lead or Project Members.
Only the Project Lead may pin or unpin Project announcements.

Room permissions must continue to follow the approved room-specific communication rules.

The current release uses automatic polling, invalidation, focus refetch, and reconnect refetch for live behavior while persistent records remain authoritative.

Binary chat attachments are a post-release feature and are not part of this release acceptance gate.

## Required Pages and Interfaces

- VisiWork General chat
- VisiWork Department chat
- Project Chat
- Message search and exact-message navigation
- Mentions and mention notifications
- Message editing and deletion
- Automatic live message updates
- exact-message search target clearing and return-to-latest behavior after send
- WorkSession-independent collaboration focus where useful
- collaboration notifications
- reconnect and missed-event recovery from persistent state

## Required Test Setup

Use at least two browsers or browser profiles simultaneously.

Prepare:

- Two authorized Prometheus members
- A member with access to the target Department chat
- A member without access where a room is restricted
- A Project participant or viewer according to the final Project Chat rule
- A Project viewer who is not a Project Member
- A Project Member
- A Project Lead


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

## Project Chat and Project Activity Regression

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F9-32 | Company-visible Project Chat | Open the same Project as an active authorized user who is not the Lead or a Project Member. | Existing general Project Chat is readable, while the composer remains disabled. |
| F9-33 | Project Member send | Open Project Chat as a Project Member and send a valid message. | Message persists and appears in the same Project conversation. |
| F9-34 | Project Lead send | Open Project Chat as the Project Lead and send a valid message. | Message persists and appears in the same Project conversation. |
| F9-35 | Project reply | Reply to an existing Project Chat message. | Reply persists with the correct parent preview and cannot reference a message from another Project. |
| F9-36 | Project search exact message | Search older Project Chat text and choose a result. | The conversation loads surrounding context, scrolls inside the chat viewport, and highlights the exact message. |
| F9-37 | Project mention notification | Mention another active Project participant. | The mention persists and the recipient receives a Mentions notification that navigates to the exact Project Chat message. |
| F9-38 | Add mention during edit | Edit an existing Project Chat message to add a valid mention. | The mention relationship is created and the newly mentioned member receives a Project Chat mention notification. |
| F9-39 | Remove mention during edit | Edit a Project Chat message to remove an existing mention. | The mention relationship and its obsolete Project Chat mention notification are removed. |
| F9-40 | Delete mentioned message | Delete the author's Project Chat message after mentioning another member. | A tombstone preserves message position and replies, deleted text is not searchable, and Project Chat mention notifications for that message are removed. |
| F9-41 | Project Member announcement | Post an announcement as a Project Member. | Announcement persists and is visible in the Project Chat sidebar. |
| F9-42 | Announcement pin authority | Attempt pinning as a Project Member, then as the Project Lead. | Member cannot pin; Project Lead can pin and unpin. |
| F9-43 | Archived Project collaboration | Archive a Project and attempt Chat and announcement mutations. | Existing communication remains readable and new mutations are rejected. |
| F9-44 | Company-visible Project Activity | Open Activity as the Lead, a Project Member, and an unrelated active authorized member. | Each can view the same normal Project activity trail for that Project. |
| F9-45 | Activity metadata safety | Trigger submission/workflow activity whose stored audit metadata contains private details. | The Project Activity API exposes only approved display-safe fields and does not expose private submission text. |
| F9-46 | General versus Outcome message scope | Verify general Project Chat after an Outcome-scoped ProjectMessage fixture exists. | General Project Chat returns only messages whose `outcome_id` is null. |

## Presence and WorkSession Separation

The current release intentionally does not ship a separate online/offline presence source of truth.

VisiWork focus is an operational Department context.
Working Now is derived from persisted WorkSessions.

Regression requirement:

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F9-08 | WorkSession remains authoritative | Time In, change VisiWork focus, navigate away, and return. | Working Now remains based on the persisted WorkSession and is not rewritten by collaboration focus. |
| F9-09 | Multiple tabs | Open the same user in multiple tabs. | No duplicate persistent member or WorkSession identity is created. |
| F9-10 | Reconnect | Disconnect and reconnect a collaboration client. | Persisted messages and current WorkSession state are recovered through refetch. |

## Post-Release Attachment Backlog

F9-13 through F9-20 from the original plan are intentionally removed from the current release gate.

When binary chat attachments are implemented, restore coverage for supported/unsupported types, size limits, refresh persistence, authorized retrieval, unauthorized direct access, failed-upload cleanup, and duplicate filenames.

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
-> Project Chat is readable company-wide but writable only by its Project Lead or Project Members
-> Project Chat replies, search, mentions, edit/delete, announcements, and Activity follow their approved Project rules
-> mention notifications stay synchronized with Project Chat edits and deletion
-> clearing a search removes its highlight
-> sending after a search returns the conversation to the newest messages
-> User A disconnects and reconnects
-> missed persistent data is recovered
-> Work Session truth remains independent from presence
```

## Phase 9 Exit Checklist

- [x] VisiWork General and Department chat are persistent and correctly isolated.
- [x] Search returns authorized messages and exact-message navigation works.
- [x] Clearing search removes the selected-message highlight.
- [x] Sending after a search clears the target and returns to the newest messages.
- [x] Mentions persist and route notifications to the correct room and message.
- [x] Edit/delete rules are enforced by the backend and soft deletion preserves conversation integrity.
- [x] Project Chat follows the approved Project communication rules.
- [x] Project Chat mention notifications stay synchronized after mention edits and message deletion.
- [x] Project announcements follow Project Member posting and Project Lead pinning rules.
- [x] Normal Project Activity remains company-visible without exposing unsafe audit metadata.
- [x] General Project Chat excludes Outcome-scoped Project messages.
- [x] Automatic live message updates do not require manual reload during normal connected use.
- [x] Reconnect/focus refresh recovers persistent state without creating duplicate history.
- [x] Collaboration focus and refresh do not alter WorkSession truth.
- [x] Collaboration notifications are persisted and recoverable from canonical data.
- [x] Collaboration rules do not bypass core authorization.

Binary chat attachments are post-release and are not represented by a completed checkbox.
