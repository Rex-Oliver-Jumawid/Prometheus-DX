# Post-release 1: Venture foundation

Status: implementation in progress, not verified.

## Scope and current decision

The user approved replacing Department functionality with Ventures on 15 November 2026.
This supersedes the earlier proposal to maintain both product domains.
Branch feat/venture-foundation starts at maintenance commit 220ef5ae01318989cd979656a9b5f18b01244af6; PR #69 remains open and unmerged.
Existing records and physical Department table/column names are retained through Prisma mappings to avoid destructive data migration.
The application model, APIs, and UI use Venture terminology.
Primary venture is an optional grouping preference, not the membership or permission authority.
Explicit many-to-many venture memberships carry multiple operational roles and separate scoped management permissions.
No finance or equity permissions are inferred from titles or workspace Administrator status.

## Decisions

V1-D01: Preserve existing project/outcome venture grouping associations and historic chat rows using mapped physical names.
Project association does not make company-visible projects private.
V1-D02: Optional primary grouping preserves existing reports while allowing members with no venture and multi-venture membership.
V1-D03: Workspace Administrators retain structural Registry administration; scoped venture managers manage assigned venture memberships and metadata independently.
This authority provides no financial or equity rights.
V1-D04: Figma create_session denied access to file 8zgQ4pcWtku7rSWzjlP9K9.
No live Figma inspection is claimed; use the existing Registry production design for the approved functional change.

## Verification

Pending implementation and focused tests.

## Remaining phases

Work attribution, contribution verification, wallets, equity rates/calculations, closing/freezing, and governance are outside this phase.


## Verification progress

Local Prisma validation, project doctor, TypeScript checks, ESLint (one existing hook warning), production web/API builds, 322 unit/service tests, and 181 component tests passed.
GitHub CI applied the new migration successfully and passed 36 of 37 database integration checks on the first run.
V1-D05: The real database caught a membership-ending upsert candidate whose implicit joinedAt was one millisecond after endedAt.
PostgreSQL validates CHECK constraints before resolving an INSERT conflict, so an existing-row update can still fail its candidate INSERT.
The fix supplies a single explicit timestamp for joinedAt/endedAt in the candidate and clamps it to existing join time; the constraint remains enforced.
Authenticated browser CI and final integration confirmation remain pending.


The populated-schema upgrade test passed in CI, including stable Member/Project IDs, primary/focus membership backfill, notification data, and mute-key conversion.
All 37 PostgreSQL integration checks passed after the timestamp fix.
V1-D06: Authenticated browser verification exposed strict shared contracts rejecting extra Prisma fields on the new venture list/detail responses.
The API now returns explicit public projections instead of spreading database rows; contract round-trip checks cover list and detail responses.
The optional-primary form still rejects nonempty text that does not identify a persisted venture; leaving it blank remains valid.
Legacy browser expectations requiring a venture for every Project/Member are updated to the approved optional grouping behavior.
The feature PR now relies on pull_request CI events to avoid duplicate push/PR workflow runs.


Browser traces confirmed that changing a primary grouping preserves membership in the previous venture, as intended for multi-venture participation.
The corresponding Registry count assertion now expects both memberships instead of treating primary selection as an implicit removal.
The new member selector is tested through its accessible combobox role; its wrapping select label includes option text for exact label-text matching.
A component interaction test now submits multiple selected operational roles through that control.
Project creation no longer requires any venture to exist, and active member profile access is tested with a null primary venture.


Project venture reassignment is explicitly Lead-only and rejects archived projects below the UI.
Three service tests cover the Administrator/non-Lead boundary, archived writes, and clearing optional grouping with an activity event.
Registry and the dedicated Ventures screen both archive rather than delete venture records, preserving linked members, projects, outcomes, and history.
Remaining acceptance work is the final authenticated browser gate and human visual/responsive review against an accessible Figma reference.


The final dependency review also removed the old mandatory Outcome grouping requirement.
A real PostgreSQL integration journey creates an ungrouped Project, Stage, and Outcome, protecting the existing delivery workflow when no venture is assigned.
Projects and Outcomes retain independent optional grouping links, matching the former independent grouping relationships without requiring Departments to exist.
