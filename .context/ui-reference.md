# Prometheus UI Reference Policy

## Purpose

This document defines which Prometheus artifacts own visual layout, interaction behavior, product rules, and production architecture.

The current Prometheus Figma file is the source of truth for user-interface layout and visual design.

Figma file:

`https://www.figma.com/design/8zgQ4pcWtku7rSWzjlP9K9/Prometheus`

Figma file key:

`8zgQ4pcWtku7rSWzjlP9K9`

The HTML prototypes remain useful interaction and workflow references, but they do not override a current Figma layout.

## Figma Owns UI Layout and Visual Design

For user-facing production work, follow the current Figma frame for the screen being implemented.

Figma owns the intended presentation of:

- page and screen composition
- application-shell layout
- navigation placement and grouping
- sidebar structure
- visual hierarchy
- spacing and dimensions
- typography
- colors
- icons
- component appearance
- card, panel, drawer, and modal placement
- visible visual states
- scrolling regions
- responsive design intent
- visual treatment of badges, filters, tabs, buttons, and controls

Do not preserve an older production or prototype layout merely because it already exists in code.

When the production UI differs from the current Figma frame, treat the difference as something to reconcile.

For substantial UI work, use the connected Figma integration to inspect the specific target frame rather than relying only on a pasted screenshot or old implementation.

## Current Application Shell Decision

The current Figma shell is the approved layout for the authenticated application.

The primary navigation is located in the left sidebar.

The current primary navigation presents:

- Home
- Projects
- VisiWork
- Schedule
- Team
- Reports & Analytics

The lower sidebar utility area presents:

- Registry, subject to Administrator visibility rules
- Notifications

Notifications are accessed through the dedicated Notifications sidebar utility item.

The Notifications sidebar item may display an unread-count badge.

Do not add a separate global top-right notification bell, notification icon, or notification control unless a newer explicit product decision changes this layout.

The signed-in profile control is located at the bottom of the sidebar in the current Figma shell.

The Time In and Time Out attendance control remains a separate work-session control and must not be confused with notification navigation.

## Phase 7 Figma Frames

The current Phase 7 visual references are:

- Home: node `189:3`
- Notifications: node `11:2301`

Both frames use the same authenticated application shell.

The Home frame contains the Figma-defined dashboard composition, including My Project Summary, Working Now, Needs Attention, and Quick Access.

The Notifications frame contains the Figma-defined notification header, Mark all as read action, All and Unread filters, unread-count treatment, and notification list presentation.

These desktop frames are visual references rather than instructions to hard-code one viewport size.

Responsive production behavior should preserve the same hierarchy, navigation model, and visual intent at supported viewport sizes.

## Figma Frame Index

Use this table as the central route-to-frame orientation index.

| Product surface | Route / context | Approved Figma reference |
| --- | --- | --- |
| Home | `/` | node `189:3` |
| Notifications | `/notifications` | node `11:2301` |
| Registry | `/registry` | node `11:1887` |
| VisiWork Departments | `/visiwork` department view | node `233:583` |
| VisiWork Projects | `/visiwork` project grouping | node `233:1180` |
| VisiWork Department View | `/visiwork` department detail | node `233:2237` |
| Reports & Analytics | `/reports` | named `Reports & Analytics` frame in the current Prometheus file; inspect the current node before substantial visual work |
| Project Chat | Project workspace Chat tab | named `Project Chat` and `Project Chat - Project Lead` frames; inspect the current node before substantial visual work |
| Project Activity | Project workspace Activity tab | named `Project Activities` frame; inspect the current node before substantial visual work |

Do not invent a node ID when this index names a frame without pinning its node.
Use the connected Figma integration to resolve the current node at implementation time.

## HTML Prototypes Are Interaction References

`.model/finalmodel.html` is an interaction and workflow reference for the main authenticated application.

`.model/login-page.html` is an interaction reference for authentication behavior.

Use the HTML prototypes to understand behavior that a static Figma frame does not fully specify, such as:

- interaction sequencing
- open and close behavior
- workflow transitions
- tab or toggle behavior not evident from the target Figma state
- validation and visible feedback
- state transitions
- deeper workflow relationships

The HTML prototypes do not own current page layout, navigation placement, visual composition, spacing, or styling when those details are defined in Figma.

Do not reintroduce an older prototype-only control when it is absent from the approved Figma design.

## Product and Security Boundaries

The Software Requirements Specification owns functional requirements and business intent.

`.context/user-flows.md` owns canonical workflow and authorization rules.

`.context/data-model.md` owns persistent entities, relationships, constraints, history, and derived state.

`.context/tech-stack.md` owns production architecture and technology choices.

Figma does not override backend authorization, persistence, security, or data-integrity requirements.

A control being visible or hidden in Figma does not by itself grant or revoke authority.

Implement the Figma experience through real React, NestJS, Prisma, PostgreSQL, Supabase, validation, and backend authorization.

If implementing a Figma-defined feature requires missing persistent data or a new relationship, reconcile the canonical requirements and data model rather than silently removing the feature.

## Conflict Resolution

Use these ownership rules when implementation references disagree:

1. The SRS owns functional requirements and business intent.
2. `user-flows.md` owns canonical authorization and workflow rules.
3. Figma owns current user-interface layout, visual composition, navigation placement, and visual design.
4. `finalmodel.html` and `login-page.html` provide interaction and workflow detail where Figma does not fully specify behavior.
5. `data-model.md` owns current persistence structure and invariants.
6. `tech-stack.md` owns production architecture.
7. `.testcases/` owns phase acceptance gates.
8. `.docs/phases/` records historical implementation evidence and decisions.

When Figma and an HTML prototype disagree only about layout or visual presentation, follow Figma.

When Figma and an HTML prototype disagree about an interaction, use the newer explicit product decision when one exists.

If no newer interaction decision exists, reconcile the conflict against the SRS and `user-flows.md` before implementation.

Never weaken authorization, persistence, or security merely to reproduce a visual mockup.

## Implementation Rule

For substantial user-facing work:

1. Read the canonical requirements and user flows for the feature.
2. Inspect the relevant current Figma frame with the connected Figma integration.
3. Record or identify the exact frame or node used for implementation.
4. Inspect the HTML prototype only for interaction or workflow details not fully expressed by the Figma frame.
5. Reuse existing production components and design tokens where they match the Figma intent.
6. Implement the design through the approved production architecture.
7. Compare the working application directly against the Figma frame in a real browser.
8. Verify interactions against canonical workflows and acceptance tests.
9. Treat unexplained visual differences from Figma as defects or unresolved product conflicts.

The objective is to implement the approved Prometheus Figma interface as a real, secure, persistent application rather than to preserve an older prototype layout.
