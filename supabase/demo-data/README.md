# RAWAJ launch demo listings

This directory contains removable operational demo data. It is intentionally outside `supabase/migrations` so it is never applied automatically as schema history.

## Batch

- Batch ID: `launch-catalog-v1`
- Listings: 26
- Coverage: all 13 top-level marketplace categories
- Owner: the active owner/admin account matching `allidamech@gmail.com`
- Public state: approved
- Contact path: in-app messaging only

Every row carries this private marker inside `listings.details`:

```json
{
  "_rawaj_seed": {
    "batch": "launch-catalog-v1",
    "kind": "launch_demo",
    "removable": true
  }
}
```

The UI does not display this marker. It exists only for safe operational control.

## Install

1. Open Supabase SQL Editor for the intended project.
2. Review `seed_launch_demo_listings.sql`, especially `v_owner_email`.
3. Run the complete file once.
4. Confirm the final result returns exactly 26 rows.
5. Check the public home, listings results, category filters, seller page, and listing detail page.

The seed is idempotent. Re-running it updates only the deterministic rows belonging to this batch and does not duplicate them.

## Remove

Run `remove_launch_demo_listings.sql` as one complete statement. It deletes only rows matching all three controls: batch, kind, and removable flag. Foreign-key cascades clean dependent rows associated with those listings.

After removal, the final query must return `0`.

## Safety rules

- Never move these files into `supabase/migrations`.
- Never remove the `_rawaj_seed` marker from a seeded row.
- Never assign a real customer's listing one of the reserved IDs beginning with `da100001-`.
- Do not mix real customer data into this batch.
- Images are deliberately not seeded through SQL because `listing-images` is a private Storage bucket. Add media only through a separate controlled Storage operation, preserving the same batch ownership and cleanup plan.
