# RAWAJ bilingual and theme foundation

This pass adds a frontend-only language and theme foundation for RAWAJ.

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

The pass covers visible UI copy and state boundaries across:

- Home, categories, listings, listing details.
- Add listing, login, profile.
- Chats and promotion demo/future surfaces.
- Safety, support, prohibited, terms, and privacy.

Listing/user data from Supabase or mock records remains data-driven and is not rewritten as fake translated production content. Demo, future, and beta labels remain visible in Arabic and English.

## Intentionally Not Changed

- No Supabase SQL, schema changes, migrations, CLI actions, or backend features.
- No Lovable Cloud backend/auth/database/storage.
- No service role keys or private secrets in frontend code.
- No admin permission changes, owner checks, role logic changes, or RLS assumption changes.
- No route renames.
- No messaging, payment, notifications, ticket submission, moderation execution, or admin destructive actions.

## Validation

Suggested validation commands:

```bash
npm run typecheck
npm run lint
npm run build
```
