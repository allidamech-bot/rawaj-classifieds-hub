import { corsHeaders, json, type AuthEnv } from "./auth";

type Value = string | number | null;
type Row = Record<string, unknown>;
interface Result<T = Row> { results?: T[]; success: boolean; error?: string }
interface Statement {
  bind(...values: Value[]): Statement;
  first<T = Row>(): Promise<T | null>;
  all<T = Row>(): Promise<Result<T>>;
}
interface Database { prepare(query: string): Statement }

export interface DiscoveryEnv {
  DB: Database;
  API_ALLOWED_ORIGINS?: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_AUTH_TEST_JWKS?: string;
  FIREBASE_JWKS_URL?: string;
}

type AttributeFilter = string | boolean | string[] | { min?: number; max?: number };

export async function handleDiscovery(request: Request, env: DiscoveryEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!relevant(path) || request.method !== "GET") return null;
  const cors = corsHeaders(request, env as unknown as AuthEnv);
  if (path === "/v1/listing-facets") return listingFacets(url, env, cors);
  if (path === "/v1/listings/nearby") return nearbyListings(url, env, cors);
  if (path === "/v1/sitemap/references") return sitemapReferences(env, cors);
  if (path === "/v1/sitemap/count") return sitemapCount(env, cors);
  if (path === "/v1/sitemap/listings") return sitemapListings(url, env, cors);
  return null;
}

function relevant(path: string): boolean {
  return path === "/v1/listing-facets" || path === "/v1/listings/nearby" || /^\/v1\/sitemap\//.test(path);
}

async function listingFacets(url: URL, env: DiscoveryEnv, cors: Headers): Promise<Response> {
  const taxonomyNodeIds = unique(url.searchParams.getAll("taxonomyNodeIds").flatMap((v) => v.split(","))).slice(0, 50);
  const attributes = decodeAttributes(url.searchParams.get("attrs"));
  if (Object.keys(attributes).length > 50) return validation(cors, "Too many attribute filters.");
  const where = publicWhere(url, attributes);
  if (!where.ok) return validation(cors, where.message);

  if (taxonomyNodeIds.length > 0) {
    where.clauses.push(`EXISTS (SELECT 1 FROM listing_taxonomy_assignments lta
      WHERE lta.listing_id = l.id AND lta.taxonomy_node_id IN (${taxonomyNodeIds.map(() => "?").join(",")}))`);
    where.values.push(...taxonomyNodeIds);
  }

  const total = await env.DB.prepare(`SELECT COUNT(*) AS total FROM listings l WHERE ${where.clauses.join(" AND ")}`)
    .bind(...where.values).first<{ total: number }>();

  const schemaTokens = await taxonomySchemaTokens(env, taxonomyNodeIds);
  if (schemaTokens.length === 0) {
    return json({ data: { taxonomyVersionId: null, totalCount: numberValue(total?.total), facets: [] } }, 200, cors);
  }

  const fieldWhere: string[] = [];
  const fieldValues: Value[] = [];
  for (const token of schemaTokens) {
    fieldWhere.push("(key = ? OR key LIKE ? OR key LIKE ?)");
    fieldValues.push(token, `${token}.%`, `${token}_%`);
  }
  const fields = await env.DB.prepare(
    `SELECT key, label_ar, label_en, field_type, option_set_key, validation_schema, sort_order
       FROM field_definitions WHERE is_active = 1 AND is_filterable = 1
         AND (${fieldWhere.join(" OR ")}) ORDER BY sort_order, key LIMIT 40`,
  ).bind(...fieldValues).all<Row>();
  if (!fields.success) return databaseError(cors);

  const facets: Row[] = [];
  for (const field of fields.results ?? []) {
    const key = stringValue(field.key);
    if (!/^[A-Za-z0-9_.-]{1,120}$/.test(key)) continue;
    const path = `$."${key}"`;
    const fieldType = stringValue(field.field_type);
    const validationSchema = jsonObject(field.validation_schema);
    const baseSql = `FROM listings l WHERE ${where.clauses.join(" AND ")}`;
    const baseValues = [...where.values];
    let options: Row[] = [];
    let minimum: number | null = null;
    let maximum: number | null = null;

    if (["number", "integer", "decimal", "range"].includes(fieldType)) {
      const bounds = await env.DB.prepare(
        `SELECT MIN(CAST(json_extract(l.details, ?) AS REAL)) AS minimum,
                MAX(CAST(json_extract(l.details, ?) AS REAL)) AS maximum ${baseSql}
          AND json_extract(l.details, ?) IS NOT NULL`,
      ).bind(path, path, ...baseValues, path).first<Row>();
      minimum = nullableNumber(bounds?.minimum);
      maximum = nullableNumber(bounds?.maximum);
    } else {
      const counts = await env.DB.prepare(
        `SELECT CAST(json_extract(l.details, ?) AS TEXT) AS value_key, COUNT(*) AS count
           ${baseSql} AND json_extract(l.details, ?) IS NOT NULL
          GROUP BY CAST(json_extract(l.details, ?) AS TEXT)
          ORDER BY count DESC, value_key LIMIT 100`,
      ).bind(path, ...baseValues, path, path).all<Row>();
      if (!counts.success) return databaseError(cors);
      const labelMap = await optionLabels(env, nullableString(field.option_set_key));
      options = (counts.results ?? []).flatMap((row) => {
        const valueKey = nullableString(row.value_key);
        if (!valueKey) return [];
        const labels = labelMap.get(valueKey);
        return [{ valueKey, labelAr: labels?.labelAr ?? valueKey, labelEn: labels?.labelEn ?? null, count: numberValue(row.count) }];
      });
    }
    facets.push({
      fieldKey: key,
      labelAr: stringValue(field.label_ar, key),
      labelEn: nullableString(field.label_en),
      fieldType,
      groupKey: nullableString(validationSchema.groupKey),
      sortOrder: numberValue(field.sort_order),
      options,
      minimum,
      maximum,
    });
  }

  return json({ data: { taxonomyVersionId: null, totalCount: numberValue(total?.total), facets } }, 200, cors);
}

