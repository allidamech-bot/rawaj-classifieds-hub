<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## RAWAJ Backend Source of Truth

RAWAJ backend source of truth is Supabase only.

Future coding agents must not use Lovable Cloud for the app database, auth,
storage, user roles, listings, messages, payments, notifications, audit logs, or
admin actions. Lovable may be used only as a UI/code-generation/publishing
environment.

Do not create Lovable Cloud tables, Cloud auth, Cloud storage, generated backend
clients, or any other backend provider for RAWAJ.

Supabase SQL must remain manual-only: agents must not execute SQL, run
migrations against a live project, or place SQL execution inside Lovable. The
project owner must review and execute Supabase SQL manually from the Supabase
Dashboard / SQL Editor.

Never place a Supabase service role key in frontend code, public environment
variables, Lovable public secrets, or client-side bundles. Frontend code may use
only the public Supabase URL and anon key.

Owner/admin access must come from Supabase role tables and RLS-protected data,
not frontend email checks. Keep mock/future/demo labels visible until behavior
is genuinely backed by Supabase auth, database, RLS, and audited server-side
rules.
