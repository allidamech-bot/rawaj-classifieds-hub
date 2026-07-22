#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import postgres from "postgres";

const databaseUrl = process.env.SUPABASE_DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("SUPABASE_DATABASE_URL is required.");
  process.exit(1);
}

const outputDir = resolve(
  process.cwd(),
  process.env.RAWAJ_SNAPSHOT_DIR?.trim() || "cloudflare/snapshots/latest",
);
await mkdir(outputDir, { recursive: true });

const snapshotAt = new Date().toISOString();
const batchId = `supabase-${snapshotAt.replace(/[-:.TZ]/g, "")}-${randomUUID().slice(0, 8)}`;
const sql = postgres(databaseUrl, {
  max: 1,
  ssl: "require",
  idle_timeout: 20,
  connect_timeout: 20,
  prepare: false,
});

const connection = await sql.reserve();
const tables = {};
try {
  await connection.unsafe("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");

  tables.categories = await connection`
    SELECT id, slug, name_ar, name_en, hint_ar, hint_en, placeholder,
           sort_order, is_active, created_at, updated_at
      FROM public.categories ORDER BY sort_order, id`;
  tables.subcategories = await connection`
    SELECT id, category_id, name_ar, name_en, sort_order, created_at, updated_at
      FROM public.subcategories ORDER BY category_id, sort_order, id`;
  tables.governorates = await connection`
    SELECT id, slug, name_ar, name_en, districts_ar, districts_en,
           sort_order, is_active, created_at, updated_at
      FROM public.governorates ORDER BY sort_order, id`;
  tables.taxonomy_nodes = await connection`
    SELECT id, parent_id, slug, name_ar, name_en, description_ar, description_en,
           icon_key, sort_order, depth, is_active, is_leaf, filter_schema_key,
           classification_key, classification_value, legacy_category_id,
           legacy_subcategory_id, created_at, updated_at
      FROM public.taxonomy_nodes ORDER BY depth, sort_order, id`;
  tables.option_sets = await connection`
    SELECT key, name_ar, name_en, description_ar, description_en, provider_key,
           is_active, created_at, updated_at
      FROM public.option_sets ORDER BY key`;
  tables.field_definitions = await connection`
    SELECT key, label_ar, label_en, description_ar, description_en,
           placeholder_ar, placeholder_en, field_type, unit_key, option_set_key,
           data_provider_key, validation_schema, is_searchable, is_filterable,
           is_displayable, is_sensitive, is_active, sort_order, created_at, updated_at
      FROM public.field_definitions ORDER BY sort_order, key`;
  tables.option_values = await connection`
    SELECT option_set_key, value_key, label_ar, label_en, aliases, sort_order,
           is_active, metadata, created_at, updated_at
      FROM public.option_values ORDER BY option_set_key, sort_order, value_key`;
  tables.vehicle_makes = await connection`
    SELECT id, slug, name_ar, name_en, aliases, country_code, sort_order,
           is_active, metadata, created_at, updated_at
      FROM public.vehicle_makes ORDER BY sort_order, id`;
  tables.vehicle_models = await connection`
    SELECT id, make_id, slug, name_ar, name_en, aliases, vehicle_type,
           start_year, end_year, sort_order, is_active, metadata, created_at, updated_at
      FROM public.vehicle_models ORDER BY make_id, sort_order, id`;
  tables.vehicle_generations = await connection`
    SELECT id, model_id, slug, name_ar, name_en, aliases, start_year, end_year,
           sort_order, is_active, metadata, created_at, updated_at
      FROM public.vehicle_generations ORDER BY model_id, sort_order, id`;
  tables.vehicle_trims = await connection`
    SELECT id, model_id, generation_id, slug, name_ar, name_en, aliases,
           start_year, end_year, sort_order, is_active, metadata, created_at, updated_at
      FROM public.vehicle_trims ORDER BY model_id, sort_order, id`;
  tables.location_regions = await connection`
    SELECT id, country_code, slug, name_ar, name_en, region_type, is_complete,
           is_active, source_name, source_url, source_note, confidence,
           review_status, created_at, updated_at
      FROM public.location_regions ORDER BY country_code, slug`;
  tables.location_nodes = await connection`
    SELECT id, parent_id, country_code, node_type, name_ar, name_en, slug,
           official_code, external_source, external_id, latitude, longitude,
           sort_order, depth, is_active, search_aliases, legacy_governorate_id,
           legacy_district_ar, source_url, source_date, confidence, review_status,
           notes, created_at, updated_at
      FROM public.location_nodes ORDER BY depth, parent_id NULLS FIRST, sort_order, id`;
  tables.location_region_members = await connection`
    SELECT region_id, location_node_id, relation_type, source_name, source_url,
           source_note, confidence, review_status, created_at
      FROM public.location_region_members ORDER BY region_id, location_node_id`;
  tables.location_search_aliases = await connection`
    SELECT id, location_node_id, alias, normalized_alias, language_code, alias_type,
           source_name, source_url, source_note, confidence, review_status,
           created_at, updated_at
      FROM public.location_search_aliases ORDER BY normalized_alias, id`;
  tables.public_profiles = await connection`
    SELECT id, display_name, first_name, last_name, business_name, bio, governorate,
           city_area, verification_status::text AS verification_status,
           account_status::text AS account_status, avatar_path, avatar_url,
           cover_path, cover_url, created_at, updated_at
      FROM public.profiles ORDER BY id`;
  tables.listings = await connection`
    SELECT id, owner_id, category_id, subcategory_id, governorate_id,
           location_node_id, title, description, price, currency, price_type,
           listing_condition, status, district_ar, contact_name, contact_options,
           details, is_featured, featured_until, published_at, archived_at,
           reserved_at, expires_at, renewed_at, expiry_days,
           search_text_normalized, created_at, updated_at
      FROM public.listings ORDER BY created_at, id`;
  tables.listing_taxonomy_assignments = await connection`
    SELECT listing_id, taxonomy_node_id, created_at
      FROM public.listing_taxonomy_assignments ORDER BY listing_id, taxonomy_node_id`;
  tables.listing_images = await connection`
    SELECT li.id, li.listing_id, li.storage_path, li.alt_ar, li.sort_order,
           li.created_at, l.owner_id
      FROM public.listing_images li
      JOIN public.listings l ON l.id = li.listing_id
     ORDER BY li.listing_id, li.sort_order, li.id`;
  tables.ad_placements = await connection`
    SELECT id, name, placement_page, image_url, destination_url, starts_at, ends_at,
           status, priority, target_mobile, target_desktop, version,
           created_at, updated_at
      FROM public.ad_placements ORDER BY placement_page, priority DESC, id`;

  await connection.unsafe("COMMIT");
} catch (error) {
  await connection.unsafe("ROLLBACK").catch(() => {});
  throw error;
} finally {
  connection.release();
  await sql.end({ timeout: 5 });
}

