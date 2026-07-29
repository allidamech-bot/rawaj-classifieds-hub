# RAWAJ bilingual and theme foundation

This document tracks the frontend-only language and theme foundation for RAWAJ.

## Language

- Supported languages: Arabic (`ar`) and English (`en`).
- Default language: Arabic.
- Persistence key: `rawaj-language` in `localStorage`.
- Runtime hook: `useUiPreferences()` from `src/lib/ui-preferences.tsx`.
- Direction behavior:
  - Arabic sets `lang="ar"` and `dir="rtl"`.
  - English sets `lang="en"` and `dir="ltr"`.
- The provider updates `document.documentElement`, `document.body`, and stores the choice locally.
- Route paths are not localized.

## Theme

- Supported themes: `light` and `dark`.
- Default theme: light.
- Persistence key: `rawaj-theme` in `localStorage`.
- Theme is applied with the `dark` class and `data-theme` on the root HTML element.
- Dark mode is token-based through `src/styles.css`, covering backgrounds, cards, muted surfaces, borders, primary CTAs, warning surfaces, inputs, header, footer, and bottom navigation.

## Controls

- The language switcher and theme toggle live in the global app header.
- Mobile bottom navigation and footer labels consume the same language foundation.

## Route Coverage

The foundation pass covers visible UI copy and state boundaries across:

- Home, categories, listings, listing details.
- Add listing, login, profile.
- Chats and promotion demo/future surfaces.
- Safety, support, prohibited, terms, and privacy.

The follow-up hardening pass completed remaining route-level polish for:

- Favorites and saved searches, including auth-required, auth-unavailable, loading, error, empty, and CTA states.
- Seller profile route, including not-found/error states, demo seller boundaries, disabled contact actions, safety note, and active listing section labels.
- Admin shell, owner overview, pending listings, reports, users, and promotions pages, limited to display text, badges, helper text, disabled action labels, and demo/readiness warnings.

Listing/user data from the retired backend or mock records remains data-driven and is not rewritten as fake translated production content. Demo, future, and beta labels remain visible in Arabic and English.

## Known Gaps

- Some user/listing names, free-form listing titles, user-entered report reasons, and mock/demo entity names remain data strings rather than translated UI copy.
- Browser screenshot QA was not run in this pass; validation was code/build based.

## Intentionally Not Changed

- No the retired backend SQL, schema changes, migrations, CLI actions, or backend features.
- No Lovable Cloud backend/auth/database/storage.
- No service role keys or private secrets in frontend code.
- No admin permission changes, owner checks, role logic changes, or RLS assumption changes.
- No route renames.
- No messaging, payment, notifications, ticket submission, moderation execution, or admin destructive actions.
- No backend/the retired backend/auth/schema/env/admin permission behavior was touched in the hardening pass.

## Validation

Suggested validation commands:

```bash
npm run typecheck
npm run lint
npm run build
```

Hardening pass validation run:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
