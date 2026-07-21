# RAWAJ Design System V2

This foundation is the visual contract for all subsequent page redesigns. `src/design-foundation.css` is the single canonical token source. `src/design-system-v2.css` is a temporary compatibility component layer and must not declare root palette, spacing, radius, shadow, or motion values.

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

- `Button`: `default`/`accent` for the dominant coral action, `brand` for deep-green secondary emphasis, plus `soft`, `success`, `secondary`, `outline`, `ghost`, `destructive`, and `link`.
- `Badge`: `default`, `secondary`, `accent`, `success`, `warning`, `gold`, `destructive`, `outline`.
- `Input`: 48px default height with visible hover, focus, disabled, and validation-compatible states.
- `Card`: `default`, `flat`, `subtle`, and `elevated`, with `interactive` reserved for actionable cards.

## Foundation scales

- Spacing: `4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64`.
- Controls: `40 / 44 / 48px`; compact controls are reserved for dense secondary actions.
- Icons: `16 / 20 / 24px`.
- Elevation: soft, raised, overlay; borders carry the default separation.
- Layering: base, sticky, dock, overlay, toast.
- Motion: 150 / 200 / 300ms with reduced-motion support.

## Page redesign rule

New page work must consume these tokens and components. Do not add a route-local replacement palette or a generic white card system. Page-specific CSS may arrange and specialize components, but the shared color, radius, shadow, motion, and focus contracts remain authoritative.

## Marketplace core rules

- Home discovery uses a single high-contrast hero and one dominant search action.
- Categories, featured inventory, and latest inventory use distinct sage, gold, and warm section surfaces.
- Common search links are presented as shortcuts, never as unsupported trending claims.
- Listing cards render one per row below 390px, two from 390px, three from 640px, and four from 1024px.
- Featured and reserved states must be explicit in markup and cannot rely on color alone.

## Rollout checks

Every page redesign must be reviewed at 320px, 360px, 390px, 430px, and desktop widths. It must preserve RTL and LTR layout, visible keyboard focus, reduced-motion behavior, readable dark-surface contrast, and a minimum 44px touch target for primary controls.