const media = buildMediaManifest(tables);
const statements = [
  "PRAGMA foreign_keys = ON;",
  "BEGIN TRANSACTION;",
  insertStatement("rawaj_import_batches", {
    id: batchId,
    source_system: "supabase",
    source_snapshot_at: snapshotAt,
    source_checksum_sha256: "__SNAPSHOT_CHECKSUM__",
    status: "importing",
    counts_json: JSON.stringify(counts(tables)),
    started_at: snapshotAt,
  }),
];

const specs = {
  categories: ["id", "slug", "name_ar", "name_en", "hint_ar", "hint_en", "placeholder", "sort_order", "is_active", "created_at", "updated_at"],
  subcategories: ["id", "category_id", "name_ar", "name_en", "sort_order", "created_at", "updated_at"],
  governorates: ["id", "slug", "name_ar", "name_en", "districts_ar", "districts_en", "sort_order", "is_active", "created_at", "updated_at"],
  taxonomy_nodes: ["id", "parent_id", "slug", "name_ar", "name_en", "description_ar", "description_en", "icon_key", "sort_order", "depth", "is_active", "is_leaf", "filter_schema_key", "classification_key", "classification_value", "legacy_category_id", "legacy_subcategory_id", "created_at", "updated_at"],
  option_sets: ["key", "name_ar", "name_en", "description_ar", "description_en", "provider_key", "is_active", "created_at", "updated_at"],
  field_definitions: ["key", "label_ar", "label_en", "description_ar", "description_en", "placeholder_ar", "placeholder_en", "field_type", "unit_key", "option_set_key", "data_provider_key", "validation_schema", "is_searchable", "is_filterable", "is_displayable", "is_sensitive", "is_active", "sort_order", "created_at", "updated_at"],
  option_values: ["option_set_key", "value_key", "label_ar", "label_en", "aliases", "sort_order", "is_active", "metadata", "created_at", "updated_at"],
  vehicle_makes: ["id", "slug", "name_ar", "name_en", "aliases", "country_code", "sort_order", "is_active", "metadata", "created_at", "updated_at"],
  vehicle_models: ["id", "make_id", "slug", "name_ar", "name_en", "aliases", "vehicle_type", "start_year", "end_year", "sort_order", "is_active", "metadata", "created_at", "updated_at"],
  vehicle_generations: ["id", "model_id", "slug", "name_ar", "name_en", "aliases", "start_year", "end_year", "sort_order", "is_active", "metadata", "created_at", "updated_at"],
  vehicle_trims: ["id", "model_id", "generation_id", "slug", "name_ar", "name_en", "aliases", "start_year", "end_year", "sort_order", "is_active", "metadata", "created_at", "updated_at"],
  location_regions: ["id", "country_code", "slug", "name_ar", "name_en", "region_type", "is_complete", "is_active", "source_name", "source_url", "source_note", "confidence", "review_status", "created_at", "updated_at"],
  location_nodes: ["id", "parent_id", "country_code", "node_type", "name_ar", "name_en", "slug", "official_code", "external_source", "external_id", "latitude", "longitude", "sort_order", "depth", "is_active", "search_aliases", "legacy_governorate_id", "legacy_district_ar", "source_url", "source_date", "confidence", "review_status", "notes", "created_at", "updated_at"],
  location_region_members: ["region_id", "location_node_id", "relation_type", "source_name", "source_url", "source_note", "confidence", "review_status", "created_at"],
  location_search_aliases: ["id", "location_node_id", "alias", "normalized_alias", "language_code", "alias_type", "source_name", "source_url", "source_note", "confidence", "review_status", "created_at", "updated_at"],
};
for (const [table, columns] of Object.entries(specs)) appendTable(statements, table, tables[table], columns);

