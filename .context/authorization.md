# Prometheus Authorization Matrix

## Purpose

This document centralizes the current authorization model.

The SRS defines product intent.
`user-flows.md` defines canonical workflow behavior.
This matrix is the quick operational reference for deciding whether a request is allowed.

Backend authorization remains authoritative.
Frontend visibility is never sufficient authorization.

## Identity Layers

Prometheus intentionally separates four concepts:

```text
Workspace role
!=
Project Lead
!=
Project Member access
!=
Outcome Membership
```

Workspace role:

- `ADMINISTRATOR`
- `MEMBER`

Project relationship:

- Project Lead
- Project Member with `CAN_VIEW`
- Project Member with `CAN_EDIT`

Outcome relationship:

- Outcome Member

A single person may hold several relationships at once.

## Workspace and Organization

| Action | Active MEMBER | ADMINISTRATOR |
| --- | --- | --- |
| Enter authenticated Prometheus workspace | Yes | Yes |
| View Team, Home, Projects, Schedule, VisiWork, Reports, Notifications | Yes | Yes |
| Access Registry | No | Yes |
| Create/edit Departments | No | Yes |
| Create/edit/deactivate organization Members | No | Yes |
| Send Registry invitations | No | Yes |
| Manage another Member's Schedule or WorkSession | No | No |

Administrator status does not create Project Lead, Project editor, or Outcome Member authority.

## Projects

| Action | Ordinary active Member | Project Member CAN_VIEW | Project Member CAN_EDIT | Project Lead |
| --- | --- | --- | --- | --- |
| View Project | Yes | Yes | Yes | Yes |
| Create Project | Yes | Yes | Yes | Yes |
| Change Project status | No | No | Yes | Yes |
| Create/edit/delete Stage | No | No | Yes | Yes |
| Create/edit/delete Outcome | No | No | Yes | Yes |
| Manage Acceptance Criteria through Outcome editing | No | No | Yes | Yes |
| Grant/revoke Project Member CAN_EDIT | No | No | No | Yes |
| Pin/unpin Project announcement | No | No | No | Yes |
| View normal Project Activity | Yes | Yes | Yes | Yes |

Normal Stage and Outcome deletion safeguards still apply.
`CAN_EDIT` does not bypass protected historical records or other integrity checks.

## Outcome Participation and Delivery

Any active authorized Member may join a non-accepted Outcome, including while it is locked, for review, or needs revision.

Outcome Membership is permanent under the current model.

| Action | Not Outcome Member | Outcome Member | CAN_EDIT Project Member | Project Lead |
| --- | --- | --- | --- | --- |
| View Outcome | Yes | Yes | Yes | Yes |
| Join non-accepted Outcome | Yes | Already joined | Yes | Yes |
| Create/edit Feature or Task | No | Yes when lifecycle permits | Only if also Outcome Member | Only if also Outcome Member |
| Complete/reopen Task | No | Yes when execution is allowed | Only if also Outcome Member | Only if also Outcome Member |
| Submit Outcome output | No | Yes when submission is allowed | Only if also Outcome Member | Only if also Outcome Member |
| Review submissions | No | No unless CAN_EDIT | Yes | Yes |
| Request/resolve revision | No | No unless CAN_EDIT | Yes | Yes |
| Accept/reopen Outcome | No | No unless CAN_EDIT | Yes | Yes |
| Override dependency | No | No unless CAN_EDIT | Yes | Yes |

Project editing authority and Outcome work participation remain separate.

## Project Chat and Project Collaboration

General Project communication is company-readable.

