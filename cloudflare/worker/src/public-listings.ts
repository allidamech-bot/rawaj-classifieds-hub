type D1Value = string | number | null;

type JsonRecord = Record<string, unknown>;

interface D1Result<T> {
  results?: T[];
  success: boolean;
  error?: string;
}

interface D1PreparedStatement {
  bind(...values: D1Value[]): D1PreparedStatement;
  all<T = JsonRecord>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface PublicListingsEnv {
  DB: D1Database;
  API_ALLOWED_ORIGINS?: string;
  API_CACHE_SECONDS?: string;
}

type ListingSort = "latest" | "featured" | "cheapest" | "expensive";

type WorkerCursor = {
  sort: ListingSort;
  id: string;
  createdAt?: string;
  price?: number | null;
  isFeatured?: boolean;
};

type LegacyScope = {
  categoryId: string;
  subcategoryId?: string;
  propertyPurpose?: string;
  propertyType?: string;
};

interface ListingFilters {
  categoryId: string | null;
  subcategoryId: string | null;
  governorateId: string | null;
  districtAr: string | null;
  priceType: string | null;
  condition: string | null;
  priceMin: number | null;
  priceMax: number | null;
  withPhotos: boolean;
  query: string | null;
  taxonomyNodeIds: string[];
  legacyScopes: LegacyScope[];
  taxonomyLegacySubcategoryId: string | null;
  carMake: string | null;
  carModel: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  fuelType: string | null;
  transmission: string | null;
  propertyPurpose: string | null;
  propertyType: string | null;
  rooms: number | null;
  rentalDuration: string | null;
  electronicsBrand: string | null;
  detailCondition: string | null;
  employmentType: string | null;
  salaryType: string | null;
  attributeFilters: Record<string, string | boolean | string[] | { min?: number; max?: number }>;
}

const API_VERSION = "v1";
const DEFAULT_API_CACHE_SECONDS = 60;

export async function handlePublicListingsRequest(
  request: Request,
  env: PublicListingsEnv,
): Promise<Response> {
  const url = new URL(request.url);
  const cors = corsHeaders(request.headers.get("Origin"), env);
  const pageSize = integerParam(url.searchParams.get("pageSize"), 30, 1, 50);
  const filters = readListingFilters(url.searchParams);
  const sort = readSort(url.searchParams.get("sort"));
  const cursor = decodeCursor(url.searchParams.get("cursor"));

  const where: string[] = [
    "l.status = 'approved'",
    "l.archived_at IS NULL",
    "(l.expires_at IS NULL OR l.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))",
  ];
  const values: D1Value[] = [];
  const joins: string[] = [];
  let withClause = "";

  const canonicalLocationId = filters.districtAr?.startsWith("@")
    ? filters.districtAr.slice(1).trim()
    : "";
  if (canonicalLocationId) {
    withClause = `WITH RECURSIVE location_scope(id) AS (
      SELECT id FROM location_nodes WHERE id = ? AND is_active = 1
      UNION ALL
      SELECT child.id
        FROM location_nodes child
        JOIN location_scope parent ON child.parent_id = parent.id
       WHERE child.is_active = 1
    )`;
    values.push(canonicalLocationId);
  }

  applyTaxonomyScope(where, values, filters);

  if (filters.governorateId) {
    where.push("l.governorate_id = ?");
    values.push(filters.governorateId);
  }

  if (canonicalLocationId) {
    if (filters.governorateId) {
      where.push(
        "(l.location_node_id IN (SELECT id FROM location_scope) OR l.location_node_id IS NULL)",
      );
    } else {
      where.push("l.location_node_id IN (SELECT id FROM location_scope)");
    }
  } else if (filters.districtAr) {
    where.push("l.district_ar = ?");
    values.push(filters.districtAr);
  }

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

  addJsonTextFilter(where, values, ["car_make", "make"], filters.carMake);
  addJsonTextFilter(where, values, ["car_model", "model"], filters.carModel);
  addJsonNumberRange(where, values, "year", filters.yearFrom, filters.yearTo);
  addJsonTextFilter(where, values, ["fuel_type"], filters.fuelType);
  addJsonTextFilter(where, values, ["transmission"], filters.transmission);
  addJsonTextFilter(
    where,
    values,
    ["listing_purpose", "property_purpose"],
    filters.propertyPurpose,
  );
  addJsonTextFilter(where, values, ["property_type"], filters.propertyType);
  addJsonNumberFilter(where, values, "rooms", filters.rooms);
  addJsonTextFilter(where, values, ["rental_duration"], filters.rentalDuration);
  addJsonTextFilter(where, values, ["electronics_brand"], filters.electronicsBrand);
  addJsonTextFilter(where, values, ["condition"], filters.detailCondition);
  addJsonTextFilter(where, values, ["employment_type"], filters.employmentType);
  addJsonTextFilter(where, values, ["salary_type"], filters.salaryType);
  applyAttributeFilters(where, values, filters.attributeFilters);

  if (filters.query) {
    joins.push("JOIN listings_fts f ON f.listing_id = l.id");
    where.push("listings_fts MATCH ?");
    values.push(toFtsQuery(filters.query));
  }

  const cursorClause = buildCursorClause(sort, cursor, values);
  if (cursorClause) where.push(cursorClause);

  const sql = `${withClause}
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
    ORDER BY ${listingOrder(sort)}
    LIMIT ?`;

  values.push(pageSize + 1);
  const result = await env.DB.prepare(sql)
    .bind(...values)
    .all<JsonRecord>();
  if (!result.success) {
    if (result.error) console.error("rawaj_public_listings_database_error", result.error);
    return json(
      { error: { code: "database_unavailable", message: "Data service unavailable." } },
      503,
      cors,
    );
  }

  const rows = result.results ?? [];
  const hasMore = rows.length > pageSize;
  const visibleRows = hasMore ? rows.slice(0, pageSize) : rows;
  const nextCursor =
    hasMore && visibleRows.length > 0
      ? encodeCursor(cursorFromRow(sort, visibleRows[visibleRows.length - 1]))
      : null;

  return json(
    {
      data: {
        items: visibleRows.map((row) => mapListing(row, url)),
        nextCursor,
        pageSize,
      },
    },
    200,
    cors,
    cacheHeaders(env),
  );
}

function applyTaxonomyScope(where: string[], values: D1Value[], filters: ListingFilters): void {
  const clauses: string[] = [];

  if (filters.taxonomyNodeIds.length > 0) {
    clauses.push(`EXISTS (
      SELECT 1
        FROM listing_taxonomy_assignments lta
       WHERE lta.listing_id = l.id
         AND lta.taxonomy_node_id IN (${filters.taxonomyNodeIds.map(() => "?").join(",")})
    )`);
    values.push(...filters.taxonomyNodeIds);
  }

  for (const scope of filters.legacyScopes) {
    const scopeConditions = ["l.category_id = ?"];
    const scopeValues: D1Value[] = [scope.categoryId];
    if (scope.subcategoryId) {
      scopeConditions.push("l.subcategory_id = ?");
      scopeValues.push(scope.subcategoryId);
    }
    if (scope.propertyPurpose) {
      scopeConditions.push(
        "COALESCE(json_extract(l.details, '$.listing_purpose'), json_extract(l.details, '$.property_purpose')) = ?",
      );
      scopeValues.push(scope.propertyPurpose);
    }
    if (scope.propertyType) {
      scopeConditions.push("json_extract(l.details, '$.property_type') = ?");
      scopeValues.push(scope.propertyType);
    }
    clauses.push(`(${scopeConditions.join(" AND ")})`);
    values.push(...scopeValues);
  }

  if (clauses.length > 0) {
    where.push(`(${clauses.join(" OR ")})`);
    return;
  }

  addEqualFilter(where, values, "l.category_id", filters.categoryId);
  addEqualFilter(
    where,
    values,
    "l.subcategory_id",
    filters.taxonomyLegacySubcategoryId ?? filters.subcategoryId,
  );
}

function readListingFilters(params: URLSearchParams): ListingFilters {
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
    legacyScopes: params
      .getAll("legacyScope")
      .map(decodeLegacyScope)
      .filter((value): value is LegacyScope => Boolean(value))
      .slice(0, 25),
    taxonomyLegacySubcategoryId: cleanText(params.get("taxonomyLegacySubcategoryId"), 120),
    carMake: cleanText(params.get("carMake"), 120),
    carModel: cleanText(params.get("carModel"), 120),
    yearFrom: integerOrNull(params.get("yearFrom")),
    yearTo: integerOrNull(params.get("yearTo")),
    fuelType: cleanText(params.get("fuelType"), 80),
    transmission: cleanText(params.get("transmission"), 80),
    propertyPurpose: cleanText(
      params.get("taxonomyPropertyPurpose") ?? params.get("propertyPurpose"),
      100,
    ),
    propertyType: cleanText(params.get("taxonomyPropertyType") ?? params.get("propertyType"), 100),
    rooms: integerOrNull(params.get("rooms")),
    rentalDuration: cleanText(params.get("rentalDuration"), 80),
    electronicsBrand: cleanText(params.get("electronicsBrand"), 120),
    detailCondition: cleanText(params.get("detailCondition"), 80),
    employmentType: cleanText(params.get("employmentType"), 80),
    salaryType: cleanText(params.get("salaryType"), 80),
    attributeFilters: decodeAttributeFilters(params.get("attrs")),
  };
}

