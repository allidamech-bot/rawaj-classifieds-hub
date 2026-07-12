import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { renderDemoPng } from "./demo-media-renderer.mjs";

const manifestUrl = new URL("../supabase/demo-data/demo-media-manifest.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const listingIds = manifest.listings.map((listing) => listing.id);
const { data: listings, error: listingError } = await client
  .from("listings")
  .select("id, details")
  .in("id", listingIds);

if (listingError) throw listingError;
if ((listings ?? []).length !== listingIds.length) {
  throw new Error(`Expected ${listingIds.length} seeded listings, found ${(listings ?? []).length}. Run the listing seed first.`);
}
for (const listing of listings) {
  const marker = listing.details?._rawaj_seed;
  if (marker?.batch !== manifest.batch || marker?.kind !== "launch_demo" || marker?.removable !== true) {
    throw new Error(`Listing ${listing.id} is not a removable ${manifest.batch} demo listing.`);
  }
}

const rows = [];
for (let listingIndex = 0; listingIndex < manifest.listings.length; listingIndex += 1) {
  const listing = manifest.listings[listingIndex];
  for (let sortOrder = 0; sortOrder < listing.count; sortOrder += 1) {
    const suffix = String(sortOrder + 1).padStart(2, "0");
    const storagePath = `${manifest.batch}/${listing.category}/${listing.slug}/${suffix}.png`;
    const buffer = renderDemoPng({
      category: listing.category,
      kind: listing.kind,
      variant: sortOrder,
      width: manifest.width,
      height: manifest.height,
    });
    const { error: uploadError } = await client.storage
      .from(manifest.bucket)
      .upload(storagePath, buffer, { contentType: "image/png", upsert: true, cacheControl: "31536000" });
    if (uploadError) throw new Error(`Upload failed for ${storagePath}: ${uploadError.message}`);

    const imageNumber = listingIndex * 10 + sortOrder + 1;
    rows.push({
      id: `da200001-0000-4000-8000-${String(imageNumber).padStart(12, "0")}`,
      listing_id: listing.id,
      storage_path: storagePath,
      alt_ar: `${listing.altAr} — صورة ${sortOrder + 1}`,
      sort_order: sortOrder,
    });
  }
}

const paths = rows.map((row) => row.storage_path);
const { error: deleteError } = await client.from("listing_images").delete().in("storage_path", paths);
if (deleteError) throw deleteError;
const { error: insertError } = await client.from("listing_images").insert(rows);
if (insertError) throw insertError;

console.log(`RAWAJ demo media complete: ${rows.length} images linked to ${listingIds.length} listings.`);
