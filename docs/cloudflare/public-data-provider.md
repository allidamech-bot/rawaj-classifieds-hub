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

## Listing search parity

The D1 listing reader supports the existing public filter contract, including:

- taxonomy node assignments and legacy taxonomy scopes;
- canonical location descendants through a recursive CTE;
- category, subcategory, governorate, district, price and condition filters;
- vehicles: make, model, year, fuel and transmission;
- real estate: purpose, property type, rooms and rental duration;
- electronics brand and detail condition;
- jobs employment and salary types;
- full-text search, photo presence, sort modes and cursor pagination.

All dynamic values are passed as bound D1 parameters. Filter values are not interpolated into SQL.
