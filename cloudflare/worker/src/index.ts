type D1Value = string | number | null;

interface D1Result<T> {
  results?: T[];
  success: boolean;
  error?: string;
}

interface D1PreparedStatement {
  bind(...values: D1Value[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface R2ObjectBody {
  body: ReadableStream;
  httpEtag: string;
  httpMetadata?: {
    contentType?: string;
    cacheControl?: string;
    contentDisposition?: string;
  };
  customMetadata?: Record<string, string>;
  writeHttpMetadata(headers: Headers): void;
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
}

export interface PublicCoreEnv {
  DB: D1Database;
  MEDIA: R2Bucket;
  API_ALLOWED_ORIGINS?: string;
  API_CACHE_SECONDS?: string;
  MEDIA_CACHE_SECONDS?: string;
}

type JsonRecord = Record<string, unknown>;

const API_VERSION = "v1";
const DEFAULT_API_CACHE_SECONDS = 60;
const DEFAULT_MEDIA_CACHE_SECONDS = 86_400;

export async function handlePublicCore(
  request: Request,
  env: PublicCoreEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!isPublicCorePath(url.pathname)) return null;

  const origin = request.headers.get("Origin");
  const cors = corsHeaders(origin, env);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (request.method !== "GET") {
    return json(
      { error: { code: "method_not_allowed", message: "Method not allowed." } },
      405,
      cors,
    );
  }

  try {
    if (url.pathname === `/${API_VERSION}/health`) {
      return await health(env, cors);
    }

    if (url.pathname === `/${API_VERSION}/references`) {
      return await references(env, cors);
    }

    if (url.pathname === `/${API_VERSION}/locations/roots`) {
      return await locationRoots(url, env, cors);
    }

    if (url.pathname === `/${API_VERSION}/locations/search`) {
      return await locationSearch(url, env, cors);
    }

    const locationChildrenMatch = url.pathname.match(
      new RegExp(`^/${API_VERSION}/locations/([^/]+)/children$`),
    );
    if (locationChildrenMatch) {
      return await locationChildren(decodeURIComponent(locationChildrenMatch[1]), env, cors);
    }

    const locationMatch = url.pathname.match(new RegExp(`^/${API_VERSION}/locations/([^/]+)$`));
    if (locationMatch) {
      return await locationDetail(
        decodeURIComponent(locationMatch[1]),
        url.searchParams.get("include"),
        env,
        cors,
      );
    }

    if (url.pathname === `/${API_VERSION}/ad-placements`) {
      return await adPlacements(url, env, cors);
    }

    if (url.pathname === `/${API_VERSION}/listings`) {
      return await listings(url, env, cors);
    }

    const listingMatch = url.pathname.match(new RegExp(`^/${API_VERSION}/listings/([^/]+)$`));
    if (listingMatch) {
      return await listingDetail(decodeURIComponent(listingMatch[1]), env, cors);
    }

    const mediaMatch = url.pathname.match(new RegExp(`^/${API_VERSION}/media/assets/([^/]+)$`));
    if (mediaMatch) {
      return await mediaAsset(request, decodeURIComponent(mediaMatch[1]), env, cors);
    }

    return null;
  } catch (error) {
    console.error("rawaj_public_api_unhandled", error);
    return json(
      { error: { code: "internal_error", message: "Unexpected service error." } },
      500,
      cors,
    );
  }
}

export default {
  async fetch(request: Request, env: PublicCoreEnv): Promise<Response> {
    return (
      (await handlePublicCore(request, env)) ??
      json({ error: { code: "not_found", message: "Resource not found." } }, 404, new Headers())
    );
  },
};

function isPublicCorePath(pathname: string): boolean {
  return (
    pathname === `/${API_VERSION}/health` ||
    pathname === `/${API_VERSION}/references` ||
    pathname === `/${API_VERSION}/locations/roots` ||
    pathname === `/${API_VERSION}/locations/search` ||
    new RegExp(`^/${API_VERSION}/locations/[^/]+(?:/children)?$`).test(pathname) ||
    pathname === `/${API_VERSION}/ad-placements` ||
    pathname === `/${API_VERSION}/listings` ||
    new RegExp(`^/${API_VERSION}/listings/[^/]+$`).test(pathname) ||
    new RegExp(`^/${API_VERSION}/media/assets/[^/]+$`).test(pathname)
  );
}

async function health(env: PublicCoreEnv, cors: Headers): Promise<Response> {
  const row = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
  return json(
    {
      data: {
        service: "rawaj-classifieds-hub",
        version: API_VERSION,
        database: row?.ok === 1 ? "ready" : "unavailable",
      },
    },
    row?.ok === 1 ? 200 : 503,
    cors,
    cacheHeaders(env, 0),
  );
}

async function references(env: PublicCoreEnv, cors: Headers): Promise<Response> {
  const results = await env.DB.batch([
    env.DB.prepare(
      `SELECT id, slug, name_ar, name_en, hint_ar, hint_en, placeholder,
                sort_order, is_active
           FROM categories
          WHERE is_active = 1
          ORDER BY sort_order ASC, id ASC`,
    ),
    env.DB.prepare(
      `SELECT id, category_id, name_ar, name_en, sort_order
           FROM subcategories
          ORDER BY category_id ASC, sort_order ASC, id ASC`,
    ),
    env.DB.prepare(
      `SELECT id, slug, name_ar, name_en, districts_ar, districts_en,
                sort_order, is_active
           FROM governorates
          WHERE is_active = 1
          ORDER BY sort_order ASC, id ASC`,
    ),
    env.DB.prepare(
      `SELECT id, parent_id, slug, name_ar, name_en, description_ar,
                description_en, icon_key, sort_order, depth, is_active,
                is_leaf, filter_schema_key, classification_key,
                classification_value, legacy_category_id, legacy_subcategory_id
           FROM taxonomy_nodes
          WHERE is_active = 1
          ORDER BY sort_order ASC, name_ar ASC, id ASC`,
    ),
  ]);

  if (results.some((result) => !result.success)) {
    return databaseFailure(cors, results.find((result) => !result.success)?.error);
  }

  return json(
    {
      data: {
        categories: (results[0].results ?? []).map(mapCategory),
        subcategories: (results[1].results ?? []).map(mapSubcategory),
        governorates: (results[2].results ?? []).map(mapGovernorate),
        taxonomyNodes: (results[3].results ?? []).map(mapTaxonomyNode),
      },
    },
    200,
    cors,
    cacheHeaders(env),
  );
}

const LOCATION_SELECT = `id, parent_id, country_code, node_type, name_ar, name_en, slug,
  official_code, external_source, external_id, latitude, longitude, sort_order, depth,
  is_active, search_aliases, legacy_governorate_id, legacy_district_ar`;

async function locationRoots(url: URL, env: PublicCoreEnv, cors: Headers): Promise<Response> {
  const country = cleanText(url.searchParams.get("country"), 2) ?? "SY";
  if (!/^[A-Z]{2}$/.test(country)) return validationFailure(cors, "Invalid country code.");
  const result = await env.DB.prepare(
    `SELECT ${LOCATION_SELECT} FROM location_nodes
      WHERE country_code = ? AND is_active = 1 AND parent_id IS NULL
      ORDER BY sort_order ASC, name_ar ASC LIMIT 100`,
  )
    .bind(country)
    .all<JsonRecord>();
  if (!result.success) return databaseFailure(cors, result.error);
  return json({ data: (result.results ?? []).map(mapLocationNode) }, 200, cors, cacheHeaders(env));
}

async function locationChildren(
  parentId: string,
  env: PublicCoreEnv,
  cors: Headers,
): Promise<Response> {
  if (!validId(parentId)) return validationFailure(cors, "Invalid location id.");
  const result = await env.DB.prepare(
    `SELECT ${LOCATION_SELECT} FROM location_nodes
      WHERE parent_id = ? AND is_active = 1
      ORDER BY sort_order ASC, name_ar ASC LIMIT 500`,
  )
    .bind(parentId)
    .all<JsonRecord>();
  if (!result.success) return databaseFailure(cors, result.error);
  return json({ data: (result.results ?? []).map(mapLocationNode) }, 200, cors, cacheHeaders(env));
}

async function locationDetail(
  id: string,
  include: string | null,
  env: PublicCoreEnv,
  cors: Headers,
): Promise<Response> {
  if (!validId(id)) return validationFailure(cors, "Invalid location id.");
  if (include === "descendants") {
    const result = await env.DB.prepare(
      `WITH RECURSIVE scope(id) AS (
        SELECT id FROM location_nodes WHERE id = ? AND is_active = 1
        UNION ALL
        SELECT child.id FROM location_nodes child JOIN scope parent ON child.parent_id = parent.id
        WHERE child.is_active = 1
      ) SELECT id FROM scope LIMIT 10000`,
    )
      .bind(id)
      .all<{ id: string }>();
    if (!result.success) return databaseFailure(cors, result.error);
    if (!(result.results ?? []).length) return notFound(cors, "Location not found.");
    return json(
      { data: (result.results ?? []).map((row) => row.id) },
      200,
      cors,
      cacheHeaders(env),
    );
  }
  const rows = await env.DB.prepare(
    `WITH RECURSIVE path AS (
      SELECT ${LOCATION_SELECT} FROM location_nodes WHERE id = ? AND is_active = 1
      UNION ALL
      SELECT parent.id, parent.parent_id, parent.country_code, parent.node_type,
        parent.name_ar, parent.name_en, parent.slug, parent.official_code,
        parent.external_source, parent.external_id, parent.latitude, parent.longitude,
        parent.sort_order, parent.depth, parent.is_active, parent.search_aliases,
        parent.legacy_governorate_id, parent.legacy_district_ar
      FROM location_nodes parent JOIN path child ON child.parent_id = parent.id
      WHERE parent.is_active = 1
    ) SELECT * FROM path ORDER BY depth ASC`,
  )
    .bind(id)
    .all<JsonRecord>();
  if (!rows.success) return databaseFailure(cors, rows.error);
  if (!(rows.results ?? []).length) return notFound(cors, "Location not found.");
  return json({ data: (rows.results ?? []).map(mapLocationNode) }, 200, cors, cacheHeaders(env));
}

async function locationSearch(url: URL, env: PublicCoreEnv, cors: Headers): Promise<Response> {
  const query = cleanText(url.searchParams.get("q"), 100);
  const limit = integerParam(url.searchParams.get("limit"), 12, 1, 20);
  if (!query || query.length < 2) return validationFailure(cors, "Search requires two characters.");
  const storedQuery = toWindows1256Mojibake(query);
  const like = `%${storedQuery.replace(/[%_]/g, "\\$&")}%`;
  const normalized = normalizeArabicSearch(storedQuery);
  const result = await env.DB.prepare(
    `SELECT DISTINCT n.id, n.parent_id, n.country_code, n.node_type, n.name_ar,
       n.name_en, n.slug, n.official_code, n.external_source, n.external_id,
       n.latitude, n.longitude, n.sort_order, n.depth, n.is_active, n.search_aliases,
       n.legacy_governorate_id, n.legacy_district_ar,
       (SELECT a.alias FROM location_search_aliases a
         WHERE a.location_node_id = n.id AND a.normalized_alias LIKE ? ESCAPE '\\'
         ORDER BY length(a.normalized_alias), a.alias LIMIT 1) AS matched_alias
     FROM location_nodes n
     LEFT JOIN location_search_aliases alias ON alias.location_node_id = n.id
     WHERE n.country_code = 'SY' AND n.is_active = 1
       AND (n.name_ar LIKE ? ESCAPE '\\' OR n.name_en LIKE ? ESCAPE '\\'
         OR alias.normalized_alias LIKE ? ESCAPE '\\')
     ORDER BY CASE WHEN n.name_ar = ? OR n.name_en = ? THEN 0 ELSE 1 END,
       n.depth ASC, n.sort_order ASC, n.name_ar ASC LIMIT ?`,
  )
    .bind(`%${normalized}%`, like, like, `%${normalized}%`, query, query, limit)
    .all<JsonRecord>();
  if (!result.success) return databaseFailure(cors, result.error);
  return json(
    {
      data: (result.results ?? []).map((row) => ({
        node: mapLocationNode(row),
        matchedAlias: nullableString(row.matched_alias),
        pathAr: stringValue(row.name_ar),
        pathEn: nullableString(row.name_en) ?? stringValue(row.name_ar),
      })),
    },
    200,
    cors,
    cacheHeaders(env),
  );
}

async function adPlacements(url: URL, env: PublicCoreEnv, cors: Headers): Promise<Response> {
  const placementPage = cleanText(url.searchParams.get("page"), 80);
  const device = url.searchParams.get("device") === "mobile" ? "mobile" : "desktop";

  if (!placementPage) {
    return json(
      { error: { code: "validation_error", message: "Missing placement page." } },
      400,
      cors,
    );
  }

  const deviceColumn = device === "mobile" ? "target_mobile" : "target_desktop";
  const result = await env.DB.prepare(
    `SELECT id, destination_url, priority, media_asset_id
       FROM ad_placements
      WHERE placement_page = ?
        AND status = 'active'
        AND ${deviceColumn} = 1
        AND (starts_at IS NULL OR starts_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        AND (ends_at IS NULL OR ends_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ORDER BY priority DESC, id ASC`,
  )
    .bind(placementPage)
    .all<JsonRecord>();

  if (!result.success) return databaseFailure(cors, result.error);

  return json(
    {
      data: (result.results ?? []).map((row) => ({
        id: stringValue(row.id),
        imageUrl: mediaUrl(url, stringValue(row.media_asset_id)),
        destinationUrl: stringValue(row.destination_url),
        priority: numberValue(row.priority),
      })),
    },
    200,
    cors,
    cacheHeaders(env),
  );
}

async function listings(url: URL, env: PublicCoreEnv, cors: Headers): Promise<Response> {
  const pageSize = integerParam(url.searchParams.get("pageSize"), 30, 1, 50);
  const filters = readListingFilters(url.searchParams);
  const cursor = decodeCursor(url.searchParams.get("cursor"));
  const sort = readSort(url.searchParams.get("sort"));

  const where: string[] = [
    "l.status = 'approved'",
    "l.archived_at IS NULL",
    "(l.expires_at IS NULL OR l.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))",
  ];
  const values: D1Value[] = [];

  addEqualFilter(where, values, "l.category_id", filters.categoryId);
  addEqualFilter(where, values, "l.subcategory_id", filters.subcategoryId);
  addEqualFilter(where, values, "l.governorate_id", filters.governorateId);
  addEqualFilter(where, values, "l.district_ar", filters.districtAr);
  addEqualFilter(where, values, "l.price_type", filters.priceType);
  addEqualFilter(where, values, "l.listing_condition", filters.condition);

  if (filters.priceMin !== null) {
    where.push("l.price >= ?");
    values.push(filters.priceMin);
  }
  if (filters.priceMax !== null) {
    where.push("l.price <= ?");
    values.push(filters.priceMax);
  }
  if (filters.withPhotos) {
    where.push("EXISTS (SELECT 1 FROM listing_images li WHERE li.listing_id = l.id)");
  }
  if (filters.taxonomyNodeIds.length > 0) {
    where.push(
      `EXISTS (
         SELECT 1
           FROM listing_taxonomy_assignments lta
          WHERE lta.listing_id = l.id
            AND lta.taxonomy_node_id IN (${filters.taxonomyNodeIds.map(() => "?").join(",")})
       )`,
    );
    values.push(...filters.taxonomyNodeIds);
  }

  const joins: string[] = [];
  if (filters.query) {
    joins.push("JOIN listings_fts f ON f.listing_id = l.id");
    where.push("listings_fts MATCH ?");
    values.push(toFtsQuery(filters.query));
  }

  const cursorClause = buildCursorClause(sort, cursor, values);
  if (cursorClause) where.push(cursorClause);

  const orderBy = listingOrder(sort);
  const sql = `
    SELECT
      l.id, l.owner_id, l.category_id, l.subcategory_id, l.governorate_id,
      l.location_node_id, l.title, l.description, l.price, l.currency, l.price_type,
      l.listing_condition, l.status, l.district_ar, l.contact_name,
      l.contact_options, l.details, l.is_featured, l.featured_until,
      l.published_at, l.archived_at, l.reserved_at, l.expires_at,
      l.renewed_at, l.expiry_days, l.created_at, l.updated_at,
      c.name_ar AS category_name_ar, c.placeholder AS category_placeholder,
      g.name_ar AS governorate_name_ar,
      (
        SELECT li.media_asset_id
          FROM listing_images li
         WHERE li.listing_id = l.id
         ORDER BY li.sort_order ASC, li.id ASC
         LIMIT 1
      ) AS primary_media_asset_id
    FROM listings l
    JOIN categories c ON c.id = l.category_id
    JOIN governorates g ON g.id = l.governorate_id
    ${joins.join("\n")}
    WHERE ${where.join("\n      AND ")}
    ORDER BY ${orderBy}
    LIMIT ?
  `;

  values.push(pageSize + 1);
  const result = await env.DB.prepare(sql)
    .bind(...values)
    .all<JsonRecord>();
  if (!result.success) return databaseFailure(cors, result.error);

  const rows = result.results ?? [];
  const hasMore = rows.length > pageSize;
  const visibleRows = hasMore ? rows.slice(0, pageSize) : rows;
  const items = visibleRows.map((row) => mapListing(row, url));
  const nextCursor =
    hasMore && visibleRows.length > 0
      ? encodeCursor(cursorFromRow(sort, visibleRows[visibleRows.length - 1]))
      : null;

  return json(
    {
      data: {
        items,
        nextCursor,
        pageSize,
      },
    },
    200,
    cors,
    cacheHeaders(env),
  );
}

async function listingDetail(id: string, env: PublicCoreEnv, cors: Headers): Promise<Response> {
  if (!id || id.length > 120) {
    return json({ error: { code: "validation_error", message: "Invalid listing id." } }, 400, cors);
  }

  const listingResult = await env.DB.prepare(
    `SELECT
       l.id, l.owner_id, l.category_id, l.subcategory_id, l.governorate_id,
       l.title, l.description, l.price, l.currency, l.price_type,
       l.listing_condition, l.status, l.district_ar, l.contact_name,
       l.contact_options, l.details, l.is_featured, l.featured_until,
       l.published_at, l.archived_at, l.reserved_at, l.expires_at,
       l.renewed_at, l.expiry_days, l.created_at, l.updated_at,
       c.name_ar AS category_name_ar, c.placeholder AS category_placeholder,
       g.name_ar AS governorate_name_ar
     FROM listings l
     JOIN categories c ON c.id = l.category_id
     JOIN governorates g ON g.id = l.governorate_id
     WHERE l.id = ?
       AND l.status = 'approved'
       AND l.archived_at IS NULL
       AND (l.expires_at IS NULL OR l.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     LIMIT 1`,
  )
    .bind(id)
    .first<JsonRecord>();

  if (!listingResult) {
    return json({ error: { code: "not_found", message: "Listing not found." } }, 404, cors);
  }

  const imageResult = await env.DB.prepare(
    `SELECT li.id, li.media_asset_id, li.alt_ar, li.sort_order, li.created_at
       FROM listing_images li
      WHERE li.listing_id = ?
      ORDER BY li.sort_order ASC, li.id ASC`,
  )
    .bind(id)
    .all<JsonRecord>();

  if (!imageResult.success) return databaseFailure(cors, imageResult.error);

  const requestUrl = new URL(`https://placeholder.invalid/${API_VERSION}/listings/${id}`);
  const listing = mapListing(listingResult, requestUrl);
  const images = (imageResult.results ?? []).map((row) => ({
    id: stringValue(row.id),
    listingId: id,
    storagePath: null,
    publicUrl: `/${API_VERSION}/media/assets/${encodeURIComponent(stringValue(row.media_asset_id))}`,
    altAr: nullableString(row.alt_ar),
    sortOrder: numberValue(row.sort_order),
    createdAt: stringValue(row.created_at),
  }));

  return json({ data: { listing, images } }, 200, cors, cacheHeaders(env));
}

async function mediaAsset(
  request: Request,
  assetId: string,
  env: PublicCoreEnv,
  cors: Headers,
): Promise<Response> {
  if (!assetId || assetId.length > 160) {
    return json({ error: { code: "not_found", message: "Media not found." } }, 404, cors);
  }

  const asset = await env.DB.prepare(
    `SELECT m.object_key, m.content_type, m.etag, m.checksum_sha256
       FROM media_assets m
      WHERE m.id = ?
        AND m.status = 'ready'
        AND (
          EXISTS (
            SELECT 1
              FROM listing_images li
              JOIN listings l ON l.id = li.listing_id
             WHERE li.media_asset_id = m.id
               AND l.status = 'approved'
               AND l.archived_at IS NULL
               AND (l.expires_at IS NULL OR l.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
          )
          OR EXISTS (
            SELECT 1
              FROM ad_placements ap
             WHERE ap.media_asset_id = m.id
               AND ap.status = 'active'
               AND (ap.starts_at IS NULL OR ap.starts_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
               AND (ap.ends_at IS NULL OR ap.ends_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
          )
          OR EXISTS (
            SELECT 1
              FROM public_profiles p
             WHERE p.avatar_asset_id = m.id OR p.cover_asset_id = m.id
          )
        )
      LIMIT 1`,
  )
    .bind(assetId)
    .first<JsonRecord>();

  if (!asset) {
    return json({ error: { code: "not_found", message: "Media not found." } }, 404, cors);
  }

  const object = await env.MEDIA.get(stringValue(asset.object_key));
  if (!object) {
    console.error("rawaj_media_object_missing", { assetId, objectKey: asset.object_key });
    return json({ error: { code: "not_found", message: "Media not found." } }, 404, cors);
  }

  const headers = new Headers(cors);
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", stringValue(asset.content_type, "application/octet-stream"));
  headers.set("ETag", object.httpEtag || stringValue(asset.etag));
  headers.set(
    "Cache-Control",
    `public, max-age=${integerValue(env.MEDIA_CACHE_SECONDS, DEFAULT_MEDIA_CACHE_SECONDS)}, immutable`,
  );
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Security-Policy", "default-src 'none'; sandbox");

  const ifNoneMatch = request.headers.get("If-None-Match");
  if (ifNoneMatch && ifNoneMatch === headers.get("ETag")) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(object.body, { status: 200, headers });
}

function mapCategory(row: JsonRecord): JsonRecord {
  return {
    id: stringValue(row.id),
    slug: stringValue(row.slug),
    nameAr: stringValue(row.name_ar),
    nameEn: nullableString(row.name_en),
    hintAr: nullableString(row.hint_ar),
    hintEn: nullableString(row.hint_en),
    placeholder: stringValue(row.placeholder, "misc"),
    sortOrder: numberValue(row.sort_order),
    isActive: booleanValue(row.is_active),
  };
}

function mapSubcategory(row: JsonRecord): JsonRecord {
  return {
    id: stringValue(row.id),
    categoryId: stringValue(row.category_id),
    nameAr: stringValue(row.name_ar),
    nameEn: nullableString(row.name_en),
    sortOrder: numberValue(row.sort_order),
  };
}

function mapGovernorate(row: JsonRecord): JsonRecord {
  return {
    id: stringValue(row.id),
    slug: stringValue(row.slug),
    nameAr: stringValue(row.name_ar),
    nameEn: nullableString(row.name_en),
    districtsAr: jsonArray(row.districts_ar),
    districtsEn: jsonArray(row.districts_en),
    sortOrder: numberValue(row.sort_order),
    isActive: booleanValue(row.is_active),
  };
}

function mapTaxonomyNode(row: JsonRecord): JsonRecord {
  return {
    id: stringValue(row.id),
    parentId: nullableString(row.parent_id),
    slug: stringValue(row.slug),
    nameAr: stringValue(row.name_ar),
    nameEn: nullableString(row.name_en),
    descriptionAr: nullableString(row.description_ar),
    descriptionEn: nullableString(row.description_en),
    iconKey: nullableString(row.icon_key),
    sortOrder: numberValue(row.sort_order),
    depth: numberValue(row.depth),
    isActive: booleanValue(row.is_active),
    isLeaf: booleanValue(row.is_leaf),
    filterSchemaKey: nullableString(row.filter_schema_key),
    classificationKey: nullableString(row.classification_key),
    classificationValue: nullableString(row.classification_value),
    legacyCategoryId: nullableString(row.legacy_category_id),
    legacySubcategoryId: nullableString(row.legacy_subcategory_id),
  };
}

function mapLocationNode(row: JsonRecord): JsonRecord {
  return {
    id: stringValue(row.id),
    parentId: nullableString(row.parent_id),
    countryCode: stringValue(row.country_code, "SY"),
    nodeType: stringValue(row.node_type, "locality"),
    nameAr: stringValue(row.name_ar),
    nameEn: nullableString(row.name_en),
    slug: stringValue(row.slug),
    officialCode: nullableString(row.official_code),
    externalSource: nullableString(row.external_source),
    externalId: nullableString(row.external_id),
    latitude: nullableNumber(row.latitude),
    longitude: nullableNumber(row.longitude),
    sortOrder: numberValue(row.sort_order),
    depth: numberValue(row.depth),
    isActive: booleanValue(row.is_active),
    searchAliases: jsonArray(row.search_aliases),
    legacyGovernorateId: nullableString(row.legacy_governorate_id),
    legacyDistrictAr: nullableString(row.legacy_district_ar),
  };
}

function validId(value: string): boolean {
  return value.length > 0 && value.length <= 160 && /^[\p{L}\p{N}._:-]+$/u.test(value);
}

function normalizeArabicSearch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
}

function validationFailure(cors: Headers, message: string): Response {
  return json({ error: { code: "validation_error", message } }, 400, cors);
}

function notFound(cors: Headers, message: string): Response {
  return json({ error: { code: "not_found", message } }, 404, cors);
}

function mapListing(row: JsonRecord, requestUrl: URL): JsonRecord {
  const primaryAssetId = nullableString(row.primary_media_asset_id);
  return {
    id: stringValue(row.id),
    ownerId: stringValue(row.owner_id),
    categoryId: stringValue(row.category_id),
    subcategoryId: nullableString(row.subcategory_id),
    categoryNameAr: nullableString(row.category_name_ar),
    categoryPlaceholder: nullableString(row.category_placeholder),
    governorateId: stringValue(row.governorate_id),
    governorateNameAr: nullableString(row.governorate_name_ar),
    locationNodeId: nullableString(row.location_node_id),
    title: stringValue(row.title),
    description: stringValue(row.description),
    price: nullableNumber(row.price),
    currency: "SYP",
    priceType: stringValue(row.price_type, "fixed"),
    condition: stringValue(row.listing_condition, "not_applicable"),
    status: "approved",
    districtAr: nullableString(row.district_ar),
    contactName: nullableString(row.contact_name),
    contactOptions: jsonObject(row.contact_options),
    details: sanitizePublicDetails(jsonObject(row.details)),
    isFeatured: booleanValue(row.is_featured),
    featuredUntil: nullableString(row.featured_until),
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
    publishedAt: nullableString(row.published_at),
    archivedAt: null,
    reservedAt: nullableString(row.reserved_at),
    expiresAt: nullableString(row.expires_at),
    renewedAt: nullableString(row.renewed_at),
    expiryDays: nullableNumber(row.expiry_days),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
    primaryImageUrl: primaryAssetId ? mediaUrl(requestUrl, primaryAssetId) : null,
  };
}

function sanitizePublicDetails(details: JsonRecord): JsonRecord {
  const blocked = new Set([
    "phone",
    "mobile",
    "contact_phone",
    "whatsapp",
    "whatsApp",
    "contact_whatsapp",
  ]);
  return Object.fromEntries(Object.entries(details).filter(([key]) => !blocked.has(key)));
}

function readListingFilters(params: URLSearchParams) {
  return {
    categoryId: cleanText(params.get("categoryId"), 120),
    subcategoryId: cleanText(params.get("subcategoryId"), 120),
    governorateId: cleanText(params.get("governorateId"), 120),
    districtAr: cleanText(params.get("districtAr"), 160),
    priceType: cleanText(params.get("priceType"), 40),
    condition: cleanText(params.get("condition"), 40),
    priceMin: numericParam(params.get("priceMin")),
    priceMax: numericParam(params.get("priceMax")),
    withPhotos: params.get("withPhotos") === "true",
    query: cleanText(params.get("q"), 120),
    taxonomyNodeIds: params
      .getAll("taxonomyNodeId")
      .flatMap((value) => value.split(","))
      .map((value) => cleanText(value, 120))
      .filter((value): value is string => Boolean(value))
      .slice(0, 50),
  };
}

function addEqualFilter(
  where: string[],
  values: D1Value[],
  column: string,
  value: string | null,
): void {
  if (!value) return;
  where.push(`${column} = ?`);
  values.push(value);
}

type ListingSort = "latest" | "featured" | "cheapest" | "expensive";
type ListingCursor = {
  sort: ListingSort;
  id: string;
  createdAt?: string;
  price?: number | null;
  isFeatured?: boolean;
};

function readSort(value: string | null): ListingSort {
  return value === "featured" || value === "cheapest" || value === "expensive" ? value : "latest";
}

function listingOrder(sort: ListingSort): string {
  if (sort === "featured") return "l.is_featured DESC, l.created_at DESC, l.id DESC";
  if (sort === "cheapest") return "l.price IS NULL ASC, l.price ASC, l.id ASC";
  if (sort === "expensive") return "l.price IS NULL ASC, l.price DESC, l.id ASC";
  return "l.created_at DESC, l.id DESC";
}

function buildCursorClause(
  sort: ListingSort,
  cursor: ListingCursor | null,
  values: D1Value[],
): string | null {
  if (!cursor || cursor.sort !== sort || !cursor.id) return null;

  if (sort === "latest" && cursor.createdAt) {
    values.push(cursor.createdAt, cursor.createdAt, cursor.id);
    return "(l.created_at < ? OR (l.created_at = ? AND l.id < ?))";
  }

  if (sort === "featured" && cursor.createdAt && typeof cursor.isFeatured === "boolean") {
    const featured = cursor.isFeatured ? 1 : 0;
    values.push(featured, featured, cursor.createdAt, cursor.createdAt, cursor.id);
    return `(
      l.is_featured < ?
      OR (
        l.is_featured = ?
        AND (l.created_at < ? OR (l.created_at = ? AND l.id < ?))
      )
    )`;
  }

  if ((sort === "cheapest" || sort === "expensive") && cursor.price !== undefined) {
    if (cursor.price === null) {
      values.push(cursor.id);
      return "l.price IS NULL AND l.id > ?";
    }
    const operator = sort === "cheapest" ? ">" : "<";
    values.push(cursor.price, cursor.price, cursor.id);
    return `(l.price ${operator} ? OR (l.price = ? AND l.id > ?) OR l.price IS NULL)`;
  }

  return null;
}

function cursorFromRow(sort: ListingSort, row: JsonRecord): ListingCursor {
  return {
    sort,
    id: stringValue(row.id),
    ...(sort === "latest" || sort === "featured" ? { createdAt: stringValue(row.created_at) } : {}),
    ...(sort === "featured" ? { isFeatured: booleanValue(row.is_featured) } : {}),
    ...(sort === "cheapest" || sort === "expensive" ? { price: nullableNumber(row.price) } : {}),
  };
}

function encodeCursor(cursor: ListingCursor): string {
  return base64UrlEncode(JSON.stringify(cursor));
}

function decodeCursor(value: string | null): ListingCursor | null {
  if (!value || value.length > 800) return null;
  try {
    const parsed = JSON.parse(base64UrlDecode(value)) as Partial<ListingCursor>;
    const sort = readSort(typeof parsed.sort === "string" ? parsed.sort : null);
    if (typeof parsed.id !== "string" || !parsed.id) return null;
    return {
      sort,
      id: parsed.id,
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : undefined,
      price: typeof parsed.price === "number" || parsed.price === null ? parsed.price : undefined,
      isFeatured: typeof parsed.isFeatured === "boolean" ? parsed.isFeatured : undefined,
    };
  } catch {
    return null;
  }
}

function toFtsQuery(value: string): string {
  const tokens = value
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 8);
  return tokens.map((token) => `"${token.replace(/"/g, '""')}"*`).join(" AND ");
}

