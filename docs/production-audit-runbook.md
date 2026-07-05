# RAWAJ production audit runbook

RAWAJ uses Supabase as the only real backend source of truth. Lovable may be
used for UI/code/publishing, but not for production auth, database, storage,
payments, messages, roles, listings, or admin actions.

## Required frontend environment

The app will show an Arabic setup-required state until these browser-public
values are provided to the Vite/Lovable/GitHub build runtime:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

These are public Supabase client values. Do not add service-role or database
secrets to frontend env files.

Never expose:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_SERVICE`
- `DATABASE_URL`
- `POSTGRES_PASSWORD`
- `JWT_SECRET`

## Applied manually in Supabase

The project expects these foundations to already exist in Supabase:

- Auth/profile/role tables: `profiles`, `user_roles`, `audit_logs`
- Classifieds tables: `categories`, `governorates`, `listings`,
  `listing_images`, `favorites`, `saved_searches`, `listing_reports`
- Storage bucket: `listing-images`, configured as private
- Scoped storage policies for owner access and canonical moderator/owner privileges
- Public object reads, where required by the current client flow, restricted to
  objects whose path resolves to an approved, non-archived listing

The application uses short-lived signed listing-image URLs. Do not restore a
bucket-wide public SELECT policy and do not configure `listing-images` with
`public = true`.

Repository migration intent and live-verification status are tracked in
`docs/database-migration-status.md`. Repository file order alone is not evidence
that a migration was applied to a live environment.

Manual SQL files live under:

- `supabase/migrations/`
- `supabase/manual/`

Agents must not execute SQL or run Supabase CLI. Review and run SQL manually
from Supabase Dashboard SQL Editor only.

Legacy/deprecated manual SQL must not be executed. In particular,
`supabase/manual/setup_listing_images_storage.sql` is retained only as a
non-executable deprecation notice; ordered reconciliation belongs under
`supabase/migrations/`.

The historical checklist at `supabase/manual/apply_classifieds_foundation.md`
references a superseded UUID-based foundation and is not a current execution
source. See `docs/database-migration-status.md` before any schema work.

## Verification checklist

1. Public pages render without blank screens.
2. `/login` shows the login form when env values are present.
3. Owner account can sign in and `/admin` reads role access from `public.user_roles`.
4. `/listings` shows approved rows from Supabase only.
5. `/add-listing` creates `pending_review` listings for signed-in active users.
6. Image upload stores files under `listing-images/{user_id}/{listing_id}/...`.
7. Anonymous users cannot read draft, pending-review, rejected, or archived listing objects.
8. Approved, non-archived listing images render through the current client delivery flow.
9. `/profile` shows only the signed-in user's own listings.
10. `/admin/pending` approves/rejects listings only for canonical moderation roles.
11. `/admin/reports` moderates reports only for canonical moderation roles.

## Still demo or future

- Homepage/category promotional cards still include clearly labeled demo/exploration data.
- Seller profile public schema is not production-complete yet.
- Messages, payments, promotion payment proof, user freezing/deletion, and real seller verification
  remain future/admin-demo areas.
- Admin audit-log writes for listing/report moderation should be connected in a later backend pass.

## Backend work intentionally postponed

This frontend stabilization batch freezes backend/Supabase changes temporarily. The next backend pass should
handle production deploy env wiring, final listing lifecycle QA, real signup/onboarding, public seller profile
fields, messaging, notifications, promotion/payment review, and production support workflows.

See `docs/frontend-route-completion.md` for the frontend route map, user-flow checklist, and coming-soon boundaries.
