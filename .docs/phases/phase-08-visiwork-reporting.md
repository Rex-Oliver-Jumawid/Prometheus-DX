# Phase 8 - VisiWork and Reports & Analytics

## Status

In progress.

The core VisiWork and Reports & Analytics product surfaces are implemented and integrated on `main`.

Phase 8 remains open until the manual acceptance gate, integrated regression, visual verification, and final closure record are complete.

Later collaboration work layered onto VisiWork belongs to Phase 9 and does not change the Phase 8 acceptance boundary.

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

Focused automated coverage exists for the Reports & Analytics aggregation model and navigation behavior.

VisiWork implementation work also includes focused tests around its page behavior and later integration changes.

The manual acceptance file is:

`.testcases/phase-08-visiwork-reporting-tests.md`

The phase is not yet closed because the full Phase 8 acceptance checklist, integrated regression, and final visual verification have not been recorded here as complete.

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

Formal Phase 8 acceptance is still pending.

The Home Quick Access Reports control now routes to the implemented `/reports` destination.

Later VisiWork collaboration behavior is covered by Phase 9 and should not be used to silently expand the Phase 8 completion gate.

## Technical Debt

Reconcile the stale Home Reports shortcut with the now-available `/reports` destination.

Keep report aggregation logic centralized so future metrics do not duplicate formulas across components.

## Lessons from the Phase

A reporting surface is safer when it is a derived read model over existing domain state rather than a separate persistence subsystem.

Operational visibility and management reporting can share canonical records while remaining separate user experiences.

## Recommendations and Next Approach

Execute the full Phase 8 manual acceptance checklist against the integrated `main` application.

Verify VisiWork and Reports & Analytics visually against the current Figma frames.

Reconcile each report total with controlled source records.

Run regression for navigation, Projects, Schedule, Team, Home, and any shared queries touched by Phase 8.

Keep Home Quick Access routing in the Phase 8 navigation regression now that the Reports shortcut is active.

## Phase Exit Result

Not yet complete.

The major Phase 8 implementation is integrated, but the phase remains open until acceptance, regression, visual verification, and this journal's final evidence are complete.
