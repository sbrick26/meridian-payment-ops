# Design system fidelity

Meridian Corp maintains one design system. **Meridian Design Language 3.0**, as
published on its Figma page, is the single source of truth for every
user-visible interface token and component. Local reinvention of tokens produces
inconsistent operator interfaces, undermines accessibility conformance, and
creates rework at brand review.

## Tokens are derived, never invented

All colour, typography, spacing, elevation, border-radius, iconography, and
component behaviour must be taken from Meridian Design Language 3.0. This
includes:

- palette values, including semantic tokens for success, warning, error, and
  the payment-exception states;
- the type scale, weights, and line heights;
- the spacing scale and grid;
- component anatomy and states for buttons, form controls, tables, badges,
  dialogs, and navigation.

Do not select a hex value, font size, or spacing value by judgement, by copying
another product, or by matching a screenshot. If a required token does not exist
in the design system, that is a gap to raise with Design — not a value to
improvise. Record the gap in the key-decisions section of `PLAN.md` and proceed only with Design's
written answer.

## Design review precedes implementation

Any change that alters what a user sees — new screens, changed layouts, new
components, restyled existing components, changed copy in the interface —
requires design review **before** implementation begins. The reviewing designer
and the date are recorded in the plan document (rule 07). Implementation started
ahead of design review is rework, and is treated as a planning failure.

## Implemented interfaces are verified against the approved design

Before a user-visible change is marked complete, the implemented interface is
compared against the approved design and the result recorded in the pull
request: which screens were checked, against which design frames, and any
accepted deviations with the approver's name.

Accessibility conformance (WCAG 2.2 AA contrast and focus behaviour) is part of
that verification, not a separate later activity.