async function nearbyListings(url: URL, env: DiscoveryEnv, cors: Headers): Promise<Response> {
  const latitude = numberParam(url.searchParams.get("latitude"));
  const longitude = numberParam(url.searchParams.get("longitude"));
  if (latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return validation(cors, "Invalid coordinates.");
  }
  const radius = clampNumber(url.searchParams.get("radiusKm"), 25, 1, 200);
  const limit = clampInteger(url.searchParams.get("limit"), 60, 1, 100);
  const latDelta = radius / 111;
  const lonDelta = radius / Math.max(1, 111 * Math.cos((latitude * Math.PI) / 180));
  const where = [
    "l.status = 'approved'", "l.archived_at IS NULL",
    "(l.expires_at IS NULL OR l.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))",
    "n.latitude BETWEEN ? AND ?", "n.longitude BETWEEN ? AND ?",
  ];
  const values: Value[] = [latitude - latDelta, latitude + latDelta, longitude - lonDelta, longitude + lonDelta];
  addEqual(where, values, "l.category_id", clean(url.searchParams.get("categoryId"), 120));
  addEqual(where, values, "l.subcategory_id", clean(url.searchParams.get("subcategoryId"), 120));
  addEqual(where, values, "l.governorate_id", clean(url.searchParams.get("governorateId"), 120));
  addEqual(where, values, "l.price_type", clean(url.searchParams.get("priceType"), 40));
  addEqual(where, values, "l.listing_condition", clean(url.searchParams.get("condition"), 40));
  const min = numberParam(url.searchParams.get("priceMin"));
  const max = numberParam(url.searchParams.get("priceMax"));
  if (min !== null) { where.push("l.price >= ?"); values.push(min); }
  if (max !== null) { where.push("l.price <= ?"); values.push(max); }
  values.push(Math.min(500, limit * 8));
  const result = await env.DB.prepare(
    `SELECT l.*, n.latitude, n.longitude, c.name_ar AS category_name_ar,
       c.placeholder AS category_placeholder, g.name_ar AS governorate_name_ar,
       (SELECT li.media_asset_id FROM listing_images li JOIN media_assets ma
          ON ma.id = li.media_asset_id AND ma.status = 'ready'
        WHERE li.listing_id = l.id ORDER BY li.sort_order, li.id LIMIT 1) AS primary_media_asset_id
       FROM listings l JOIN location_nodes n ON n.id = l.location_node_id AND n.is_active = 1
       JOIN categories c ON c.id = l.category_id JOIN governorates g ON g.id = l.governorate_id
      WHERE ${where.join(" AND ")} LIMIT ?`,
  ).bind(...values).all<Row>();
  if (!result.success) return databaseError(cors);
  const ranked = (result.results ?? [])
    .map((row) => ({ row, distanceKm: haversine(latitude, longitude, numberValue(row.latitude), numberValue(row.longitude)) }))
    .filter((item) => item.distanceKm <= radius)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
    .map((item) => ({ listing: mapListing(item.row, url.origin), distanceKm: Math.round(item.distanceKm * 10) / 10 }));
  return json({ data: ranked }, 200, cors);
}

