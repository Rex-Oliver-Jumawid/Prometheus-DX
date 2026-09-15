# Phase 9 Manual Test Cases - Collaboration, Realtime, and Attachments

## Phase Context

Realtime capabilities are enhancements.

Persistent records remain in PostgreSQL.

Presence is not a substitute for Work Sessions.

Project chat permissions should follow the final approved communication rules.

Supabase Realtime may be used where realtime behavior has clear value.

Supabase Storage may be used for attachments while PostgreSQL stores metadata and references.

## Required Pages and Interfaces

- Project chat
- Realtime message updates
- Presence
- Realtime notifications where useful
- Attachment upload
- Attachment retrieval
- Attachment permission handling

## Required Test Setup

Use at least two browsers or browser profiles simultaneously.

Prepare:

- Authorized participant
- Authorized viewer according to final chat rule
- Unauthorized user if a restricted conversation exists
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
User A and User B open same project
-> User A sends message
-> User B receives it live
-> User A uploads attachment
-> User B can access it according to permissions
-> User A disconnects
-> Presence updates
-> Persistent project/chat data remains intact
```

## Phase 9 Exit Checklist

- [ ] Realtime messages are persistent.
- [ ] Realtime reconnect behavior is stable.
- [ ] Presence does not alter Work Session truth.
- [ ] Attachment metadata and storage references are consistent.
- [ ] Unauthorized attachment access is blocked where required.
- [ ] Realtime notifications are recoverable from persistent data.
- [ ] Collaboration rules do not bypass core authorization.
