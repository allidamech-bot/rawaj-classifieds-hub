# RAWAJ design system — approved identity and migration contract

> Status: **Phase 1 in progress** (14 November 2026). This is the source-of-truth
> contract for the approved peacock-petrol homepage identity, not a claim that
> every route is already migrated or visually accepted.

## Approved identity: actual homepage values

The shared source of truth is `src/design-foundation.css`. Existing homepage
styles consume its `--rawaj-identity-*` tokens through `--home-*` aliases.
Do not redefine the same palette in a per-route stylesheet. The rollout is
additive: historical dark semantics are intentionally unchanged until each
dependent route has been migrated and reviewed.

| Token | Value | Intended role |
| --- | --- | --- |
| `--rawaj-identity-petrol` | `#073836` | Primary dark branded panels and hero surfaces |
| `--rawaj-identity-teal` | `#08635e` | Interactive/action accent on light ivory |
| `--rawaj-identity-ivory` | `#f9f0e4` | Homepage canvas and light-on-dark inverse text |
| `--rawaj-identity-champagne` | `#ffe3b0` | Premium detailing and text **on petrol** |
| `--rawaj-identity-ink` | `#132724` | Primary copy on ivory |
| `--rawaj-identity-gold` | `#eac38f` | Premium accent on petrol, not low-contrast copy on ivory |

These are the **existing approved homepage values**, not speculative new colors.
The palette does not confer approval on other routes. Contrast pairs validated
in source tests: ink/ivory 13.85:1, teal/ivory 6.29:1, ivory/petrol 11.43:1,
champagne/petrol 10.36:1, gold/petrol 7.80:1. Gradients, overlays,
transparency, and image-backed text require **rendered** checks in addition to
these solid-color calculations.

## Ownership and preservation

- **Homepage**: its approved composition, media, geometry, and current action
  behavior remain protected. Only alias existing colors to canonical tokens
  during the safe foundation slice; do not redesign it in Phase 1.
- **My Store**: owner `/profile/listings`, its editor, and public seller
  `/seller/:id` retain the approved design and behavior. Screen-level CSS must
  not leak into these routes.
- **Other routes**: migrate route families deliberately, with shared
  components (Button, Card, Input, select, dialog, shell, dock) consuming
  semantic tokens from the foundation.
- **Legacy styles**: `rawaj-global-dark-system.css`, recovery V7/V7B, and
  related historical layers are still loaded in main. Their presence is a
  known migration dependency, not authorization to delete them without
  selector/dependency audits and rendered regression checks.
- **PR #867**: merged as `5a55344931652a7373f8f763bd9a624d30ef28db`.
  Categories use the reconciled petrol/ivory directory design. The rejected
  blanket ivory stylesheet must not be restored.
- **Verified merged foundation**: #866 (`8e18e03f210c6ea4b18810c39582759aa1c32bfd`)
  and #868 (`bceb5f8a3fa3f8d45d63053ae576e6a815681abd`).


## Component and page rules

1. Canonical palette/spacing/radius/focus/motion tokens belong in
   `src/design-foundation.css`. Component CSS may arrange or specialize a
   component but must not establish a second global palette.
2. Use semantic meaning (canvas, text, inverse, muted, status, accent), not
   hard-coded colors in every route. Gold/champagne are **not** defaults for
   small text on ivory.
3. Keep interactive touch targets at least 44px, preserve keyboard focus
   visibility, and support reduced motion.
4. Verify actual content and error, empty, disabled, loading, modal, and
   keyboard-open states, not only source selectors.
5. Support Arabic RTL and English LTR at 320, 360, 390, 430, 768, and
   desktop widths; test iPhone Safari/PWA safe areas separately.
6. Retain existing API/data/permissions/business rules; any nonvisual
   concern belongs in its own engineering track.

## Expanded execution batches and acceptance gates

1. **B1 — Foundation and entry experiences**: substantially completed through
   #866, #868 and #867. Preserve homepage, categories and My Store; physical
   iPhone acceptance remains pending.
2. **B2 — Discovery and listings**: B2.1 search/results in progress, followed
   sequentially by B2.2 listing detail and B2.3 listing studio. Not accepted yet.
3. **B3 — Personal and operational experiences**: account, communication,
   trust/support and administration, each independently tested and merged. Pending.
4. **B4 — Integration**: audited legacy retirement, actual route inventory,
   responsive RTL/LTR browser acceptance and owner handoff. Pending.

**A batch is not accepted by a passing source check alone.** Required evidence:
exact commit SHA, affected paths, before/after screenshots, RTL/LTR and role
coverage, contrast/touch/overflow review, relevant functional regression, and
CI result on the same SHA. No automatic production deployment; the owner
publishes manually.

## Phase 1 update — shared semantic status primitives

`Badge` accent/success/warning/gold/destructive variants now consume
central `--rawaj-badge-*-{border,surface,ink}` roles rather than embedding the
retired pink/purple colors in the component. The legacy/default palette retains
its existing appearance. A scoped `data-design-palette="ivory"` token contract
is available for **future, explicitly reviewed** route migration; it is not yet
enabled on the application shell or My Store. The light badge colors pass
WCAG AA 4.5:1 for opaque foreground/background pairs, but still require
actual rendered contrast checks when a route opts in.

Do not activate the new route palette on `/profile/listings`, `/seller/:id`,
or `/` as an unreviewed shortcut. Route visual acceptance and an explicit
sign-off are prerequisites.