async function sitemapReferences(env: DiscoveryEnv, cors: Headers): Promise<Response> {
  const [categories, governorates] = await Promise.all([
    env.DB.prepare("SELECT slug FROM categories WHERE is_active = 1 ORDER BY sort_order, slug").all<{ slug: string }>(),
    env.DB.prepare("SELECT slug FROM governorates WHERE is_active = 1 ORDER BY sort_order, slug").all<{ slug: string }>(),
  ]);
  if (!categories.success || !governorates.success) return databaseError(cors);
  return json({ data: { categories: categories.results ?? [], governorates: governorates.results ?? [] } }, 200, cors);
}

async function sitemapCount(env: DiscoveryEnv, cors: Headers): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM listings WHERE status = 'approved' AND archived_at IS NULL
      AND (expires_at IS NULL OR expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
  ).first<{ count: number }>();
  return json({ data: { count: numberValue(row?.count) } }, 200, cors);
}

async function sitemapListings(url: URL, env: DiscoveryEnv, cors: Headers): Promise<Response> {
  const page = clampInteger(url.searchParams.get("page"), 1, 1, 1_000_000);
  const pageSize = clampInteger(url.searchParams.get("pageSize"), 1000, 1, 1000);
  const result = await env.DB.prepare(
    `SELECT id, owner_id, updated_at FROM listings
      WHERE status = 'approved' AND archived_at IS NULL
        AND (expires_at IS NULL OR expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ORDER BY id LIMIT ? OFFSET ?`,
  ).bind(pageSize, (page - 1) * pageSize).all<Row>();
  return result.success
    ? json({ data: (result.results ?? []).map((row) => ({ id: stringValue(row.id), ownerId: stringValue(row.owner_id), updatedAt: stringValue(row.updated_at) })) }, 200, cors)
    : databaseError(cors);
}

function publicWhere(url: URL, attributes: Record<string, AttributeFilter>) {
  const clauses = ["l.status = 'approved'", "l.archived_at IS NULL", "(l.expires_at IS NULL OR l.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))"];
  const values: Value[] = [];
  addEqual(clauses, values, "l.governorate_id", clean(url.searchParams.get("governorateId"), 120));
  const min = numberParam(url.searchParams.get("priceMin"));
  const max = numberParam(url.searchParams.get("priceMax"));
  if (min !== null && min < 0 || max !== null && max < 0 || min !== null && max !== null && min > max) return { ok: false as const, message: "Invalid price range." };
  if (min !== null) { clauses.push("l.price >= ?"); values.push(min); }
  if (max !== null) { clauses.push("l.price <= ?"); values.push(max); }
  const query = clean(url.searchParams.get("query"), 160);
  if (query) { clauses.push("(l.title LIKE ? OR l.description LIKE ?)"); values.push(`%${query}%`, `%${query}%`); }
  applyAttributes(clauses, values, attributes);
  return { ok: true as const, clauses, values };
}

function applyAttributes(clauses: string[], values: Value[], attributes: Record<string, AttributeFilter>) {
  for (const [key, filter] of Object.entries(attributes)) {
    if (!/^[A-Za-z0-9_.-]{1,120}$/.test(key)) continue;
    const path = `$."${key}"`;
    if (typeof filter === "string") { clauses.push("CAST(json_extract(l.details, ?) AS TEXT) = ?"); values.push(path, filter); }
    else if (typeof filter === "boolean") { clauses.push("CAST(json_extract(l.details, ?) AS INTEGER) = ?"); values.push(path, filter ? 1 : 0); }
    else if (Array.isArray(filter) && filter.length) { clauses.push(`CAST(json_extract(l.details, ?) AS TEXT) IN (${filter.map(() => "?").join(",")})`); values.push(path, ...filter); }
    else if (filter && typeof filter === "object" && !Array.isArray(filter)) {
      if (typeof filter.min === "number") { clauses.push("CAST(json_extract(l.details, ?) AS REAL) >= ?"); values.push(path, filter.min); }
      if (typeof filter.max === "number") { clauses.push("CAST(json_extract(l.details, ?) AS REAL) <= ?"); values.push(path, filter.max); }
    }
  }
}

async function taxonomySchemaTokens(env: DiscoveryEnv, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const result = await env.DB.prepare(
    `SELECT filter_schema_key FROM taxonomy_nodes WHERE id IN (${ids.map(() => "?").join(",")}) AND is_active = 1`,
  ).bind(...ids).all<{ filter_schema_key: string | null }>();
  if (!result.success) return [];
  return unique((result.results ?? []).flatMap((row) => (row.filter_schema_key ?? "").split(/[,+|]/)).map((v) => v.trim()).filter(Boolean)).slice(0, 20);
}

