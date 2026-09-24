# Phase 7 Manual Test Cases - Notifications and Home

## Release Closure Disposition - 2026-09-25

This file remains a repeatable manual regression checklist.

The owning phase has been closed for the current release using the accumulated implementation evidence, automated service/component/integration coverage, recorded browser evidence, and current repository-wide regression.

A checkbox marked complete below records the release closure disposition.
It does not mean a credential-gated browser case was executed in an environment where its credentials were unavailable.

Future changes to the covered behavior should reuse the relevant cases.

## Phase Context

Notifications should be generated from real system events.

Home is a command-center view over existing canonical data.

Home should not create a parallel source of truth for projects, attention items, or work status.

The current visual references are Figma Home node `189:3` and Notifications node `11:2301`.

Notifications are accessed through the lower sidebar utility entry with an unread-count badge when applicable.

Do not add a separate top-right notification bell or notification control.

## Required Pages and Interfaces

- `/notifications`
- Notifications layout matching Figma node `11:2301`
- Read/unread state
- All and Unread filters
- Mark all as read
- Notification detail or navigation
- Notifications sidebar utility entry with unread-count badge
- `/`
- Home layout matching Figma node `189:3`
- My Project Summary
- Working Now
- Needs Attention
- Quick Access

## Required Test Accounts

- Project Lead
- Outcome Member
- Project Member
- Member currently timed in
- Member with no active work session


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


## Notification Tests

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F7-01 | Project Lead assignment notification | Assign user as Project Lead through project creation or supported change. | Relevant notification is created. |
| F7-02 | Project access changed | Grant or revoke `CAN_EDIT`. | Relevant member receives notification if defined. |
| F7-03 | Outcome joined | User joins an outcome. | Relevant event/notification is recorded according to product rule. |
| F7-04 | Submission added | Outcome Member submits output. | Project Lead receives relevant notification. |
| F7-05 | Revision requested | Lead requests revision. | Relevant Outcome Members receive notification. |
| F7-06 | Outcome accepted | Lead accepts outcome. | Relevant members receive notification. |
| F7-07 | Dependency unlocked | Resolve prerequisite. | Relevant notification appears if defined. |
| F7-08 | Notification opens context | Click a notification linked to a project/outcome. | Correct context opens. |
| F7-09 | Mark read | Mark notification read. | Read state persists after refresh. |
| F7-10 | Mark unread if supported | Change read state back. | State persists. |
| F7-11 | Mark all read if supported | Use bulk action. | All applicable notifications update. |
| F7-12 | Empty inbox | Use account with no notifications. | Intentional empty state appears. |
| F7-13 | Repeated event handling | Trigger similar events quickly. | Notifications are neither silently lost nor duplicated unexpectedly. |

## Home Tests

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F7-14 | Leading project summary | Sign in as Project Lead. | Led projects appear correctly. |
| F7-15 | Participating project summary | Join an outcome in another project. | Participation appears correctly. |
| F7-16 | Working Now | Time In as a member. | Member appears in Working Now. |
| F7-17 | Stop Working Now | Time Out. | Working Now updates appropriately. |
| F7-18 | Needs Attention from revision | Trigger a revision request or review item. | Needs Attention reflects the real item. |
| F7-19 | Resolve attention item | Resolve the underlying issue. | Needs Attention updates after refresh or expected invalidation. |
| F7-20 | Quick Access | Click each shortcut. | Correct destination opens. |
| F7-21 | Working Now overflow | Seed enough active members to exceed the fixed area. | Section scrolls internally as designed. |
| F7-22 | Needs Attention overflow | Seed many attention items. | Section scrolls internally without expanding entire layout unexpectedly. |
| F7-23 | Empty Home sections | Use account with no relevant records. | Each section has intentional empty state. |
| F7-24 | Home data refresh | Change underlying project/work data, then return to Home. | Home reflects canonical data rather than stale duplicate state. |
| F7-25 | Figma shell notification placement | Open Home and Notifications and inspect the authenticated shell. | Notifications appears in the lower sidebar utility area with the Figma-defined treatment, and there is no separate top-right notification bell or control. |

## Phase 7 Main E2E Flow

```text
Member submits output
-> Lead receives notification
-> Lead opens notification
-> Correct outcome opens
-> Lead requests revision
-> Member receives notification
-> Home Needs Attention reflects actionable state
```

## Phase 7 Exit Checklist

- [x] Notifications are based on real events.
- [x] Read/unread state persists.
- [x] Notifications navigate to correct context.
- [x] Home uses real project/work/attention data.
- [x] Working Now reflects Work Sessions rather than fake UI state.
- [x] Overflow behavior matches the fixed-height dashboard design.
- [x] Home matches Figma node `189:3` at the supported reference viewport and preserves the same hierarchy responsively.
- [x] Notifications matches Figma node `11:2301` at the supported reference viewport and preserves the same hierarchy responsively.
- [x] Notification access uses the sidebar utility entry and does not add a separate top-right bell.
