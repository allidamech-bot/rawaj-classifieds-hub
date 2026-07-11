# RAWAJ Design System V2

This foundation is the visual contract for all subsequent page redesigns.

## Brand roles

- Forest (`#123f38`): trust, primary actions, active navigation, high-priority headings.
- Orange (`#f45f38`): posting, momentum, conversion actions, compact accents.
- Gold (`#c99543`): verification, featured and premium states only.
- Ivory (`#f6f2e9`): page canvas.
- Card ivory (`#fffdf9`): elevated content.
- Sage (`#e9f0ea`): neutral section separation and selected soft states.
- Warm (`#fff0e8`): promotions, offers, and contextual highlights.

## Surface hierarchy

Use the lightest suitable layer instead of making every block white:

1. Page: `rawaj-page-surface`
2. Sage section: `rawaj-section-sage`
3. Warm section: `rawaj-section-warm`
4. Gold section: `rawaj-section-gold`
5. Elevated content: shared `Card` / `data-ui="card"`

## Shared controls

- `Button`: `default`, `accent`, `soft`, `success`, `secondary`, `outline`, `ghost`, `destructive`, `link`.
- `Badge`: `default`, `secondary`, `accent`, `success`, `warning`, `gold`, `destructive`, `outline`.
- `Input`: 48px default height with visible hover, focus, disabled, and validation-compatible states.

## Page redesign rule

New page work must consume these tokens and components. Do not add a route-local replacement palette or a generic white card system. Page-specific CSS may arrange and specialize components, but the shared color, radius, shadow, motion, and focus contracts remain authoritative.

## Rollout checks

Every page redesign must be reviewed at 320px, 360px, 390px, 430px, and desktop widths. It must preserve RTL and LTR layout, visible keyboard focus, reduced-motion behavior, readable dark-surface contrast, and a minimum 44px touch target for primary controls.