for (const asset of media.assets) statements.push(insertStatement("media_assets", { ...asset, imported_batch_id: batchId }));
for (const profile of tables.public_profiles) {
  statements.push(insertStatement("public_profiles", {
    id: profile.id,
    display_name: profile.display_name,
    first_name: profile.first_name,
    last_name: profile.last_name,
    business_name: profile.business_name,
    bio: profile.bio,
    governorate: profile.governorate,
    city_area: profile.city_area,
    verification_status: profile.verification_status,
    account_status: profile.account_status,
    avatar_asset_id: media.profileAssetIds.get(`${profile.id}:avatar`) ?? null,
    cover_asset_id: media.profileAssetIds.get(`${profile.id}:cover`) ?? null,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
    imported_batch_id: batchId,
  }));
}
for (const listing of tables.listings) {
  statements.push(insertStatement("listings", {
    ...pick(listing, ["id", "owner_id", "category_id", "subcategory_id", "governorate_id", "location_node_id", "title", "description", "price", "currency", "price_type", "listing_condition", "status", "district_ar", "contact_name", "contact_options", "details", "is_featured", "featured_until", "published_at", "archived_at", "reserved_at", "expires_at", "renewed_at", "expiry_days", "search_text_normalized", "created_at", "updated_at"]),
    imported_batch_id: batchId,
  }));
}
appendTable(statements, "listing_taxonomy_assignments", tables.listing_taxonomy_assignments, ["listing_id", "taxonomy_node_id", "created_at"]);
for (const image of tables.listing_images) {
  statements.push(insertStatement("listing_images", {
    id: image.id,
    listing_id: image.listing_id,
    media_asset_id: image.id,
    alt_ar: image.alt_ar,
    sort_order: image.sort_order,
    created_at: image.created_at,
  }));
}
for (const placement of tables.ad_placements) {
  statements.push(insertStatement("ad_placements", {
    id: placement.id,
    name: placement.name,
    placement_page: placement.placement_page,
    media_asset_id: `ad:${placement.id}`,
    destination_url: placement.destination_url,
    starts_at: placement.starts_at,
    ends_at: placement.ends_at,
    status: placement.status,
    priority: placement.priority,
    target_mobile: placement.target_mobile,
    target_desktop: placement.target_desktop,
    version: placement.version,
    created_at: placement.created_at,
    updated_at: placement.updated_at,
    imported_batch_id: batchId,
  }));
}
statements.push("COMMIT;");