function decodeAttributeFilters(
  value: string | null,
): Record<string, string | boolean | string[] | { min?: number; max?: number }> {
  if (!value || value.length > 12_000) return {};
  try {
    const parsed = JSON.parse(base64UrlDecode(value));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const output: Record<string, string | boolean | string[] | { min?: number; max?: number }> = {};
    for (const [key, raw] of Object.entries(parsed as Record<string, unknown>).slice(0, 50)) {
      if (!/^[A-Za-z0-9_.-]{1,120}$/.test(key)) continue;
      if (typeof raw === "string") output[key] = raw.slice(0, 240);
      else if (typeof raw === "boolean") output[key] = raw;
      else if (Array.isArray(raw)) {
        const values = raw.filter((item): item is string => typeof item === "string").slice(0, 50);
        if (values.length) output[key] = values;
      } else if (raw && typeof raw === "object") {
        const source = raw as Record<string, unknown>;
        const range: { min?: number; max?: number } = {};
        const min = Number(source.min);
        const max = Number(source.max);
        if (Number.isFinite(min)) range.min = min;
        if (Number.isFinite(max)) range.max = max;
        if (Object.keys(range).length) output[key] = range;
      }
    }
    return output;
  } catch {
    return {};
  }
}

function applyAttributeFilters(
  where: string[],
  values: D1Value[],
  filters: Record<string, string | boolean | string[] | { min?: number; max?: number }>,
): void {
  for (const [key, filter] of Object.entries(filters)) {
    const path = `$."${key}"`;
    if (typeof filter === "string") {
      where.push("CAST(json_extract(l.details, ?) AS TEXT) = ?");
      values.push(path, filter);
    } else if (typeof filter === "boolean") {
      where.push("CAST(json_extract(l.details, ?) AS INTEGER) = ?");
      values.push(path, filter ? 1 : 0);
    } else if (Array.isArray(filter) && filter.length > 0) {
      where.push(
        `CAST(json_extract(l.details, ?) AS TEXT) IN (${filter.map(() => "?").join(",")})`,
      );
      values.push(path, ...filter);
    } else if (filter && typeof filter === "object" && !Array.isArray(filter)) {
      if (typeof filter.min === "number" && Number.isFinite(filter.min)) {
        where.push("CAST(json_extract(l.details, ?) AS REAL) >= ?");
        values.push(path, filter.min);
      }
      if (typeof filter.max === "number" && Number.isFinite(filter.max)) {
        where.push("CAST(json_extract(l.details, ?) AS REAL) <= ?");
        values.push(path, filter.max);
      }
    }
  }
}

