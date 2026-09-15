# Prometheus UI Prototype Source of Truth

## Purpose

This document defines how the production Prometheus application should use the HTML prototype and Figma during implementation.

For the main authenticated application, `.model/finalmodel.html` is the prototype source of truth.

The production application is intended to turn that prototype into a real working application with real authentication, authorization, APIs, persistence, validation, and testing.

## Prototype Source of Truth

`.model/finalmodel.html` owns the intended user-visible application experience demonstrated by the prototype.

Unless an explicit newer product decision changes the prototype, production should reflect what the prototype demonstrates, including where applicable:

- page and screen composition
- navigation and destination behavior
- tabs and toggles
- buttons and actions
- drawers and modals
- open and close behavior
- expandable and collapsible regions
- forms and visible fields
- validation and visible feedback
- scrolling behavior
- state changes visible to the user
- interaction sequencing
- profile and settings interactions
- sidebar and navigation behavior
- screen-level workflows
- visual composition and treatment demonstrated by the prototype

Do not invent a different interaction simply because it is easier to implement in React.

When a prototype control, field, state, or workflow exists in `finalmodel.html`, assume it should be represented in the production application unless the user explicitly changes that product decision.

If the current production implementation differs from `finalmodel.html`, treat the difference as something to reconcile rather than automatically treating the implementation as correct.

## Authentication Prototype

`.model/login-page.html` is the prototype source of truth for the authentication screen and its user-visible interaction behavior.

The same rules apply: preserve the demonstrated user experience while implementing real authentication securely through the approved production architecture.

## Figma Is a Helper Reference

Figma is a supporting design reference, not the primary source of truth for the Prometheus application experience.

Use Figma and Figma MCP or another connected Figma integration to help inspect:

- dimensions
- spacing
- typography
- colors
- icons
- component details
- design tokens and variables
- screenshots and frame structure
- visual details that are difficult to inspect from the HTML prototype alone

When Figma and `.model/finalmodel.html` disagree about the app being built, follow `finalmodel.html` unless an explicit newer product decision says otherwise.

Do not change prototype behavior merely to match an older or inconsistent Figma frame.

Figma MCP should be configured when available because live node inspection improves implementation accuracy, but lack of Figma access does not make the HTML prototype secondary.

## Production Architecture Boundary

The prototype defines the intended application experience, not the production implementation technique.

Do not copy prototype JavaScript, DOM structure, local mock state, or frontend-only permission checks as production architecture.

Rebuild the prototype as maintainable React, NestJS, Prisma, PostgreSQL, and Supabase-backed functionality according to `.context/tech-stack.md`.

The goal is behavioral and visual fidelity to the prototype with production-quality architecture underneath it.

## Security, Authorization, and Persistence

Prototype behavior must be implemented through real backend rules rather than simulated frontend state.

Canonical security, authorization, persistence, and historical-data invariants still require server-side enforcement.

For example, if the prototype shows an Administrator action, production should preserve the same user-facing action while enforcing the corresponding permission on the backend.

If implementing a prototype feature requires a persistent field or relationship that is missing from the current data model, do not silently drop the prototype feature.

Identify the mismatch and reconcile the canonical data model and requirements with the prototype before continuing.

If a prototype interaction appears to create a genuine security or data-integrity conflict, surface the conflict explicitly instead of silently changing the prototype or weakening production safeguards.

## Conflict Resolution

Use these rules when implementation references disagree:

1. `.model/finalmodel.html` is the source of truth for the main application's intended user-visible prototype behavior and experience.
2. `.model/login-page.html` is the source of truth for authentication-screen prototype behavior and experience.
3. SRS and user-flow documents define business intent and authorization requirements that must be implemented securely behind that experience.
4. `data-model.md` defines the current persistence model, but a mismatch with a required prototype feature must be reconciled rather than solved by silently deleting the prototype behavior.
5. `tech-stack.md` defines production architecture.
6. Figma is a helper for visual inspection and implementation detail.
7. `.testcases/` defines the phase acceptance gates and should be extended when a prototype behavior needs explicit regression coverage.

When a real conflict remains after applying these ownership rules, document it and resolve it explicitly before encoding a contradictory production behavior.

## Implementation Rule

For substantial user-facing work:

1. Run or inspect the relevant workflow in `.model/finalmodel.html` first.
2. Identify every user-visible state and interaction that the production slice must reproduce.
3. Read the canonical requirements and persistence model needed to make that workflow real.
4. Use Figma MCP or another connected Figma integration as a helper for visual detail when available.
5. Implement the same experience using the approved production architecture.
6. Compare the working application against the prototype in a browser.
7. Treat unexplained behavioral differences from the prototype as defects or unresolved product conflicts.

The objective is not to design a new application inspired by the prototype.

The objective is to turn the prototype into the working Prometheus application.