| Action | Ordinary active Member | Project Member | Project Lead |
| --- | --- | --- | --- |
| Read general Project Chat | Yes | Yes | Yes |
| Search general Project Chat | Yes | Yes | Yes |
| Open exact-message deep link | Yes | Yes | Yes |
| Send general Project Chat message | No | Yes | Yes |
| Reply in general Project Chat | No | Yes | Yes |
| Mention Project participant | No | Yes | Yes |
| Edit own Project Chat message | Only if author and message was writable | Only if author | Only if author |
| Delete own Project Chat message | Only if author and message was writable | Only if author | Only if author |
| Post Project announcement | No | Yes | Yes |
| Pin/unpin announcement | No | No | Yes |
| View normal Project Activity | Yes | Yes | Yes |

Archived Projects remain readable but Project Chat and announcement mutations are disabled.

Project Chat mentions are limited to active Project participants represented by the Project Lead or Project Membership.

Soft deletion preserves message identity, ordering, reply context, and deep-link position while removing deleted content from normal search and mention state.

## VisiWork General Chat

For every active authorized Prometheus Member:

| Action | Allowed |
| --- | --- |
| Read General Chat | Yes |
| Search General Chat | Yes |
| Send General Chat message | Yes |
| Mention another active Member | Yes |
| Edit own message | Yes |
| Delete own message | Yes |
| Edit/delete another Member's message | No |

Deleted messages remain as tombstones and do not appear in normal search.

## VisiWork Department Chat

Department-room read visibility is company-wide for active authorized Members.

Write authority follows Department relationship or current VisiWork focus.

```text
Can write Department Chat
=
Member.department_id = room Department
OR
Member.visiwork_department_id = room Department
```

| Action | Active Member outside room | Home/focused Department Member |
| --- | --- | --- |
| Read Department Chat | Yes | Yes |
| Search Department Chat | Yes | Yes |
| Send Department Chat message | No | Yes |
| Mention Member | No write access | Active Member whose home/focused Department matches room |
| Edit own existing message | Yes, if author | Yes, if author |
| Delete own existing message | Yes, if author | Yes, if author |

Changing VisiWork focus changes future Department write eligibility.
It does not rewrite message history.

## Search, Mentions, Deletion, and Deep Links

Search is room-scoped.

Deleted message content is excluded from normal search.

Exact-message context loading returns surrounding records from the same room.

A deep link never grants a mutation permission that the user would not otherwise have.

Mention relationships are persisted by Member ID.

When a message is edited:

- mentions removed from the text lose their persisted relationship.
- obsolete mention notifications are removed.
- retained notification previews are refreshed.
- newly added valid mentions create notifications.

When a message is deleted:

- its mention relationships are removed.
- its mention notifications are removed.
- its conversation position remains through a tombstone.

## Schedule and Work Sessions

Members manage their own planned Schedule.

Members Time In and Time Out only for themselves.

Administrator, Project Lead, or Project editor status does not grant cross-Member Schedule or WorkSession mutation authority.

Team visibility may show permitted shared schedule and work summaries, but visibility does not imply edit authority.

## Notifications

Notifications are recipient-owned.

A signed-in Member may read and update their own notification read state.

Notification links route to the referenced context but do not bypass the destination's authorization rules.

## Reports and VisiWork Visibility

Reports & Analytics and the VisiWork operational view are authenticated company surfaces.

They must derive from canonical records and must not create a new authority model.

A report or operational summary cannot be used as an alternate mutation path around Project, Outcome, Registry, Schedule, or WorkSession authorization.

## Non-Overrides

The following are explicitly not global overrides:

- Administrator does not automatically become Project Lead.
- Administrator does not automatically receive `CAN_EDIT`.
- Project creator does not retain special authority merely because they created the Project.
- Project Lead does not gain Registry authority unless also Administrator.
- `CAN_EDIT` does not allow changing another Project Member's access.
- Outcome Membership does not grant Project editor authority.
- Department membership does not grant Registry authority.
- VisiWork focus does not change the Member's canonical home Department.

## Enforcement Rule

Every protected mutation must validate its required relationship on the backend at request time.

If a future feature needs a permission not represented here, update the canonical authorization model before shipping the mutation.
