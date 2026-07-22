# RAWAJ public data provider cutover

Public marketplace reads are selected explicitly at build time.

## Configuration

Supabase remains selected until the verified Cloudflare import is complete:

```env
VITE_PUBLIC_DATA_PROVIDER=supabase
```

The Cloudflare read model is selected only for a reviewed Preview deployment:

```env
VITE_PUBLIC_DATA_PROVIDER=cloudflare
VITE_PUBLIC_DATA_API_BASE_URL=https://<rawaj-public-api-host>
```

`VITE_PUBLIC_DATA_API_BASE_URL` must be an absolute HTTPS URL. HTTP is accepted only for localhost development.

## Invariants

- There is no automatic fallback from Cloudflare to Supabase.
- A failed Cloudflare request remains visible as a Cloudflare failure.
- Public API requests never send browser credentials or Supabase sessions.
- Account, moderation, messaging, and write operations remain on their explicitly selected write provider until their own cutover phase.
- Production is not switched by merging code alone; the provider environment variable is the cutover control.

## Public surfaces currently behind the provider boundary

- categories, subcategories, governorates, and taxonomy nodes;
- active advertisement placements;
- public listing search and pagination;
- public listing detail;
- public listing media.

Advanced dynamic filters that do not yet have verified D1 parity return an explicit `setup_required` result. They are never silently ignored.
