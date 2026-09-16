# Prometheus Phase Documentation

This directory records what was actually implemented in each Prometheus phase and why important engineering decisions were made.

It complements, rather than replaces, the planning and acceptance files:

- `.context/phases.md` defines what each phase is expected to accomplish.
- `.testcases/phase-XX-*.md` defines how the phase is verified.
- `.docs/phases/phase-XX-*.md` records what was implemented, what was difficult, what decisions were made, what was learned, and what should change in the next phase.

## Documentation Rule

A phase is not considered complete until its phase document is updated with the final implementation and acceptance result.

The document should describe the system as it actually exists at phase exit. Do not copy planned behavior into the implementation record unless it was implemented and verified.

## Required Sections

Each phase document should contain:

1. Status
2. Objective
3. Scope delivered
4. Architecture and data-flow changes
5. Database changes
6. API changes
7. Security and authorization decisions where applicable
8. Environment/configuration changes without secret values
9. Testing and acceptance result
10. Decision & Challenge Log
11. Known limitations
12. Technical debt
13. Lessons from the phase
14. Recommendations / next approach
15. Phase exit result

## Decision & Challenge Log

Only meaningful engineering decisions and problems belong in this log. Examples include architecture choices, security decisions, database design problems, integration failures, major workflow changes, or testing strategy changes.

Do not create entries for routine formatting, minor CSS adjustments, or trivial typo fixes unless they exposed a broader engineering lesson.

Each entry uses a stable ID:

```text
P0-D01
P0-D02
P1-D01
P1-D02
P2-D01
...
```

A decision entry should use this structure:

```md
### P2-D01 - Short decision title

**Status:** Resolved | Accepted | Revisit later
**Area:** Backend | Frontend | Database | Security | Testing | Infrastructure | Product
**Impact:** Low | Medium | High

#### What gave us a hard time

Describe the concrete problem or uncertainty.

#### Root cause / constraint

Describe what was actually causing the problem, or the constraint that forced a decision.

#### Options considered

1. Option A
2. Option B
3. Option C

#### Proposed solution

Describe the preferred approach before implementation.

#### Decision

Record what was actually chosen.

#### Why we chose it

Explain the trade-off and why the selected option fit Prometheus.

#### Result

Record the observed implementation result.

#### What we learned

Capture the reusable engineering lesson.

#### Next approach

Convert the lesson into a rule or approach for future phases.

#### Related changes

List important files, migrations, tests, commits, or routes.
```

## Status Index

| Phase | Name | Status | Document |
| --- | --- | --- | --- |
| 0 | Foundation | Complete | `phase-00-foundation.md` |
| 1 | Authentication and Application Shell | Complete | `phase-01-auth-shell.md` |
| 2 | Registry | Complete | `phase-02-registry-closure.md` |
| 3 | Project Core | Complete | `phase-03-project-core.md` |
| 4 | Project Workflow Structure | Complete | `phase-04-project-workflow.md` |
| 5 | Outcome Work, Submission, Review, and Dependencies | Not started | To be created |
| 6 | Schedule, Work Sessions, and Team | Not started | To be created |
| 7 | Notifications and Home | Not started | To be created |
| 8 | VisiWork and Reporting | Not started | To be created |
| 9 | Collaboration, Realtime, and Attachments | Not started | To be created |

## Principle

The purpose of these documents is not merely to prove that work happened. They should preserve enough context that a future developer can answer:

- Why is the system designed this way?
- What alternatives were considered?
- What failed before this approach worked?
- What did we learn from the failure?
- What should we do differently in the next phase?