function decodeLegacyScope(value: string): LegacyScope | null {
  if (!value || value.length > 1_000) return null;
  try {
    const parsed = JSON.parse(base64UrlDecode(value)) as Record<string, unknown>;
    const categoryId = typeof parsed.categoryId === "string" ? parsed.categoryId.trim() : "";
    if (!categoryId) return null;
    return {
      categoryId: categoryId.slice(0, 120),
      ...(typeof parsed.subcategoryId === "string" && parsed.subcategoryId.trim()
        ? { subcategoryId: parsed.subcategoryId.trim().slice(0, 120) }
        : {}),
      ...(typeof parsed.propertyPurpose === "string" && parsed.propertyPurpose.trim()
        ? { propertyPurpose: parsed.propertyPurpose.trim().slice(0, 100) }
        : {}),
      ...(typeof parsed.propertyType === "string" && parsed.propertyType.trim()
        ? { propertyType: parsed.propertyType.trim().slice(0, 100) }
        : {}),
    };
  } catch {
    return null;
  }
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

function addJsonTextFilter(
  where: string[],
  values: D1Value[],
  keys: string[],
  value: string | null,
): void {
  if (!value) return;
  const expressions = keys.map((key) => `json_extract(l.details, '$.${key}')`);
  where.push(`COALESCE(${expressions.join(", ")}) = ?`);
  values.push(value);
}

function addJsonNumberFilter(
  where: string[],
  values: D1Value[],
  key: string,
  value: number | null,
): void {
  if (value === null) return;
  where.push(`CAST(json_extract(l.details, '$.${key}') AS INTEGER) = ?`);
  values.push(value);
}

function addJsonNumberRange(
  where: string[],
  values: D1Value[],
  key: string,
  minimum: number | null,
  maximum: number | null,
): void {
  if (minimum !== null) {
    where.push(`CAST(json_extract(l.details, '$.${key}') AS INTEGER) >= ?`);
    values.push(minimum);
  }
  if (maximum !== null) {
    where.push(`CAST(json_extract(l.details, '$.${key}') AS INTEGER) <= ?`);
    values.push(maximum);
  }
}

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
  cursor: WorkerCursor | null,
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

function cursorFromRow(sort: ListingSort, row: JsonRecord): WorkerCursor {
  return {
    sort,
    id: stringValue(row.id),
    ...(sort === "latest" || sort === "featured" ? { createdAt: stringValue(row.created_at) } : {}),
    ...(sort === "featured" ? { isFeatured: booleanValue(row.is_featured) } : {}),
    ...(sort === "cheapest" || sort === "expensive" ? { price: nullableNumber(row.price) } : {}),
  };
}

function encodeCursor(cursor: WorkerCursor): string {
  return base64UrlEncode(JSON.stringify(cursor));
}

function decodeCursor(value: string | null): WorkerCursor | null {
  if (!value || value.length > 800) return null;
  try {
    const parsed = JSON.parse(base64UrlDecode(value)) as Partial<WorkerCursor>;
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
    primaryImageUrl: primaryAssetId
      ? `${requestUrl.origin}/${API_VERSION}/media/assets/${encodeURIComponent(primaryAssetId)}`
      : null,
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

function cacheHeaders(env: PublicListingsEnv): Headers {
  const seconds = integerValue(env.API_CACHE_SECONDS, DEFAULT_API_CACHE_SECONDS);
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

function corsHeaders(origin: string | null, env: PublicListingsEnv): Headers {
  const headers = new Headers({ Vary: "Origin" });
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

function json(payload: unknown, status: number, ...headerSets: Headers[]): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  for (const set of headerSets) set.forEach((value, key) => headers.set(key, value));
  return new Response(JSON.stringify(payload), { status, headers });
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

function integerOrNull(value: string | null): number | null {
  if (!value) return null;
  const number = Number.parseInt(value, 10);
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

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function jsonObject(value: unknown): JsonRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as JsonRecord;
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
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
