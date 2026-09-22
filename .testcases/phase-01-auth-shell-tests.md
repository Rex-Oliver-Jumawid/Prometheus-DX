# Phase 1 Manual Test Cases - Authentication and Application Shell

## Phase Context

Prometheus separates authentication from workspace authorization.

Supabase Auth establishes identity.

NestJS must then verify that the authenticated identity maps to an active authorized Prometheus member.

The prototype's `currentViewer` or any demo user switcher must not control production authorization.

The application-shell layout should follow the current Figma design.

Notifications belong in the lower sidebar utility area rather than a separate top-right notification control.

## Required Pages and Interfaces

- `/login`
- `/access-denied`
- Protected application shell
- Figma-defined sidebar
- Sidebar primary navigation
- Sidebar utility navigation
- Notifications utility destination in the sidebar
- Profile/account control at the bottom of the sidebar
- Profile/account drawer
- Sign out
- Protected route handling

## Required Test Accounts

Prepare at least:

- Administrator with active Prometheus membership
- Member with active Prometheus membership
- Authenticated account with no Prometheus member record
- Deactivated Prometheus member
- Invalid email/password combination


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


## Manual Test Cases

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F1-01 | Authorized email/password sign in | Sign in with valid credentials for an active authorized member. | User enters Prometheus. |
| F1-02 | Wrong password | Enter valid email and incorrect password. | Sign in is denied with a useful non-sensitive message. |
| F1-03 | Unknown account | Attempt email/password sign in with an unknown account. | Sign in is denied without leaking sensitive account details. |
| F1-04 | Authorized Google sign in | Continue with Google using an email that matches an active member. | User enters Prometheus. |
| F1-05 | Google auth without membership | Continue with Google using a valid Google account not present in Registry. | Authentication may succeed, but Prometheus workspace access is denied. |
| F1-06 | Deactivated member | Sign in as a member whose Prometheus membership is deactivated. | Workspace access is denied. |
| F1-07 | Session refresh | Sign in and refresh a protected page. | Session remains valid and correct user returns. |
| F1-08 | Direct protected route while signed in | Enter `/projects` directly. | Protected page loads. |
| F1-09 | Direct protected route while signed out | Sign out and enter `/projects` directly. | User is redirected to login or equivalent authentication gate. |
| F1-10 | Sign out | Sign in, then sign out. | Session ends and protected pages are inaccessible. |
| F1-11 | Current user identity | Sign in as Member A, then inspect profile/account UI. | Only Member A's identity is shown. |
| F1-12 | No viewer impersonation | Search the UI for any production demo-view or viewer-switch control. | User cannot switch into another identity. |
| F1-13 | Administrator sidebar | Sign in as Administrator. | Registry navigation is visible. |
| F1-14 | Member sidebar | Sign in as normal Member. | Registry navigation is hidden. |
| F1-15 | Sidebar collapse | Collapse sidebar. | Icons remain visible and usable. |
| F1-16 | Sidebar expand | Expand sidebar. | Labels return without broken layout. |
| F1-17 | Navigation | Navigate between available shell routes. | Active item and page content remain synchronized. |
| F1-18 | Browser Back and Forward | Navigate through several pages then use browser Back and Forward. | History behaves naturally. |
| F1-19 | Profile drawer | Open profile/account interface. | Correct current member information appears. |
| F1-20 | Notifications sidebar destination | Open Notifications from the sidebar utility area. | The Notifications destination opens safely, and no separate top-right notification control is required. |
| F1-21 | Deep-route breadcrumb behavior | Open an initial page and a deeper page. | Breadcrumb appears only where intended. |
| F1-22 | Auth API failure | Make the auth or `/api/me` request fail. | App shows a controlled state rather than rendering another user's data or crashing. |

## Phase 1 Main E2E Flow

```text
Open Prometheus
-> Sign in
-> Workspace authorization succeeds
-> Protected shell loads
-> Navigate to protected route
-> Refresh
-> Open profile
-> Sign out
-> Attempt protected route
-> Login is required
```

## Phase 1 Exit Checklist

- [ ] Real authentication works.
- [ ] Workspace authorization is separate from authentication.
- [ ] Unauthorized authenticated accounts are denied.
- [ ] Deactivated members are denied.
- [ ] Protected routes are protected on direct navigation.
- [ ] Sidebar role visibility is correct.
- [ ] Current user identity cannot be switched through frontend state.
- [ ] Sign out invalidates access.
- [ ] Shell navigation and responsive behavior are stable.
