---
name: prometheus-ui-implementation
description: Use when implementing or substantially changing Prometheus user-facing UI. Covers Figma-first design review, prototype fallback, canonical assets, responsive behavior, overlays, accessibility, and browser verification.
---

# Prometheus UI Implementation

Use this workflow for pages, components, navigation, drawers, modals, responsive behavior, visual refinements, and substantial interaction changes.

## 1. Inspect the canonical visual source

Prometheus Figma:

`https://www.figma.com/design/8zgQ4pcWtku7rSWzjlP9K9/Prometheus?node-id=19-12077&t=WEpRDccEfW56hE0W-1`

Use Figma as the source of truth for:

- Page composition.
- Layout.
- Spacing.
- Typography.
- Colors.
- Component appearance.
- Visual hierarchy.
- Icons.
- Responsive visual intent.

Do not infer business rules, permissions, persistence behavior, or authorization from Figma.

## 2. Use prototypes only as secondary references

Use `.model/finalmodel.html` and `.model/login-page.html` for interaction clarification or fallback visual reference when Figma is insufficient or unavailable.

Prototype JavaScript state is not production persistence or authorization.

Do not migrate the prototype into one giant React component.

Rebuild concepts using maintainable production components.

If Figma and a prototype disagree visually, follow Figma unless a newer decision is documented.

If a prototype conflicts with canonical requirements about behavior or access, follow the repository requirements.

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

## 5. Treat visual correctness as functional correctness

Inspect the implementation in a real browser whenever possible.

Check:

- Alignment.
- Spacing.
- Typography.
- Component sizing.
- Overflow.
- Scroll behavior.
- Hover states.
- Focus states.
- Disabled states.
- Loading states.
- Empty states.
- Error states.
- Icon consistency.
- Visual hierarchy.

Do not preserve an obvious prototype defect merely for prototype fidelity.

## 6. Verify responsive behavior

Do not optimize only for the development viewport.

Check relevant desktop widths and smaller supported sizes.

Watch for accidental overflow caused by:

- Cards.
- Tables.
- Sidebars.
- Forms.
- Drawers.
- Modals.
- Long text.

Collapsed navigation must remain usable and important actions must remain discoverable.

Fixed-height dashboard areas may use intentional internal vertical scrolling where the design calls for it.

## 7. Handle overlays correctly

For modals and drawers:

- Keep modal content inside an overlay rather than normal page flow.
- Use internal scrolling when content exceeds the intended height.
- Keep drawers attached to the intended screen edge.
- Do not let drawers unexpectedly reflow the underlying page.
- Prevent duplicate dialogs or duplicate confirmation interfaces.
- Consider Escape behavior where appropriate.
- Provide explicit close actions.
- Preserve reasonable focus behavior.
- Consider background interaction, long content, small viewports, and repeated open/close cycles.

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

For substantial user-facing changes, inspect relevant states:

```text
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
