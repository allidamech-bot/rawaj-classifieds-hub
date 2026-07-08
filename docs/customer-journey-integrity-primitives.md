# Customer Journey Integrity primitives

This batch adds reusable foundations without changing canonical taxonomy, auth, or public listing visibility.

## Draft recovery

- Recover only the current user's latest `draft` listing.
- Do not treat `rejected` listings as drafts.
- Expose the last persisted save timestamp from `updated_at`.
- Discard only when `id + owner_id + status=draft` still match.

## Favorite snapshots

- Preserve a private per-user listing snapshot outside the listing foreign-key lifecycle.
- Backfill existing favorites.
- Keep public listing hydration approved-only.
- Return an explicit `available | unavailable` journey state with a meaningful title/price snapshot.

## Deep-link target resolution

- A requested conversation ID must resolve to that exact conversation.
- A missing requested conversation must return an explicit `missing` state.
- Only requests without a conversation ID may default to the first conversation.

## Listing lifecycle UI helpers

- Centralize closed/reactivatable status predicates.
- Centralize Arabic/English labels for sold, rented, unavailable, expired, and archived states.
