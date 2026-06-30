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
- Storage bucket: `listing-images`
- Storage policies for public image read and authenticated owner upload/update/delete

Manual SQL files live under:

- `supabase/migrations/`
- `supabase/manual/`

Agents must not execute SQL or run Supabase CLI. Review and run SQL manually
from Supabase Dashboard SQL Editor only.

## Verification checklist

1. Public pages render without blank screens.
2. `/login` shows the login form when env values are present.
3. Owner account can sign in and `/admin` reads role access from `public.user_roles`.
4. `/listings` shows approved rows from Supabase only.
5. `/add-listing` creates `pending_review` listings for signed-in active users.
6. Image upload stores files under `listing-images/{user_id}/{listing_id}/...`.
7. `/profile` shows only the signed-in user's own listings.
8. `/admin/pending` approves/rejects listings only for owner access.
9. `/admin/reports` moderates reports only for owner access.

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
