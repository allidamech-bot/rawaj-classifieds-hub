# RAWAJ Visual Foundation Baseline

## Baseline

- Repository: `allidamech-bot/rawaj-classifieds-hub`
- Protected base branch: `main`
- Baseline commit: `93181ed500c87e7024e0a98f278a88ca74def96b`
- Working branch: `feature/visual-foundation-phase0`

This document is the Phase 0 contract for the redesign. It records what is protected before visual implementation starts and prevents UI work from silently changing data behavior.

## Protected contracts

Visual-foundation work must not change any of the following unless a separate, explicitly scoped engineering change proves it necessary:

- the retired backend schema.
- Database migrations.
- RLS policies.
- RPC signatures or authorization behavior.
- Listing create/edit/delete contracts.
- Listing visibility rules.
- Conversation start/reuse eligibility.
- Notification persistence or deep-link contracts.
- Taxonomy identifiers or drill-down semantics.
- Canonical Syria location identifiers, hierarchy, ordering, aliases, or listing references.
- Public/private profile field boundaries.
- Storage bucket access or signed-image URL behavior.
- Existing listing/category URLs, SSR, SEO metadata, or Android wrapper contracts.

## Baseline findings

### Existing strengths to preserve

- A coherent quiet-luxury palette already exists in `src/styles.css`.
- Brand semantic colors already distinguish navy, orange, gold, trust, warning, and destructive states.
- RTL/LTR document direction is already handled centrally.
- `prefers-reduced-motion` is already respected globally.
- Focus-visible treatment already exists.
- Mobile navigation visibility is centralized in `src/lib/primary-navigation.ts`.
- Listing detail already gates phone and WhatsApp actions through seller contact preferences.

### Confirmed visual debt

- Radius values are repeated as one-off arbitrary values across functional surfaces.
- Shadow recipes are repeated inside components in addition to shared utilities.
- Some functional UI combines gold and orange gradients where one accent is sufficient.
- `BottomNav` uses an elevated central action, decorative dot, decorative gold line, gradient active indicator, and a strong custom shadow simultaneously.
- Shared shadcn primitives still use generic defaults that do not yet express the RAWAJ visual contract consistently.
- Root mobile bottom spacing is a fixed Tailwind value rather than a navigation/safe-area contract.
- Listing detail has a fixed contact action bar while the primary bottom navigation is also eligible to render, creating competing bottom actions.

## Phase 0 decisions

1. Preserve the current semantic color palette; do not repaint the application during foundation work.
2. Introduce explicit foundation tokens for spacing, radii, shadows, motion, touch target, and mobile navigation offset.
3. Migrate shared chrome first: root layout, page header, bottom navigation.
4. Avoid broad page-by-page restyling until shared primitives and chrome settle.
5. Keep every database and domain contract outside this PR.
6. Treat listing detail as an action-bar page: hide primary bottom navigation there and anchor its contact bar to the safe area.

## Initial token contract

### Spacing

`4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48`

### Radius

- Input: 14px.
- Button: 15px.
- Card: 16px.
- Large surface: 20px.
- Pill: status/filter semantics only.

### Shadows

- None.
- Soft.
- Overlay.

### Interaction

- Minimum touch target: 44px.
- Fast motion: 140ms.
- Base motion: 180ms.
- Reduced motion remains globally respected.

## Acceptance boundary for this first batch

The batch is acceptable only if:

- No the retired backend or migration file changes.
- No API/domain contract changes.
- No route URL changes.
- Bottom navigation no longer competes with listing-detail contact actions.
- Mobile safe-area spacing remains explicit.
- Header and bottom navigation become visually calmer without removing destinations or notification counts.
- Existing Arabic/English labels and RTL/LTR behavior remain intact.
