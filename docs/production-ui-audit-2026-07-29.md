# RAWAJ Production UI/UX Audit — 2026-07-29

## Safety boundary

- Repository: `allidamech-bot/rawaj-classifieds-hub`
- Working branch: `feature/lovable-design-firebase`
- Pull request: #524 (Draft)
- Production frontend: `https://rawa-j.com`
- Do not merge to `main`, promote/redeploy Production, change Cloudflare traffic, alter PR #515, expose secrets, or change Firebase/D1/R2 business behavior as part of the visual audit.
- Cloudflare Worker must remain on the currently restored working version unless a separately approved backend deployment is required.

## Audit goal

Review every route, navigation surface, action, form, state, color, spacing rule, width, height, alignment, RTL/LTR behavior, safe area, mobile dock interaction, and responsive breakpoint. A successful build or HTTP response is not considered visual acceptance.

Target viewports:

- 360 × 800
- 390 × 844
- 412/430 × 915/932
- Tablet widths
- 1440 × 1000 desktop
- Arabic RTL and English LTR

## Status legend

- `CONFIRMED`: reproduced by authenticated Production screenshots and/or verified directly in current source.
- `STRUCTURAL`: root cause verified in source; requires source-level correction.
- `PENDING VISUAL`: route/source inventoried, final rendered review still required.
- `BLOCKED AUTH`: needs an authenticated rendered browser session for final interaction verification.

## Confirmed systemic findings

### UI-CORE-001 — Competing CSS generations are loaded together

**Status:** CONFIRMED / STRUCTURAL / CRITICAL

`src/routes/__root.tsx` loads many historical global and route-specific CSS files, including old visual foundations, marketplace generations, account generations, listing studio generations, desktop polish, and launch-readiness polish. Importing `src/lib/route-styles.ts` also loads the new semantic/dark/recovery layers as side effects.

Impact:

- legacy ivory/green colors can resurface;
- source component semantics are overwritten by load order;
- the same component receives several incompatible layout definitions;
- visual behavior differs by route despite shared components;
- additional `!important` recovery rules become necessary and compound the problem.

Required correction:

1. Produce a route-by-route CSS ownership map.
2. Remove retired sheets from the active runtime rather than covering them with another global layer.
3. Keep one semantic token source and one component/route stylesheet per current experience.
4. Validate each removal with rendered route checks before proceeding.

### UI-CORE-002 — Recovery selectors flatten the entire visual hierarchy

**Status:** CONFIRMED / STRUCTURAL / CRITICAL

`src/rawaj-page-by-page-recovery-v7b.css` applies broad selectors such as `main :is(section, article, form, ...)` and forces the same panel gradient, border, and text colors across account, storefront, listing studio, support, and admin surfaces.

Impact:

- every element appears to be the same card;
- warning, informational, metric, action, and neutral surfaces lose semantic distinction;
- account and admin pages look visually flat and dead;
- source-level accent classes (`rawaj-world-*`, warning, success, primary) are neutralized.

Required correction:

Replace broad route-level element selectors with explicit component classes and semantic tone attributes. Do not add another blanket recovery sheet.

### UI-CORE-003 — Blank-space behavior is produced by multiple reserves

**Status:** CONFIRMED / STRUCTURAL / HIGH

The shell/page uses viewport minimum heights, route content adds mobile bottom padding, the shell reserves dock/safe-area space, and the footer adds its own top margin. Short routes therefore expose a large empty region before the footer or bottom dock.

Required correction:

- define one owner for bottom-dock reservation;
- distinguish short-page footer placement from feed pages;
- remove duplicate `mobile-page-bottom`, shell reserve, and route padding where they overlap;
- do not fill accidental layout gaps with decorative whitespace.

### UI-CORE-004 — Existing visual E2E captures do not assert visual correctness

**Status:** CONFIRMED / HIGH

`e2e/rendered-visual-qa.spec.ts` captures screenshots but only asserts that the route is below HTTP 500 and that `main` is visible. It does not fail for overlapping text, unreadable contrast, huge blank gaps, hidden horizontal navigation, or malformed cards.

`e2e/production-acceptance.spec.ts` verifies authenticated route access and request/console failures, but not layout quality.

Required correction:

Add deterministic layout and accessibility assertions for critical surfaces, then retain screenshots as evidence rather than treating screenshot creation itself as acceptance.

## User-reported and confirmed page findings

### UI-HOME-001 — Promotional banner framing is wrong

**Status:** CONFIRMED

Current slot is fixed to `aspect-[16/7]` and renders only the first returned placement. The Production screenshot shows the uploaded artwork occupying only part of the frame.

Required correction:

- move the home promotional area directly under the primary search area;
- validate image crop/contain rules against the actual mobile and desktop assets;
- support two independent placements only if the API/admin model provides two distinct ranked records; never duplicate one advertisement;
- keep the `Ad` label visible and compact;
- hide the entire slot when no valid image exists.

### UI-CATEGORIES-001 — Categories page ends after the directory

**Status:** CONFIRMED / PRODUCT GAP

`src/routes/categories.tsx` renders the category directory and then ends. There is no discovery feed below it, so short content creates a dead region before the footer.

Approved direction:

1. Category directory.
2. Promoted listings ordered by admin-defined rank/priority.
3. Regular approved listings.
4. Incremental loading/pagination.

This requires a real listings data component, not a CSS filler.

### UI-FOOTER-001 — Mobile footer has weak contrast and inconsistent ownership

**Status:** CONFIRMED / STRUCTURAL

The footer is styled by several generations of CSS. Mobile copy/link typography is small and muted, while legacy dark-green and newer charcoal footer definitions compete.

Required correction:

