---
name: prometheus-ui-implementation
description: Use when implementing or substantially changing Prometheus user-facing UI. Treats .model/finalmodel.html as the prototype source of truth and Figma as a supporting implementation helper while preserving production security and architecture.
---

# Prometheus UI Implementation

Use this workflow for pages, components, navigation, drawers, modals, responsive behavior, visual refinements, and substantial interaction changes.

Read `.context/ui-reference.md` before substantial UI work.

## 1. Start from the functional prototype

For the main authenticated application, `.model/finalmodel.html` is the prototype source of truth.

The goal is to turn that prototype into the real working Prometheus application.

Do not treat it as loose inspiration.

Inspect the relevant prototype workflow before implementing the production screen.

When practical, run and interact with the prototype instead of only reading its source.

Assume user-visible behavior demonstrated by the prototype should exist in production unless the user explicitly changes that product decision.

Capture all relevant details, including where applicable:

- page and screen composition
- navigation flow and destinations
- visible fields
- buttons and actions
- tabs and toggles
- drawers and modals
- backdrop, Escape, and close behavior
- expandable and collapsible regions
- scrolling behavior
- state changes visible to the user
- loading, empty, success, and error presentation demonstrated by the prototype
- repeated open and close behavior
- profile and settings interactions
- sidebar behavior
- interaction sequencing
- functional relationships between controls

If production differs from `finalmodel.html`, do not automatically preserve the production difference.

Treat the difference as something to reconcile.

Authentication-specific user-visible behavior should follow `.model/login-page.html`.

## 2. Preserve the experience, not the prototype implementation technique

The prototype is authoritative for the intended application experience, but its JavaScript and DOM are not production architecture.

Do not copy prototype JavaScript state, mock data, DOM structure, local persistence, or frontend-only permission checks as the real implementation.

Do not migrate `finalmodel.html` into one giant React component.

Rebuild the demonstrated experience using maintainable production code and `.context/tech-stack.md`.

Use real APIs, backend authorization, validation, and PostgreSQL persistence where the prototype only simulates them.

If a prototype feature requires a field, state, or relationship missing from the current production data model, do not silently omit the feature.

Identify the mismatch and reconcile the requirements and persistence model before continuing.

## 3. Use Figma as a helper, not the source of truth

Figma is a supporting visual implementation reference.

It should help the agent inspect details that are easier to extract from structured design data than from the HTML prototype.

Use Figma for things such as:

- measurements
- spacing
- typography
- colors
- icons
- design tokens and variables
- component details
- frame structure
- screenshots
- fine visual alignment

When Figma and `.model/finalmodel.html` disagree about the application experience, follow `finalmodel.html` unless an explicit newer product decision says otherwise.

Do not redesign prototype behavior merely to match an inconsistent Figma frame.

### Figma MCP / connected integration

For better visual accuracy, configure Figma MCP or an equivalent connected Figma integration when available.

The integration should be able to access the target Prometheus Figma file and the specific node or frame relevant to the implementation.

Use the live connection to inspect design context, screenshots, variables, dimensions, components, and node structure instead of relying only on a pasted URL.

If the Figma connection is unavailable or cannot access the file, state that limitation explicitly.

Do not claim live Figma inspection occurred when it did not.

Lack of Figma access does not make `finalmodel.html` secondary and does not block implementation when the prototype contains the required interaction and design reference.

Current Prometheus Figma helper reference:

`https://www.figma.com/design/8zgQ4pcWtku7rSWzjlP9K9/Prometheus?node-id=17-4603&t=9bvq2LAHiC0GPJs7-1`

File key: `8zgQ4pcWtku7rSWzjlP9K9`

Starting node: `17:4603`

If the current phase or `.docs/CURRENT.md` provides a more specific Figma node, inspect that node as a helper for the relevant screen.

## 4. Resolve conflicts correctly

Apply this order when implementation references disagree:

