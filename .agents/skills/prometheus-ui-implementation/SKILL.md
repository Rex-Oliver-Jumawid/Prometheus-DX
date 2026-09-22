---
name: prometheus-ui-implementation
description: Use when implementing or substantially changing Prometheus user-facing UI. Treats the current Figma design as the source of truth for UI layout and visual design, with HTML prototypes as interaction references and canonical requirements preserving production security and architecture.
---

# Prometheus UI Implementation

Use this workflow for pages, components, navigation, drawers, modals, responsive behavior, visual refinements, and substantial interaction changes.

Read `.context/ui-reference.md` before substantial UI work.

## 1. Start from the current Figma frame

For user-facing layout and visual design, the current Prometheus Figma file is the source of truth.

Inspect the exact target frame with the connected Figma integration before implementing the production screen.

Do not treat Figma as loose inspiration.

Capture all relevant visual details, including where applicable:

- page and screen composition
- application-shell layout
- navigation placement and grouping
- visible fields and controls
- cards, panels, drawers, and modals
- scrolling regions
- responsive hierarchy
- spacing
- typography
- colors
- icons
- component sizing
- visual state treatment
- profile and sidebar placement

If production differs from the current Figma frame, do not automatically preserve the production difference.

Treat the difference as something to reconcile.

Use `.model/finalmodel.html` and `.model/login-page.html` only for interaction and workflow details that the target Figma frame does not fully express.

When practical, run and interact with those prototypes to understand missing behavioral detail without copying their older layout.

## 2. Preserve the experience, not the prototype implementation technique

Figma is authoritative for current layout and visual design, while the HTML prototypes may supply interaction detail that is not fully represented by a static frame.

Do not copy prototype JavaScript state, mock data, DOM structure, local persistence, or frontend-only permission checks as the real implementation.

Do not migrate `finalmodel.html` into one giant React component.

Rebuild the demonstrated experience using maintainable production code and `.context/tech-stack.md`.

Use real APIs, backend authorization, validation, and PostgreSQL persistence where the prototype only simulates them.

If a prototype feature requires a field, state, or relationship missing from the current production data model, do not silently omit the feature.

Identify the mismatch and reconcile the requirements and persistence model before continuing.

## 3. Use Figma as the visual source of truth

Figma owns current UI layout and visual design.

Use the live Figma connection to inspect:

- measurements
- spacing
- typography
- colors
- icons
- design tokens and variables
- component details
- frame structure
- screenshots
- visual alignment
- navigation placement
- responsive intent

When Figma and an HTML prototype disagree about layout or visual presentation, follow Figma.

Do not reintroduce an older prototype-only control merely because it still exists in historical code or documentation.

### Figma MCP / connected integration

The connected Figma integration should be used for substantial Prometheus UI work.

Inspect the specific frame relevant to the implementation rather than relying only on a pasted URL or screenshot.

If the Figma connection is unavailable or cannot access the file, state that limitation explicitly and do not claim live Figma inspection occurred.

Current Prometheus Figma file:

`https://www.figma.com/design/8zgQ4pcWtku7rSWzjlP9K9/Prometheus`

File key: `8zgQ4pcWtku7rSWzjlP9K9`

Current Phase 7 frame references:

- Home: `189:3`
- Notifications: `11:2301`

The current Figma shell places Notifications in the lower sidebar utility area with an unread badge.

Do not add a separate top-right notification bell or notification control unless a newer explicit product decision changes the layout.

If the current phase or `.docs/CURRENT.md` provides another specific Figma node, inspect that node for the relevant screen.

## 4. Resolve conflicts correctly

Apply this order when implementation references disagree:

1. SRS and `user-flows.md` define functional, workflow, and authorization intent that production must enforce securely.
2. Figma owns current UI layout, visual composition, navigation placement, and visual design.
3. `.model/finalmodel.html` and `.model/login-page.html` provide interaction detail where the target Figma frame does not fully specify behavior.
4. `data-model.md` defines the current persistence model, but a mismatch with a required feature must be reconciled rather than solved by silently deleting the feature.
5. `tech-stack.md` owns production architecture.

If a real behavioral conflict remains, resolve it against canonical requirements or a newer explicit product decision.

If a real security or data-integrity conflict remains, surface it explicitly and resolve it instead of weakening backend safeguards.

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

## 7. Treat Figma fidelity as part of correctness

Inspect the production implementation in a real browser whenever possible.

Compare the working application directly against the relevant current Figma frame.

Use the HTML prototype only to verify interaction or workflow details that are not fully expressed by the Figma frame.

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

An unexplained visual difference from Figma or behavioral difference from the canonical workflow should be treated as a defect or unresolved product conflict.

Do not preserve an obvious accidental prototype behavior when it clearly contradicts Figma, an explicit user decision, a security requirement, or a later documented correction.

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

Fixed-height areas may use intentional internal scrolling when that matches the Figma layout or an explicitly documented interaction.

## 9. Handle overlays correctly

For modals and drawers:

- Match the Figma overlay layout and use the interaction reference or canonical workflow for behavior that a static frame does not show.
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