- one footer stylesheet/component contract;
- ivory primary text and readable secondary text;
- clear visual groups, restrained coral/pink/blue accents, matte treatment;
- correct spacing above the bottom dock and safe area;
- no duplicate gap created by route and shell reserves.

### UI-MYLISTINGS-001 — Owner storefront hero overwhelms listing management

**Status:** CONFIRMED / STRUCTURAL

`/profile/listings` places the full `StorefrontIdentityHero` before draft/listing management. The component contains cover, avatar, identity, bio, four metrics, and three actions. Current CSS generations conflict on its mobile layout, producing the overlap shown in Production.

Required correction:

- make drafts/listing states the primary workspace;
- use a compact owner identity summary rather than the full public storefront hero;
- preserve the existing `Resume draft` route to `/profile/listings/$id`;
- show clear status badges, completion, missing requirements, and one primary action;
- keep secondary actions in a menu or compact action row.

### UI-STUDIO-001 — Add/edit listing lacks hierarchy and wastes vertical space

**Status:** CONFIRMED / STRUCTURAL

The studio always stacks completion, preview, quality, and a generic Note card. Broad recovery rules make these surfaces visually identical. The studio stylesheet also enforces a tall decorative hero and very small helper text in several places.

Required correction:

- use one compact hierarchy for score, missing requirements, preview, and note;
- create a semantic warning/note component instead of a generic card;
- differentiate completed, required, informational, success, and blocked states;
- remove duplicated bottom-height/reserve rules;
- preserve autosave, validation, upload, taxonomy, D1/R2, and submission logic.

### UI-MORE-001 — Account hub accents are neutralized

**Status:** CONFIRMED / STRUCTURAL

The account hub defines distinct shortcut worlds and grouped sections, but broad recovery selectors force every section and color card into the same panel gradient. Titles/hints also use truncation and very small text.

Required correction:

- restore semantic group differentiation;
- avoid truncating essential Arabic labels/hints;
- increase minimum secondary-text size and contrast;
- keep logout visually isolated as a destructive action;
- remove blank space before footer.

### UI-ADMIN-001 — Admin navigation has no overflow affordance

**Status:** CONFIRMED / STRUCTURAL

The admin navigation is horizontally scrollable, snap-enabled, and has hidden scrollbars. There are no arrows, edge fades, position indicator, or all-sections menu. Users must discover swipe/drag by accident.

Required correction:

- RTL-aware previous/next buttons;
- edge fade only when additional content exists;
- clearly visible active underline/tone;
- optional all-sections menu;
- keyboard-operable scrolling and focus visibility.

### UI-ADMIN-002 — Admin surfaces are flattened and warning panel breaks theme

**Status:** CONFIRMED / STRUCTURAL

The permissions notice uses a warning utility surface while broad admin recovery rules flatten sections, articles, forms, tables, and cards into one panel style. Metrics and command areas lose hierarchy.

Required correction:

- semantic admin surface types: notice, command hero, normal metric, warning metric, critical queue, table, filter, empty state;
- redesign the command center and all `/admin/*` routes consistently;
- preserve permissions and backend operations unchanged.

## Route inventory

### Public discovery

- `/`
- `/categories`
- `/category/$slug`
- `/listings`
- `/listings/$id`
- `/offers`
- `/seller/$id`

### Authentication/account

- `/login`
- `/reset-password`
- `/auth/callback`
- `/more`
- `/profile`
- `/profile/listings`
- `/profile/listings/$id`
- `/add-listing`
- `/favorites`
- `/saved-searches`
- `/activity`
- `/notifications`
- `/verification`
- `/promotion`

### Communication/support/legal

- `/chats`
- `/support`
- `/safety`
- `/terms`
- `/privacy`
- `/prohibited`

### Administration

- `/admin`
- `/admin/pending`
- `/admin/listings`
- `/admin/data-quality`
- `/admin/reviews`
- `/admin/reports`
- `/admin/message-reports`
- `/admin/safety`
- `/admin/verifications`
- `/admin/users`
- `/admin/promotions`
- `/admin/ad-placements`
- `/admin/campaigns`
- `/admin/audit`
- `/admin/owner-controls`

### Technical routes

- `/sitemap.xml`
- not-found and root error boundaries

## Interaction and accessibility checklist

For every applicable route:

- all links, buttons, menus, tabs, sheets, dialogs, dropdowns, forms, retry actions, upload/remove/reorder controls;
- focus visibility and logical keyboard order;
- labels, names, roles, validation messages, live regions, disabled/busy states;
- minimum touch target and spacing between destructive/primary actions;
- Arabic RTL and English LTR icon direction and horizontal-scroll behavior;
- 200% text scaling and long Arabic content;
- reduced motion;
- safe-area and software-keyboard behavior;
- image aspect ratio, object positioning, fallback, loading, error, and skeleton states;
- loading, empty, error, partial-data, success, offline, and retry states;
- no horizontal page overflow at target widths.

## Fix order after audit closure

1. CSS ownership/import cleanup and removal of broad recovery selectors.
2. App shell, footer, dock reserve, safe areas, typography, and semantic surfaces.
3. Home advertisement placement and image handling.
4. Categories discovery feed.
5. My Listings and draft/edit journey.
6. Add/edit listing studio.
7. Account/More/Profile surfaces.
8. Admin shell/navigation/dashboard, then all admin modules.
9. Remaining public, trust, offers, seller, communication, and state polish.
10. Rendered visual/accessibility regression gates and final authenticated Production review.

## Validation rule

No item may be marked complete based only on build, typecheck, HTTP status, or screenshot creation. Completion requires rendered inspection at the target viewports, functional interaction checks, and evidence that no unrelated route regressed.
