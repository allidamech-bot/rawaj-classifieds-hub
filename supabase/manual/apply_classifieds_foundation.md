# RAWAJ classifieds foundation manual SQL step

This file is a human checklist only. Do not run Supabase CLI for this project
step, and do not run SQL from Lovable Cloud.

## Required manual step

1. Open Supabase Dashboard for the RAWAJ project.
2. Open SQL Editor.
3. Review and copy the full contents of:
   `supabase/migrations/202606290002_classifieds_foundation.sql`
4. Run it manually in SQL Editor.
5. Confirm the following tables exist after execution:
   `categories`, `governorates`, `listings`, `listing_images`,
   `favorites`, `saved_searches`, `listing_reports`.
6. Confirm RLS is enabled on all new tables.

## Guardrails

- Supabase remains the only backend source of truth.
- No service role key belongs in frontend code or public Lovable secrets.
- Owner/admin access must come from `public.user_roles`, not email checks.
- Listing image upload/storage still requires a separate Supabase Storage policy
  review before any real upload UI is enabled.
- Existing mock/admin demo pages should stay clearly labeled until their actions
  are connected to real Supabase-backed workflows.
