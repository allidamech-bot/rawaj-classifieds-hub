# RAWAJ Demo Media Pack V1

This pack generates and uploads 55 deterministic premium PNG illustrations for all 26 listings in `launch-catalog-v1`.

## Apply

Run the listing seed first, then provide server-side credentials and execute:

```bash
SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." node scripts/apply-demo-media-pack.mjs
```

The operation is idempotent: storage uploads use `upsert`, image rows are replaced only for the exact manifest paths, and every target listing must carry the removable launch-demo marker.

## Remove

```bash
SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." node scripts/remove-demo-media-pack.mjs
```

This removes only manifest-owned `listing_images` rows and Storage objects below `launch-catalog-v1/`. It does not delete customer media.

## Validation

```bash
node --test scripts/demo-listings-media-pack.test.mjs
```

The contract verifies 26 covered listings, 55 unique paths, valid PNG rendering, batch isolation, and paired apply/cleanup behavior.
