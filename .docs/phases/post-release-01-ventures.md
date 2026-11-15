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