function mediaUrl(url: URL, assetId: string): string {
  return `${url.origin}/${API_VERSION}/media/assets/${encodeURIComponent(assetId)}`;
}

function cacheHeaders(env: PublicCoreEnv, override?: number): Headers {
  const seconds = override ?? integerValue(env.API_CACHE_SECONDS, DEFAULT_API_CACHE_SECONDS);
  const headers = new Headers();
  headers.set(
    "Cache-Control",
    seconds > 0
      ? `public, max-age=${seconds}, stale-while-revalidate=${Math.max(seconds, 300)}`
      : "no-store",
  );
  headers.set("Vary", "Origin");
  return headers;
}

function corsHeaders(origin: string | null, env: PublicCoreEnv): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, If-None-Match",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  });

  if (!origin) return headers;
  const allowed = new Set(
    (env.API_ALLOWED_ORIGINS ?? "https://rawa-j.com,https://www.rawa-j.com")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  if (allowed.has(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

function databaseFailure(cors: Headers, detail?: string): Response {
  if (detail) console.error("rawaj_public_api_database_error", detail);
  return json(
    { error: { code: "database_unavailable", message: "Data service unavailable." } },
    503,
    cors,
  );
}

function json(payload: unknown, status: number, ...headerSets: Headers[]): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  for (const set of headerSets) {
    set.forEach((value, key) => headers.set(key, value));
  }
  return new Response(JSON.stringify(payload), { status, headers });
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? repairWindows1256Mojibake(value) : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? repairWindows1256Mojibake(value) : null;
}

const windows1256Decoder = new TextDecoder("windows-1256");
const windows1256Reverse = new Map<string, number>(
  Array.from({ length: 256 }, (_, byte) => [windows1256Decoder.decode(Uint8Array.of(byte)), byte]),
);

function repairWindows1256Mojibake(value: string): string {
  if (!/[طظ]/.test(value)) return value;
  const bytes: number[] = [];
  for (const character of value) {
    const byte = windows1256Reverse.get(character);
    if (byte === undefined) return value;
    bytes.push(byte);
  }
  const repaired = new TextDecoder("utf-8", { fatal: false }).decode(Uint8Array.from(bytes));
  return repaired.includes("\uFFFD") ? value : repaired;
}

function toWindows1256Mojibake(value: string): string {
  return windows1256Decoder.decode(new TextEncoder().encode(value));
}

function numberValue(value: unknown, fallback = 0): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function jsonObject(value: unknown): JsonRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as JsonRecord)
      : {};
  } catch {
    return {};
  }
}

function jsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function cleanText(value: string | null, maxLength: number): string | null {
  const clean = value?.trim() ?? "";
  return clean ? clean.slice(0, maxLength) : null;
}

function numericParam(value: string | null): number | null {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function integerParam(value: string | null, fallback: number, min: number, max: number): number {
  const number = Number.parseInt(value ?? "", 10);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function integerValue(value: string | undefined, fallback: number): number {
  const number = Number.parseInt(value ?? "", 10);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): string {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