async function optionLabels(env: DiscoveryEnv, setKey: string | null) {
  const map = new Map<string, { labelAr: string; labelEn: string | null }>();
  if (!setKey) return map;
  const result = await env.DB.prepare(
    "SELECT value_key, label_ar, label_en FROM option_values WHERE option_set_key = ? AND is_active = 1",
  ).bind(setKey).all<Row>();
  for (const row of result.results ?? []) map.set(stringValue(row.value_key), { labelAr: stringValue(row.label_ar), labelEn: nullableString(row.label_en) });
  return map;
}

function mapListing(row: Row, origin: string): Row {
  const assetId = nullableString(row.primary_media_asset_id);
  return {
    id: stringValue(row.id), ownerId: stringValue(row.owner_id), categoryId: stringValue(row.category_id),
    subcategoryId: nullableString(row.subcategory_id), categoryNameAr: nullableString(row.category_name_ar),
    categoryPlaceholder: nullableString(row.category_placeholder), governorateId: stringValue(row.governorate_id),
    governorateNameAr: nullableString(row.governorate_name_ar), locationNodeId: nullableString(row.location_node_id),
    title: stringValue(row.title), description: stringValue(row.description), price: nullableNumber(row.price),
    currency: "SYP", priceType: stringValue(row.price_type, "fixed"), condition: stringValue(row.listing_condition, "not_applicable"),
    status: "approved", districtAr: nullableString(row.district_ar), contactName: nullableString(row.contact_name),
    contactOptions: jsonObject(row.contact_options), details: jsonObject(row.details), isFeatured: booleanValue(row.is_featured),
    featuredUntil: nullableString(row.featured_until), reviewedBy: null, reviewedAt: null, rejectionReason: null,
    publishedAt: nullableString(row.published_at), archivedAt: null, reservedAt: nullableString(row.reserved_at),
    expiresAt: nullableString(row.expires_at), renewedAt: nullableString(row.renewed_at), expiryDays: nullableNumber(row.expiry_days),
    createdAt: stringValue(row.created_at), updatedAt: stringValue(row.updated_at),
    primaryImageUrl: assetId ? `${origin}/v1/media/assets/${encodeURIComponent(assetId)}` : null,
  };
}

function decodeAttributes(value: string | null): Record<string, AttributeFilter> {
  if (!value || value.length > 12_000) return {};
  try {
    const parsed = JSON.parse(base64UrlDecode(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, AttributeFilter> : {};
  } catch { return {}; }
}
function base64UrlDecode(value: string): string {
  let base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return atob(base64);
}
function addEqual(where: string[], values: Value[], column: string, value: string | null) { if (value) { where.push(`${column} = ?`); values.push(value); } }
function clean(value: unknown, max: number): string | null { return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null; }
function unique(values: string[]): string[] { return [...new Set(values.map((v) => v.trim()).filter(Boolean))]; }
function numberParam(value: string | null): number | null { if (value === null || value === "") return null; const n = Number(value); return Number.isFinite(n) ? n : null; }
function clampInteger(value: unknown, fallback: number, min: number, max: number): number { const n = Number(value); return Math.max(min, Math.min(max, Number.isInteger(n) ? n : fallback)); }
function clampNumber(value: unknown, fallback: number, min: number, max: number): number { const n = Number(value); return Math.max(min, Math.min(max, Number.isFinite(n) ? n : fallback)); }
function stringValue(value: unknown, fallback = ""): string { return typeof value === "string" ? value : fallback; }
function nullableString(value: unknown): string | null { return typeof value === "string" ? value : null; }
function numberValue(value: unknown): number { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function nullableNumber(value: unknown): number | null { if (value === null || value === undefined || value === "") return null; const n = Number(value); return Number.isFinite(n) ? n : null; }
function booleanValue(value: unknown): boolean { return value === true || value === 1 || value === "1"; }
function jsonObject(value: unknown): Row { if (value && typeof value === "object" && !Array.isArray(value)) return value as Row; if (typeof value !== "string") return {}; try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Row : {}; } catch { return {}; } }
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number { const rad = Math.PI / 180; const dLat = (lat2-lat1)*rad; const dLon=(lon2-lon1)*rad; const a=Math.sin(dLat/2)**2+Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin(dLon/2)**2; return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)); }
function validation(cors: Headers, message: string): Response { return json({ error: { code: "validation_error", message } }, 400, cors); }
function databaseError(cors: Headers): Response { return json({ error: { code: "database_error", message: "Database operation failed." } }, 500, cors); }