1. `.model/finalmodel.html` owns the intended user-visible prototype behavior and main application experience.
2. `.model/login-page.html` owns the authentication-screen prototype experience.
3. SRS and `user-flows.md` define business and authorization intent that production must enforce securely behind that experience.
4. `data-model.md` defines the current persistence model, but a mismatch with a required prototype feature must be reconciled rather than solved by silently deleting the feature.
5. `tech-stack.md` owns production architecture.
6. Figma is a helper for visual implementation detail.

If a real security or data-integrity conflict remains, surface it explicitly and resolve it instead of silently changing the prototype behavior or weakening backend safeguards.

## 5. Reuse canonical assets

Use repository assets instead of recreating them when the prototype or supporting design calls for them.

Authentication assets:

- `/auth/prometheus-mark.png`
- `/auth/prometheus-auth-background.png`

Authenticated workspace background:

- `/backgrounds/editorial-gradient.webp`

Do not duplicate these assets into `src/` or approximate them with CSS unless the intended prototype experience requires a different treatment.

## 6. Preserve frontend architecture

Use the approved frontend stack from `.context/tech-stack.md`.

General boundaries:

- React Router for navigation.
- TanStack Query for server-managed data.
- Zustand only for shared temporary UI state where local React state is insufficient.
- React Hook Form for structured forms.
- Zod for runtime validation and reusable contracts where appropriate.

Do not duplicate persistent server-managed business state into frontend-only stores.

## 7. Treat prototype fidelity as part of correctness

Inspect the production implementation in a real browser whenever possible.

Compare the working application directly against the relevant workflow in `finalmodel.html`.

Use Figma as an additional helper for fine visual comparison when available.

Check:

- interaction sequence
- navigation result
- fields and controls present
- modal and drawer behavior
- tab and toggle state
- expand and collapse behavior
- scrolling behavior
- visible state changes
- alignment
- spacing
- typography
- component sizing
- overflow
- hover states
- focus states
- disabled states
- loading states
- empty states
- error states
- icon consistency
- visual hierarchy

An unexplained user-visible difference from the prototype should be treated as a defect or unresolved product conflict.

Do not preserve an obvious accidental prototype bug when it clearly contradicts an explicit user decision, security requirement, or later documented correction.

## 8. Verify responsive behavior

Do not optimize only for the development viewport.

Check relevant desktop widths and smaller supported sizes.

Watch for accidental overflow caused by:

- cards
- tables
- sidebars
- forms
- drawers
- modals
- long text

Collapsed navigation must remain usable and important actions must remain discoverable.

Fixed-height areas may use intentional internal scrolling when that matches the prototype behavior.

## 9. Handle overlays correctly

For modals and drawers:

- Match the interaction demonstrated in `finalmodel.html`.
- Keep modal content inside an overlay rather than normal page flow.
- Use internal scrolling when content exceeds the intended height.
- Keep drawers attached to the intended screen edge.
- Do not let drawers unexpectedly reflow the underlying page.
- Prevent duplicate dialogs or duplicate confirmation interfaces.
- Match Escape behavior where demonstrated or appropriate.
- Provide explicit close actions.
- Preserve reasonable focus behavior.
- Consider background interaction, long content, small viewports, and repeated open and close cycles.

Prefer reusable overlay primitives once the same pattern appears repeatedly.

## 10. Preserve accessibility

Use semantic interactive elements.

Buttons should normally be real buttons.

Forms should have accessible labels.

Keyboard navigation should work for important interactions.

Focus states should remain visible.

Do not remove accessibility behavior for visual styling.

Design accessible names so automated browser tests can target controls reliably without brittle implementation-specific selectors.

## 11. Browser verification checklist

For substantial user-facing changes, verify the prototype workflow and relevant visual states:

```text
Prototype primary path
All visible prototype controls
Navigation result
Repeated open and close
Default
Hover
Focus
Loading
Empty
Error
Long content
Small viewport
Normal desktop viewport
```

Check the browser console for unexplained errors or warnings introduced by the change.

If the change belongs to an implementation phase, follow the phase-delivery skill for acceptance, regression, and documentation.