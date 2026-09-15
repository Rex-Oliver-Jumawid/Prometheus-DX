---
name: prometheus-ui-implementation
description: Use when implementing or substantially changing Prometheus user-facing UI. Requires inspecting both the functional HTML prototype and the relevant Figma design, while preserving canonical product, authorization, and persistence rules.
---

# Prometheus UI Implementation

Use this workflow for pages, components, navigation, drawers, modals, responsive behavior, visual refinements, and substantial interaction changes.

## 1. Inspect both implementation references before coding

For substantial user-facing work, inspect both the functional HTML prototype and the relevant Figma design before implementing the production UI.

Do not use only one of them when both are available.

### Functional HTML prototype

Primary functional prototype:

`.model/finalmodel.html`

Authentication-specific prototype:

`.model/login-page.html`

Use the relevant prototype to understand the approved UI interaction behavior, including where applicable:

- navigation flow
- page composition and screen transitions
- tabs and toggles
- drawers and modals
- expandable and collapsible regions
- scrolling behavior
- button behavior
- repeated open and close behavior
- visible UI state after user actions
- interaction sequencing
- functional relationships between controls on the screen

When practical, inspect the prototype as an interactive page rather than only reading its source.

The prototype is a functional design reference, not production architecture.

Do not copy prototype JavaScript state, DOM structure, local state, or frontend-only permission checks into production as authoritative business logic.

Do not migrate `finalmodel.html` into one giant React component.

Rebuild the approved behavior using maintainable production React components and the architecture defined in `.context/tech-stack.md`.

### Figma visual design

Current user-selected Prometheus Figma reference:

`https://www.figma.com/design/8zgQ4pcWtku7rSWzjlP9K9/Prometheus?node-id=17-4603&t=9bvq2LAHiC0GPJs7-1`

File key: `8zgQ4pcWtku7rSWzjlP9K9`

Starting node: `17:4603`

Before implementing or substantially changing user-facing UI, access the Figma file through the available Figma integration rather than relying only on the URL, screenshots, or memory.

Use the provided starting node as an entry point into the current design file, then inspect the exact page or frame relevant to the screen being implemented.

If the current phase or `.docs/CURRENT.md` provides a more specific Figma node, prefer that node.

Use Figma as the source of truth for visual details such as:

- layout
- spacing
- typography
- colors
- component appearance
- visual hierarchy
- icons
- dimensions
- responsive visual intent

## 2. Resolve reference conflicts correctly

Use the canonical repository requirements for product behavior, authorization, persistence, and domain rules.

Use `.model/finalmodel.html` as the approved functional UI interaction reference where it does not conflict with canonical requirements.

Use Figma as the approved visual reference.

When references disagree:

- SRS owns functional requirements and business rules.
- `user-flows.md` owns authorization and canonical workflow behavior.
- `data-model.md` owns persistent relationships and state.
- `tech-stack.md` owns production architecture.
- `.model/finalmodel.html` owns intended UI interaction behavior where canonical requirements do not override it.
- Figma owns visual design.

If Figma and `finalmodel.html` differ only in visual detail, follow Figma unless a newer design decision is documented.

If the prototype conflicts with canonical access control, persistence, or business rules, follow the canonical requirements.

Do not infer authorization or database behavior from either Figma or prototype JavaScript.

## 3. Reuse canonical assets

Use repository assets instead of recreating them when the design calls for them.

Authentication assets:

- `/auth/prometheus-mark.png`
- `/auth/prometheus-auth-background.png`

Authenticated workspace background:

- `/backgrounds/editorial-gradient.webp`

Do not duplicate these assets into `src/` or approximate them with CSS unless a specific design requirement calls for a different treatment.

## 4. Preserve frontend architecture

Use the approved frontend stack from `.context/tech-stack.md`.

General boundaries:

- React Router for navigation.
- TanStack Query for server-managed data.
- Zustand only for shared temporary UI state where local React state is insufficient.
- React Hook Form for structured forms.
- Zod for runtime validation and reusable contracts where appropriate.

Do not duplicate persistent server-managed business state into frontend-only stores.

## 5. Treat visual and interaction correctness as functional correctness

Inspect the production implementation in a real browser whenever possible.

Compare it against both the relevant prototype interaction and the relevant Figma frame.

Check:

- interaction sequence
- navigation result
- modal and drawer behavior
- tab and toggle state
- expand and collapse behavior
- scrolling behavior
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

Do not preserve an obvious prototype defect merely for prototype fidelity.

If an interaction in the prototype is clearly inconsistent with canonical requirements, implement the canonical behavior and document the difference when it is meaningful.

## 6. Verify responsive behavior

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

Fixed-height dashboard areas may use intentional internal vertical scrolling where the approved interaction calls for it.

## 7. Handle overlays correctly

For modals and drawers:

- Match the intended interaction shown in the functional prototype.
- Keep modal content inside an overlay rather than normal page flow.
- Use internal scrolling when content exceeds the intended height.
- Keep drawers attached to the intended screen edge.
- Do not let drawers unexpectedly reflow the underlying page.
- Prevent duplicate dialogs or duplicate confirmation interfaces.
- Consider Escape behavior where appropriate.
- Provide explicit close actions.
- Preserve reasonable focus behavior.
- Consider background interaction, long content, small viewports, and repeated open and close cycles.

Prefer reusable overlay primitives once the same pattern appears repeatedly.

## 8. Preserve accessibility

Use semantic interactive elements.

Buttons should normally be real buttons.

Forms should have accessible labels.

Keyboard navigation should work for important interactions.

Focus states should remain visible.

Do not remove accessibility behavior for visual styling.

Design accessible names so automated browser tests can target controls reliably without brittle implementation-specific selectors.

## 9. Browser verification checklist

For substantial user-facing changes, verify the intended prototype behavior and inspect relevant visual states:

```text
Default
Primary interaction path
Repeated open and close
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
