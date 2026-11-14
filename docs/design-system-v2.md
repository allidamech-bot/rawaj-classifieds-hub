# RAWAJ design system — approved identity and migration contract

> Status: **B1 substantially completed; B2 in progress** (14 November 2026). This is the source-of-truth
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
2. **B2 — Discovery and listings**: B2.1 search/results implementation in PR #869, followed
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
is used by the approved category directory and the B2.1 results/filter portal.
It is not enabled globally on the application shell or My Store. The light badge colors pass
WCAG AA 4.5:1 for opaque foreground/background pairs, but still require
actual rendered contrast checks when a route opts in.

Do not activate the new route palette on `/profile/listings`, `/seller/:id`,
or `/` as an unreviewed shortcut. Route visual acceptance and an explicit
sign-off are prerequisites.

## B2.1 source ownership — PR #869

Search results and its filter portal opt into the existing ivory semantic
contract. `listings-results.css` owns results presentation; V3 discovery retains
responsive geometry and the legacy default card appearance on other routes.
`search-filters-v1.css` continues to own the protected category directory.

The source cascade migration removes exact search selector arms from V7B,
V18 home/discovery, V19 consistency and V19 specificity. Shared historical
card, text, label and input rules exclude results using `:where()` so their
specificity and appearance remain unchanged on other routes. The filter portal
carries its own palette because body portals cannot inherit page tokens.

Existing shared shell declarations expose optional `--rawaj-shell-*` surface,
ink, line, shadow and ambient slots. Their fallback values preserve the previous
appearance. Only `/listings` assigns these slots, using canonical identity
aliases for its canvas, header, footer and mobile navigation. There is no new
late-loaded override bundle and no new important priority in the route stylesheet.

Acceptance evidence must distinguish Chromium automation from WebKit and real
hardware: WebKit was downloaded but could not launch in this workspace because
its system libraries are missing and installing them requires unavailable root
access. Physical iPhone Safari and standalone PWA remain owner/device acceptance.

Rendered fixture captures: [390px before](visual-evidence/b2-1/search-390-before.png),
[390px after](visual-evidence/b2-1/search-390-after.png),
[1440px before](visual-evidence/b2-1/search-1440-before.png),
[1440px after](visual-evidence/b2-1/search-1440-after.png).
These use deterministic local fixtures; they do not represent production inventory.

Local verification includes 23 targeted Chromium scenarios, the rendered results
contrast/layout audit, price draft/apply/reset, sorting, grid/list URL state,
empty/error recovery, 200% text and RTL/LTR across all seven target widths.
Home, My Store and seller captures at 390/1440 match the reference pixels;
categories retain their dimensions and pass the directory tests, with sparse
rasterization differences in capture comparison. Independent static review found
no blocking issues. Required CI and merge state are recorded on PR #869.

Additional historical source suites still fail identically on the reference main:
`test:discovery-marketplace-v4` expects the retired homepage `DiscoveryHero`;
`precheck` stops at a stale owner performance fixture assertion; the optional V25
source suite expects retired Input/My Store markup. These assertions were not
changed in this search migration. The required Quality Gate command set passes
locally; do not confuse the historical optional suites with successful checks.


## B2.2 listing detail — implementation candidate, pending acceptance
The detail route and contact dock now opt into the existing canonical ivory theme,
while the page-specific shell uses approved petrol chrome. Historical detail-only
overrides in V7B/V14/V15/V16 are removed in their original stylesheets; My Store
and other route ownership remain intact. Retain the existing SEO/SSR, gallery,
contact, conversation, comparison, favorites, reports and offer workflows.
This is not accepted until rendered RTL/LTR tests and final-SHA CI are green,
the PR is verified mergeable and is merged into main.


B2.2 dependency audit continuation: retired the remaining inherited dark detail selectors
at their actual V11, V18, V22 and discovery V4 owners; the V18 shared seller
selector arm was retained. The V22 media aspect ratio and safe-area dock contract
are now route-owned, including two-column mobile action reflow. Existing source
contract tests were aligned to the approved replacement, without removing their
coverage of seller identity, contact behavior or safe-area reservations.

The last V6 detail-specific dark selectors were also retired at source; shared and storefront V6 selectors remain protected.


The generic app-shell main reset retains its original specificity so the
accepted B2.1 search styles remain untouched. The detail main now explicitly
owns its opaque ivory canvas through the existing route stylesheet.

B2.2 audit also retired the leftover discovery V4 listing detail typography, price accent and narrow-spec declarations, keeping responsive specification wrapping in the owned detail stylesheet. No global overrides were introduced.


The remaining V17 forced-dark detail surfaces and V19 important-price mobile
rules have been retired from their original owners. V18 historical adaptive-card
skins now exclude the detail route, and responsive listing-specific rules reside
in listing-detail-v3.css. Protected routes keep their legacy fallbacks.
