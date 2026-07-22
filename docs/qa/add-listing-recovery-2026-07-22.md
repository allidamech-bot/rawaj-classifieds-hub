# Add listing recovery — 2026-07-22

Scope: restore the mobile add-listing journey before continuing broader interaction QA.

## Confirmed issues addressed

- Back button did not reliably return to the previous listing step.
- Action bar buttons had no explicit non-submit normalization.
- The add-listing hero used dark green surfaces with low-contrast green text after later visual overrides.
- Mobile progress steps could overlap or clip at 360–412px.
- Sticky action buttons could compress unpredictably above the bottom navigation.

## Recovery changes

- Added an explicit previous-step interaction guard scoped to Listing Studio.
- Normalized action-bar buttons to `type="button"`.
- Restored a light ivory/mint/peach hero with dark readable text.
- Rebuilt mobile progress steps as a four-column bounded grid.
- Stabilized the action bar as a two-column mobile control surface above the safe area.
- Added contract coverage for navigation, contrast, overlap prevention, and loading order.

## Safety boundary

No Supabase, database, migration, API, authentication, permission, moderation, or Android configuration changes were made.
