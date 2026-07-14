import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../supabase/migrations/202607140001_owner_listing_stale_write_protection.sql",
    import.meta.url,
  ),
  "utf8",
);
const rpcSource = await readFile(
  new URL("../src/lib/api/listing-write-rpc.ts", import.meta.url),
  "utf8",
);
const guardedWriteSource = await readFile(
  new URL("../src/lib/api/listing-owner-write-guarded.ts", import.meta.url),
  "utf8",
);
const guardedReadSource = await readFile(
  new URL("../src/lib/api/listing-owner-read-guarded.ts", import.meta.url),
  "utf8",
);
const apiBarrelSource = await readFile(
  new URL("../src/lib/classifieds-api.ts", import.meta.url),
  "utf8",
);

test(
  "database owner update boundary locks and compares the expected listing version",
  () => {
    assert.match(migration, /rawaj_owner_update_listing_v3/);
    assert.match(migration, /p_expected_updated_at timestamptz/);
    assert.match(migration, /for update;/);
    assert.match(
      migration,
      /v_current_updated_at is distinct from p_expected_updated_at/,
    );
    assert.match(migration, /raise exception 'stale_owner_update'/);
    assert.match(migration, /grant execute[\s\S]*to authenticated/);
  },
);

test(
  "client owner update sends the remembered updated_at version to v3",
  () => {
    assert.match(rpcSource, /buildOwnerUpdateRpcArgsV3/);
    assert.match(rpcSource, /rawaj_owner_update_listing_v3/);
    assert.match(rpcSource, /expectedUpdatedAt/);
    assert.match(rpcSource, /isStaleOwnerUpdateError/);
    assert.match(guardedWriteSource, /readOwnerListingVersion/);
    assert.match(
      guardedWriteSource,
      /updateOwnerListingBase[\s\S]*expectedUpdatedAt/,
    );
  },
);

test("owner reads and successful writes refresh the version snapshot", () => {
  assert.match(guardedReadSource, /rememberOwnerListingVersion/);
  assert.match(
    guardedWriteSource,
    /if \(result\.ok\) rememberOwnerListingVersion/,
  );
  assert.match(
    apiBarrelSource,
    /fetchOwnerListingDetail.*listing-owner-read-guarded/,
  );
  assert.match(
    apiBarrelSource,
    /submitOwnerListingForReview,[\s\S]*updateOwnerListing,[\s\S]*listing-owner-write-guarded/,
  );
});
