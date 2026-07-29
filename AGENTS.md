<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, rebasing, amending, or squashing commits
> that are already pushed can desynchronize the project history.
>
> Commits pushed to a connected branch sync back to Lovable, so every pushed
> branch must remain buildable and reviewable.
<!-- LOVABLE:END -->

## RAWAJ Runtime Architecture

The only approved runtime architecture is:

- Firebase Authentication for email/password, Google sign-in, sessions, and user identity.
- Cloudflare Worker for every application API and authorization decision.
- Cloudflare D1 for all relational application data.
- Cloudflare R2 for all uploaded media and private documents.

The retired backend is not an allowed runtime, fallback, migration target, or
operational dependency. Do not add its SDK, environment variables, hosts,
workflows, functions, database clients, storage clients, realtime clients, or
compatibility modules back into the repository.

Lovable is a UI/code-generation environment only. Do not create Lovable Cloud
application databases, authentication, storage, or generated backend clients.

## Data and Migration Integrity

- D1 schema changes must use additive, numbered migrations.
- Never edit, reorder, rename, or replace a migration that may already have been applied.
- Apply and validate migrations locally before any remote action.
- Production migrations require explicit user approval and must be separate from deployment.
- Preserve stable identifiers and ownership relationships. Never map records by titles,
  array positions, or guesses when a stable identifier exists.
- R2 writes must preserve ownership, safe object keys, metadata consistency, and cleanup
  behavior when a database write fails.
- Do not create silent dual writes, implicit fallbacks, or provider switches.

## Authentication and Authorization

- Verify Firebase ID tokens in the Worker for protected requests.
- Derive the acting user, owner IDs, roles, timestamps, moderation state, and privileged
  fields on the server.
- Enforce owner/admin permissions in the Worker, not through frontend email checks or
  untrusted client role state.
- Do not weaken CSRF protection, rate limiting, session handling, ownership checks,
  moderation boundaries, or private media access.
- Demo, mock, future, and unavailable labels must remain visible until the behavior is
  backed by a working server implementation.

## Local Work and Deployment Safety

- Work on `feature/cloudflare-full-backend-cutover` remains local unless the user explicitly
  authorizes a push.
- Do not push, merge to `main`, deploy, promote, run remote migrations, change traffic,
  modify bindings, or change Cloudflare/Vercel/Lovable/DNS/secrets without explicit approval.
- Preserve unrelated working-tree changes and untracked files.
- Never print or commit secrets.
- Before a commit or delivery, run the runtime-boundary audit, Cloudflare contract tests,
  D1 migration replay, authorization tests, application typecheck, Worker typecheck, and build.