let sqlText = `${statements.join("\n")}\n`;
const sourceChecksum = sha256(sqlText.replace("__SNAPSHOT_CHECKSUM__", ""));
sqlText = sqlText.replace("__SNAPSHOT_CHECKSUM__", sourceChecksum);
const finalChecksum = sha256(sqlText);
const manifest = {
  version: 1,
  batchId,
  source: "supabase",
  snapshotAt,
  sqlFile: "public-snapshot.sql",
  sqlSha256: finalChecksum,
  rowCounts: counts(tables),
  mediaCount: media.entries.length,
  destructive: false,
};

await Promise.all([
  writeFile(resolve(outputDir, "public-snapshot.sql"), sqlText, "utf8"),
  writeFile(resolve(outputDir, "media-manifest.json"), `${JSON.stringify({ version: 1, batchId, entries: media.entries }, null, 2)}\n`, "utf8"),
  writeFile(resolve(outputDir, "snapshot-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify(manifest, null, 2));

function buildMediaManifest(source) {
  const assets = [];
  const entries = [];
  const profileAssetIds = new Map();

  for (const image of source.listing_images) {
    const objectKey = normalizeObjectKey(image.storage_path);
    assets.push(pendingAsset(image.id, image.owner_id, objectKey, image.storage_path, image.created_at));
    entries.push({ assetId: image.id, kind: "listing_image", sourceType: "supabase_storage", sourceBucket: "listing-images", sourcePath: image.storage_path, targetKey: objectKey });
  }
  for (const placement of source.ad_placements) {
    const id = `ad:${placement.id}`;
    const objectKey = `ad-placements/${placement.id}/creative`;
    assets.push(pendingAsset(id, null, objectKey, placement.image_url, placement.created_at));
    entries.push({ assetId: id, kind: "ad_placement", sourceType: "url", sourceUrl: placement.image_url, targetKey: objectKey });
  }
  for (const profile of source.public_profiles) {
    for (const kind of ["avatar", "cover"]) {
      const sourcePath = profile[`${kind}_path`];
      const sourceUrl = profile[`${kind}_url`];
      if (!sourcePath && !sourceUrl) continue;
      const id = `${kind}:${profile.id}`;
      const objectKey = `profiles/${profile.id}/${kind}`;
      profileAssetIds.set(`${profile.id}:${kind}`, id);
      assets.push(pendingAsset(id, profile.id, objectKey, sourcePath || sourceUrl, profile.created_at));
      entries.push({ assetId: id, kind: `profile_${kind}`, sourceType: sourcePath ? "supabase_storage" : "url", ...(sourcePath ? { sourceBucket: "profile-media", sourcePath } : { sourceUrl }), targetKey: objectKey });
    }
  }
  return { assets, entries, profileAssetIds };
}

function pendingAsset(id, ownerId, objectKey, source, createdAt) {
  return {
    id,
    owner_id: ownerId,
    object_key: objectKey,
    content_type: "application/octet-stream",
    byte_size: 0,
    checksum_sha256: `pending:${id}`,
    etag: null,
    width: null,
    height: null,
    status: "pending",
    source_storage_path: source,
    created_at: createdAt,
    updated_at: snapshotAt,
  };
}
function normalizeObjectKey(value) { return String(value || "").replace(/^r2:/, "").replace(/^\/+/, "").replace(/\.\./g, "_"); }
function appendTable(output, table, rows, columns) { for (const row of rows) output.push(insertStatement(table, pick(row, columns))); }
function pick(row, columns) { return Object.fromEntries(columns.map((column) => [column, row[column] ?? null])); }
function insertStatement(table, row) {
  const columns = Object.keys(row);
  return `INSERT INTO ${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(", ")}) VALUES (${columns.map((column) => sqlValue(row[column])).join(", ")});`;
}
function quoteIdentifier(value) { return `"${String(value).replaceAll('"', '""')}"`; }
function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (value instanceof Date) return sqlString(value.toISOString());
  if (Array.isArray(value) || (typeof value === "object" && value !== null)) return sqlString(JSON.stringify(value));
  return sqlString(String(value));
}
function sqlString(value) { return `'${value.replaceAll("'", "''")}'`; }
function counts(source) { return Object.fromEntries(Object.entries(source).map(([key, rows]) => [key, rows.length])); }
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
