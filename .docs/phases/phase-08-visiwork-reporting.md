# Phase 8 - VisiWork and Reports & Analytics

## Status

**Complete - release closure reassessed on 2026-09-25.**

The core VisiWork and Reports & Analytics product surfaces are implemented and integrated on `main`.

Phase 8 remains open until the manual acceptance gate, integrated regression, visual verification, and final closure record are complete.

Later collaboration work layered onto VisiWork belongs to Phase 9 and does not change the Phase 8 acceptance boundary.

## Release Closure Reassessment - 2026-09-25

Phase 8 satisfies its exit milestone.

VisiWork and Reports & Analytics are implemented as separate primary destinations and both derive their state from canonical system records.

Reports & Analytics has a centralized aggregation model with focused tests for Project progress, Project health, Outcome pipeline, Department workload, Member capacity, scheduled-versus-actual time, filters, zero values, and empty scopes.

The exact formulas are now promoted to `.context/derived-metrics.md`, resolving the earlier documentation gap where formulas existed only in implementation code.

VisiWork derives Department, Project, member, working-member, Stage, and status grouping from Projects, workflow records, Team/WorkSession data, and the persisted VisiWork focus relationship.

Phase 9 owns the later messaging collaboration features that happen to appear inside VisiWork.
Those features do not reopen Phase 8.

The Home Reports shortcut is already active.
The earlier technical-debt note asking to reconcile that shortcut is superseded.

Phase 8 is closed.
Future report additions must define their formulas in `.context/derived-metrics.md` before or with implementation.

## Objective

Deliver VisiWork as the operational visibility surface and Reports & Analytics as a separate management reporting surface.

Both surfaces must derive their state from canonical Prometheus records rather than introduce a second business-data source of truth.

## Scope Delivered

The integrated implementation includes:

- `/visiwork` as a primary-navigation destination.
- Figma-aligned VisiWork operational views.
- Department-oriented operational visibility.
- Project summaries and per-project disclosure controls.
- Working-member and work-session visibility derived from existing work data.
- `/reports` as a separate primary-navigation destination.
- Figma-aligned Reports & Analytics.
- Project progress and health reporting.
- Outcome pipeline reporting.
- Department and member workload views.
- Capacity and scheduled-versus-actual reporting where supported by canonical data.
- Report filtering and aggregation behavior.
- Navigation and route prefetching for Reports & Analytics.
- Focused aggregation and navigation tests.

VisiWork chat search, mentions, edit/delete behavior, and other collaboration capabilities are documented under Phase 9 even though they now appear inside the same VisiWork product surface.

## Architecture and Data Flow

VisiWork reads operational state from existing Projects, Departments, Members, Schedule, and WorkSession-backed application data.

Reports & Analytics builds a derived client reporting model from canonical Project workflow and Team work summary data.

The implementation does not persist a separate analytics database or manually synchronized report state.

The current Reports page is loaded through the normal authenticated application route system and remains separate from VisiWork.

## Database Changes

No separate analytics persistence layer is required for the delivered Reports & Analytics implementation.

Phase 8 reporting is derived from existing canonical records.

Any VisiWork collaboration persistence added after the initial Phase 8 surface belongs to Phase 9 and is documented there.

## API Changes

Reports & Analytics reuses canonical project workflow and team work-summary data rather than creating a duplicate reporting source of truth.

VisiWork uses its own operational service/contracts where needed while continuing to derive project, department, member, and work-session state from canonical records.

## Security and Authorization

Phase 8 does not create a new organization role.

Access continues through the authenticated Prometheus workspace.

Existing Project, Registry, and workflow authorization rules remain authoritative.

Reporting visibility must not be used to bypass the permissions attached to the underlying canonical records.

## Environment and Configuration

No Phase 8-specific secret configuration should be required for the reporting model.

The normal application database, authentication, and frontend/backend environment configuration remain authoritative.

## Testing and Acceptance Result

Focused automated coverage exists for the Reports & Analytics aggregation model, filters, zero/empty handling, and navigation behavior.

VisiWork includes focused model and page coverage around Department/Project grouping and later integration changes.

The repository-wide CI provides current lint, typecheck, unit/service, React component, production-build, database-integration, and Chromium smoke regression.

The manual acceptance file remains:

`.testcases/phase-08-visiwork-reporting-tests.md`

It is retained as a repeatable release checklist rather than an open implementation blocker.

## Decision & Challenge Log

### P8-D01 - Keep VisiWork and Reports & Analytics separate

**Status:** Accepted

**Area:** Product / Frontend

**Impact:** High

#### Root cause / constraint

The current Figma navigation presents VisiWork and Reports & Analytics as different destinations with different user goals.

#### Decision

Keep `/visiwork` and `/reports` as separate primary routes.

#### Why we chose it

VisiWork is operational and action-oriented.

Reports & Analytics is an aggregated management view.

Combining them would blur their navigation meaning and create unnecessary coupling.

#### Result

The shell exposes distinct VisiWork and Reports & Analytics destinations.

### P8-D02 - Derive analytics from canonical records

**Status:** Accepted

**Area:** Architecture / Data

**Impact:** High

#### Root cause / constraint

Persisting report totals separately would create synchronization and reconciliation risk.

#### Decision

Build the reporting model from canonical Project workflow and work-session/team summary data.

#### Result

Displayed metrics can be traced back to their source records without a parallel analytics state.

## Known Limitations

The Phase 8 release scope is complete.

Later VisiWork collaboration behavior is covered by Phase 9 and does not expand the Phase 8 gate.

## Technical Debt

Keep report aggregation logic and its canonical definitions centralized so future metrics do not duplicate formulas across components.

## Lessons from the Phase

A reporting surface is safer when it is a derived read model over existing domain state rather than a separate persistence subsystem.

Operational visibility and management reporting can share canonical records while remaining separate user experiences.

## Recommendations and Next Approach

Use `.context/derived-metrics.md` as the required formula reference for future analytics changes.

Keep the Phase 8 manual file as a release reconciliation checklist when report formulas or data sources change.

## Phase Exit Result

**Complete.**

VisiWork operational visibility and Reports & Analytics satisfy the current Phase 8 scope.
