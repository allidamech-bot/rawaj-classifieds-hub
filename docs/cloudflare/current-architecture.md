# RAWAJ current architecture

## Runtime boundary

- Firebase Authentication owns user sign-in and identity tokens.
- Cloudflare Worker owns APIs, authorization, validation, moderation, and operational controls.
- D1 owns relational application state.
- R2 owns public and private media objects.

The frontend never connects directly to a database or object store. Protected requests include
a Firebase ID token, which the Worker verifies before deriving the acting user and permissions.

## Route boundary

Every supported API route is registered explicitly. Unknown routes return `404`; there is no
broad fallback handler. Public and protected routes share centralized CORS, error envelopes,
request IDs, and security checks.

## Data changes

D1 changes are additive numbered migrations. Local replay must succeed from an empty database
before any remote migration is considered. Remote migration and deployment are separate actions.

## Media changes

Uploads are validated for ownership, content type, size, and object-key safety. Private objects
are served only after Worker authorization. Database and R2 cleanup paths avoid orphaned objects.

## Operational safety

Production deployment, traffic changes, remote migrations, bindings, secrets, and external
configuration require explicit approval. Local checks never deploy.
