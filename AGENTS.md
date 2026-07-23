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

## RAWAJ Backend Architecture and Migration Authority

The approved target runtime backend for RAWAJ is:

- Cloudflare Worker for application APIs.
- Cloudflare D1 for application relational data.
- Cloudflare R2 for application media and file storage.
- The Cloudflare session and authentication implementation for migrated
  authentication flows.

Supabase is no longer the target runtime backend. During the migration period,
Supabase may remain only as:

- a legacy source of truth for data that has not yet been migrated;
- a read-only source for explicit local or server-side migration tooling;
- a compatibility path for features that are explicitly documented as not yet
  migrated; and
- a historical schema and migration reference.

When Cloudflare mode is active, Supabase must never be used as a silent fallback
or silent dual-write target.

These instructions explicitly authorize
`feature/cloudflare-full-backend-cutover` and related migration branches to
continue the complete backend cutover to Cloudflare Worker, D1, R2, and
Cloudflare authentication. New backend functionality on those branches must
target the approved Cloudflare architecture. Features already migrated to
Cloudflare must not be moved back to Supabase.

Lovable may be used as a UI/code-generation/publishing environment only. Do not
create Lovable Cloud database tables, authentication, storage, generated backend
clients, or application data services for RAWAJ.

## Migration and Data Integrity Rules

- Remove Supabase runtime use incrementally, only after each feature and its
  data have been migrated and validated end to end.
- Do not delete legacy Supabase code blindly while an explicitly non-migrated
  feature still depends on it.
- Legacy Supabase data may be read by explicit local or server-side migration
  tooling. Such tooling must be local-safe by default, idempotent, resumable
  where practical, dry-run capable, non-destructive to the source, and explicit
  about its source and target.
- Never hardcode a Supabase service-role key or expose it in frontend code,
  public environment variables, Lovable public secrets, client-side bundles,
  logs, or committed configuration. Privileged source credentials are for
  local/server-side migration tooling only.
- Do not introduce silent dual writes or silent provider fallback. Any temporary
  compatibility path must be explicitly approved, scoped, and documented.
- D1 schema changes must use additive, numbered migrations. Never rewrite a
  migration that may already have been applied.
- Apply and validate D1 migrations locally first. Production migrations,
  deployments, and external configuration changes require explicit user
  approval.
- R2 object ownership, generated object-key safety, and consistency between R2
  objects and D1 media metadata must be preserved. Migration and mutation
  failures must not leave avoidable orphaned objects or records.
- Preserve stable legacy identifiers for ownership and data mapping. Do not map
  records using titles, array positions, or generated guesses when a stable
  source identifier exists.

## Security and Authorization

- Authentication, password hashing, session cookies, CSRF protection, rate
  limiting, ownership checks, role authorization, and moderation boundaries
  must not be weakened during migration.
- User IDs, owner IDs, roles, administrative fields, timestamps, and moderation
  state must be derived or controlled by the server where applicable.
- Owner and admin access must be enforced by the active backend, not by frontend
  email checks or untrusted frontend role state.
- Keep mock, future, and demo labels visible until behavior is genuinely backed
  by the active backend and its server-side authorization rules.

## Local Work and Validation

- Work on `feature/cloudflare-full-backend-cutover` remains local unless the user
  explicitly authorizes a push or deployment.
- Do not push to or merge into `main` without explicit user approval.
- Do not deploy, modify Production, or change external Cloudflare, Vercel,
  Lovable, DNS, domain, secret, or environment configuration without explicit
  user approval.
- Preserve unrelated working-tree changes and exclude them from scoped commits.
- Before committing migration work, run the relevant typechecks, tests, builds,
  local migration validation, and security/ownership checks.
- Do not execute destructive source migrations or modify legacy Supabase data
  without explicit approval. Source-system access for migration is read-only by
  default.
