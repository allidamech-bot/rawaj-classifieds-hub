import {
  authenticate,
  corsHeaders,
  json,
  readJson,
  requireMutationAuth,
  type AuthEnv,
} from "./auth";

type Value = string | number | null;
type Row = Record<string, unknown>;
interface Result<T = Row> {
  results?: T[];
  success: boolean;
  error?: string;
}
interface Statement {
  bind(...values: Value[]): Statement;
  first<T = Row>(): Promise<T | null>;
  all<T = Row>(): Promise<Result<T>>;
  run(): Promise<Result>;
}
interface Database {
  prepare(query: string): Statement;
  batch(statements: Statement[]): Promise<Result[]>;
}

export interface TaxonomyEnv {
  DB: Database;
  API_ALLOWED_ORIGINS?: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_AUTH_TEST_JWKS?: string;
  FIREBASE_JWKS_URL?: string;
}

function asAuthEnv(env: TaxonomyEnv): AuthEnv {
  return env as unknown as AuthEnv;
}

export async function handleTaxonomy(request: Request, env: TaxonomyEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\b/, "/v1");
  const cors = corsHeaders(request, asAuthEnv(env));
  if (!relevant(path)) return null;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const leafMatch = path.match(/^\/v1\/taxonomy\/leaf\/([^/]+)$/);
  if (leafMatch && request.method === "GET") {
    return leafSchema(decodeURIComponent(leafMatch[1]), env, cors);
  }
  if (path === "/v1/vehicles/makes" && request.method === "GET") {
    return vehicleMakes(url, env, cors);
  }
  if (path === "/v1/vehicles/models" && request.method === "GET") {
    return vehicleModels(url, env, cors);
  }
  const childrenMatch = path.match(/^\/v1\/vehicles\/models\/([^/]+)\/children$/);
  if (childrenMatch && request.method === "GET") {
    return vehicleChildren(decodeURIComponent(childrenMatch[1]), url, env, cors);
  }
  const assignmentMatch = path.match(/^\/v1\/listings\/([^/]+)\/taxonomy$/);
  if (assignmentMatch && request.method === "GET") {
    return getAssignment(request, decodeURIComponent(assignmentMatch[1]), env, cors);
  }
  if (assignmentMatch && (request.method === "PUT" || request.method === "PATCH")) {
    return setAssignment(request, decodeURIComponent(assignmentMatch[1]), env, cors);
  }

  return json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, 405, cors);
}

function relevant(path: string): boolean {
  return (
    path.startsWith("/v1/taxonomy/") ||
    path.startsWith("/v1/vehicles/") ||
    /^\/v1\/listings\/[^/]+\/taxonomy$/.test(path)
  );
}

async function leafSchema(nodeId: string, env: TaxonomyEnv, cors: Headers): Promise<Response> {
  const leaf = await env.DB.prepare(
    `SELECT id, parent_id, slug, name_ar, name_en, description_ar, description_en,
            icon_key, filter_schema_key, classification_key, classification_value,
            is_active, is_leaf
       FROM taxonomy_nodes WHERE id = ?`,
  )
    .bind(nodeId)
    .first<Row>();
  if (!leaf || !truthy(leaf.is_active) || !truthy(leaf.is_leaf)) {
    return json({ data: { found: false, version: null, leaf: null, fields: [], conditionalRules: [] } }, 200, cors);
  }

  const schemaKey = nullableString(leaf.filter_schema_key);
  const fields = schemaKey ? await fieldsForSchema(schemaKey, env) : [];
  return json(
    {
      data: {
        found: true,
        version: null,
        leaf: {
          id: stringValue(leaf.id),
          parentId: nullableString(leaf.parent_id),
          slug: stringValue(leaf.slug),
          nameAr: stringValue(leaf.name_ar),
          nameEn: nullableString(leaf.name_en),
          descriptionAr: nullableString(leaf.description_ar),
          descriptionEn: nullableString(leaf.description_en),
          iconKey: nullableString(leaf.icon_key),
          filterSchemaKey: schemaKey,
          displaySchemaKey: schemaKey,
          classificationKey: nullableString(leaf.classification_key),
          classificationValue: nullableString(leaf.classification_value),
        },
        fields,
        conditionalRules: [],
      },
    },
    200,
    cors,
  );
}

async function fieldsForSchema(schemaKey: string, env: TaxonomyEnv): Promise<Row[]> {
  const keys = schemaTokens(schemaKey);
  if (keys.length === 0) return [];
  const clauses: string[] = [];
  const values: Value[] = [];
  for (const key of keys) {
    clauses.push("(key = ? OR key LIKE ? OR key LIKE ?)");
    values.push(key, `${key}.%`, `${key}_%`);
  }
  const result = await env.DB.prepare(
    `SELECT key, label_ar, label_en, description_ar, description_en, placeholder_ar,
            placeholder_en, field_type, unit_key, option_set_key, data_provider_key,
            validation_schema, is_searchable, is_filterable, is_displayable,
            is_sensitive, sort_order
       FROM field_definitions
      WHERE is_active = 1 AND (${clauses.join(" OR ")})
      ORDER BY sort_order, key`,
  )
    .bind(...values)
    .all<Row>();
  if (!result.success) return [];

  const output: Row[] = [];
  for (const field of result.results ?? []) {
    const optionSetKey = nullableString(field.option_set_key);
    const options = optionSetKey
      ? await env.DB.prepare(
          `SELECT value_key, label_ar, label_en, aliases, sort_order, metadata
             FROM option_values
            WHERE option_set_key = ? AND is_active = 1
            ORDER BY sort_order, value_key`,
        )
          .bind(optionSetKey)
          .all<Row>()
      : null;
    const validation = parseJson(field.validation_schema, {});
    output.push({
      key: stringValue(field.key),
      groupKey: nullableString((validation as Row).groupKey),
      sortOrder: numberValue(field.sort_order),
      required: (validation as Row).required === true,
      searchable: truthy(field.is_searchable),
      filterable: truthy(field.is_filterable),
      displayable: truthy(field.is_displayable),
      displaySurfaces: arrayValue((validation as Row).displaySurfaces),
      labelAr: stringValue(field.label_ar),
      labelEn: nullableString(field.label_en),
      descriptionAr: nullableString(field.description_ar),
      descriptionEn: nullableString(field.description_en),
      placeholderAr: nullableString(field.placeholder_ar),
      placeholderEn: nullableString(field.placeholder_en),
      fieldType: stringValue(field.field_type),
      unitKey: nullableString(field.unit_key),
      optionSetKey,
      dataProviderKey: nullableString(field.data_provider_key),
      validation,
      defaultValue: (validation as Row).defaultValue ?? null,
      sensitive: truthy(field.is_sensitive),
      options: (options?.results ?? []).map((row) => ({
        key: stringValue(row.value_key),
        labelAr: stringValue(row.label_ar),
        labelEn: nullableString(row.label_en),
        aliases: arrayValue(parseJson(row.aliases, [])),
        sortOrder: numberValue(row.sort_order),
        metadata: parseJson(row.metadata, {}),
      })),
    });
  }
  return output;
}

async function vehicleMakes(url: URL, env: TaxonomyEnv, cors: Headers): Promise<Response> {
  const query = clean(url.searchParams.get("q"), 100);
  const limit = clampInt(url.searchParams.get("limit"), 100, 1, 200);
  const result = query
    ? await env.DB.prepare(
        `SELECT id, slug, name_ar, name_en, aliases, country_code, sort_order
           FROM vehicle_makes WHERE is_active = 1
            AND (name_ar LIKE ? OR name_en LIKE ? OR slug LIKE ?)
           ORDER BY sort_order, name_ar LIMIT ?`,
      )
        .bind(`%${query}%`, `%${query}%`, `%${query}%`, limit)
        .all<Row>()
    : await env.DB.prepare(
        `SELECT id, slug, name_ar, name_en, aliases, country_code, sort_order
           FROM vehicle_makes WHERE is_active = 1 ORDER BY sort_order, name_ar LIMIT ?`,
      )
        .bind(limit)
        .all<Row>();
  return result.success
    ? json({ data: { items: (result.results ?? []).map(mapMake) } }, 200, cors)
    : databaseError(cors);
}

async function vehicleModels(url: URL, env: TaxonomyEnv, cors: Headers): Promise<Response> {
  const makeId = clean(url.searchParams.get("makeId"), 120);
  if (!makeId) return validation(cors, "Vehicle make is required.");
  const query = clean(url.searchParams.get("q"), 100);
  const year = nullableInt(url.searchParams.get("year"));
  const limit = clampInt(url.searchParams.get("limit"), 200, 1, 300);
  const where = ["make_id = ?", "is_active = 1"];
  const values: Value[] = [makeId];
  if (query) {
    where.push("(name_ar LIKE ? OR name_en LIKE ? OR slug LIKE ?)");
    values.push(`%${query}%`, `%${query}%`, `%${query}%`);
  }
  if (year !== null) {
    where.push("(start_year IS NULL OR start_year <= ?)", "(end_year IS NULL OR end_year >= ?)");
    values.push(year, year);
  }
  values.push(limit);
  const result = await env.DB.prepare(
    `SELECT id, make_id, slug, name_ar, name_en, aliases, vehicle_type,
            start_year, end_year, sort_order
       FROM vehicle_models WHERE ${where.join(" AND ")}
       ORDER BY sort_order, name_ar LIMIT ?`,
  )
    .bind(...values)
    .all<Row>();
  return result.success
    ? json({ data: { items: (result.results ?? []).map(mapModel) } }, 200, cors)
    : databaseError(cors);
}

async function vehicleChildren(
  modelId: string,
  url: URL,
  env: TaxonomyEnv,
  cors: Headers,
): Promise<Response> {
  const year = nullableInt(url.searchParams.get("year"));
  const model = await env.DB.prepare(
    "SELECT id, make_id, name_ar, name_en FROM vehicle_models WHERE id = ? AND is_active = 1",
  )
    .bind(modelId)
    .first<Row>();
  if (!model) return json({ data: { found: false, model: null, generations: [], trims: [] } }, 200, cors);
  const yearClause = year === null ? "" : " AND (start_year IS NULL OR start_year <= ?) AND (end_year IS NULL OR end_year >= ?)";
  const generationsStatement = env.DB.prepare(
    `SELECT id, model_id, name_ar, name_en, start_year, end_year, sort_order
       FROM vehicle_generations WHERE model_id = ? AND is_active = 1${yearClause}
       ORDER BY sort_order, name_ar`,
  );
  const trimsStatement = env.DB.prepare(
    `SELECT id, model_id, generation_id, name_ar, name_en, start_year, end_year, sort_order
       FROM vehicle_trims WHERE model_id = ? AND is_active = 1${yearClause}
       ORDER BY sort_order, name_ar`,
  );
  const generations = year === null
    ? await generationsStatement.bind(modelId).all<Row>()
    : await generationsStatement.bind(modelId, year, year).all<Row>();
  const trims = year === null
    ? await trimsStatement.bind(modelId).all<Row>()
    : await trimsStatement.bind(modelId, year, year).all<Row>();
  if (!generations.success || !trims.success) return databaseError(cors);
  return json(
    {
      data: {
        found: true,
        model: {
          id: stringValue(model.id),
          makeId: stringValue(model.make_id),
          nameAr: stringValue(model.name_ar),
          nameEn: stringValue(model.name_en),
        },
        generations: (generations.results ?? []).map(mapGeneration),
        trims: (trims.results ?? []).map(mapTrim),
      },
    },
    200,
    cors,
  );
}

async function getAssignment(
  request: Request,
  listingId: string,
  env: TaxonomyEnv,
  cors: Headers,
): Promise<Response> {
  const auth = await authenticate(request, asAuthEnv(env));
  const listing = await env.DB.prepare("SELECT owner_id, status FROM listings WHERE id = ?")
    .bind(listingId)
    .first<{ owner_id: string; status: string }>();
  if (!listing || (listing.status !== "approved" && listing.owner_id !== auth?.userId)) {
    return notFound(cors);
  }
  const row = await env.DB.prepare(
    "SELECT listing_id, taxonomy_node_id, created_at FROM listing_taxonomy_assignments WHERE listing_id = ? LIMIT 1",
  )
    .bind(listingId)
    .first<Row>();
  return json({ data: row ? mapAssignment(row) : null }, 200, cors);
}

async function setAssignment(
  request: Request,
  listingId: string,
  env: TaxonomyEnv,
  cors: Headers,
): Promise<Response> {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  const listing = await env.DB.prepare("SELECT owner_id, status FROM listings WHERE id = ?")
    .bind(listingId)
    .first<{ owner_id: string; status: string }>();
  if (!listing || listing.owner_id !== auth.userId) return forbidden(cors);
  if (!["draft", "rejected"].includes(listing.status)) return forbidden(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const nodeId = clean(body.data.taxonomyNodeId, 120);
  if (!nodeId) return validation(cors, "Final taxonomy node is required.");
  const node = await env.DB.prepare(
    "SELECT id FROM taxonomy_nodes WHERE id = ? AND is_active = 1 AND is_leaf = 1",
  )
    .bind(nodeId)
    .first<{ id: string }>();
  if (!node) return validation(cors, "Taxonomy node must be an active leaf.");
  const timestamp = new Date().toISOString();
  const results = await env.DB.batch([
    env.DB.prepare("DELETE FROM listing_taxonomy_assignments WHERE listing_id = ?").bind(listingId),
    env.DB.prepare(
      "INSERT INTO listing_taxonomy_assignments (listing_id, taxonomy_node_id, created_at) VALUES (?, ?, ?)",
    ).bind(listingId, nodeId, timestamp),
  ]);
  if (results.some((result) => !result.success)) return databaseError(cors);
  return json(
    {
      data: {
        listingId,
        taxonomyNodeId: nodeId,
        assignmentSource: "explicit",
        updatedAt: timestamp,
      },
    },
    200,
    cors,
  );
}

function schemaTokens(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const fields = (parsed as Row).fields;
      if (Array.isArray(fields)) return fields.filter((item): item is string => typeof item === "string");
    }
  } catch {
    // Non-JSON schema keys are supported below.
  }
  return trimmed.split(/[\s,|]+/).map((item) => item.trim()).filter(Boolean);
}

function mapAssignment(row: Row): Row {
  return {
    listingId: stringValue(row.listing_id),
    taxonomyNodeId: stringValue(row.taxonomy_node_id),
    assignmentSource: "explicit",
    updatedAt: stringValue(row.created_at),
  };
}
function mapMake(row: Row): Row {
  return {
    id: stringValue(row.id), slug: stringValue(row.slug), nameAr: stringValue(row.name_ar),
    nameEn: stringValue(row.name_en), aliases: arrayValue(parseJson(row.aliases, [])),
    countryCode: nullableString(row.country_code), sortOrder: numberValue(row.sort_order),
  };
}
function mapModel(row: Row): Row {
  return {
    id: stringValue(row.id), makeId: stringValue(row.make_id), slug: stringValue(row.slug),
    nameAr: stringValue(row.name_ar), nameEn: stringValue(row.name_en),
    aliases: arrayValue(parseJson(row.aliases, [])), vehicleType: nullableString(row.vehicle_type),
    startYear: nullableNumber(row.start_year), endYear: nullableNumber(row.end_year),
    sortOrder: numberValue(row.sort_order),
  };
}
function mapGeneration(row: Row): Row {
  return {
    id: stringValue(row.id), modelId: stringValue(row.model_id), nameAr: stringValue(row.name_ar),
    nameEn: stringValue(row.name_en), startYear: nullableNumber(row.start_year),
    endYear: nullableNumber(row.end_year), sortOrder: numberValue(row.sort_order),
  };
}
function mapTrim(row: Row): Row {
  return {
    id: stringValue(row.id), modelId: stringValue(row.model_id), generationId: nullableString(row.generation_id),
    nameAr: stringValue(row.name_ar), nameEn: stringValue(row.name_en),
    startYear: nullableNumber(row.start_year), endYear: nullableNumber(row.end_year),
    sortOrder: numberValue(row.sort_order),
  };
}
function parseJson(value: unknown, fallback: unknown): unknown {
  if (typeof value !== "string") return value ?? fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}
function arrayValue(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
function stringValue(value: unknown, fallback = ""): string { return typeof value === "string" ? value : fallback; }
function nullableString(value: unknown): string | null { return typeof value === "string" && value ? value : null; }
function numberValue(value: unknown, fallback = 0): number { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
function nullableNumber(value: unknown): number | null { const number = Number(value); return value === null || value === undefined || !Number.isFinite(number) ? null : number; }
function truthy(value: unknown): boolean { return value === true || value === 1 || value === "1"; }
function clean(value: unknown, max: number): string | null { return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null; }
function nullableInt(value: unknown): number | null { const number = Number(value); return Number.isInteger(number) ? number : null; }
function clampInt(value: unknown, fallback: number, min: number, max: number): number { const number = nullableInt(value); return number === null ? fallback : Math.max(min, Math.min(max, number)); }
function unauthorized(cors: Headers): Response { return json({ error: { code: "auth_required", message: "Authentication required." } }, 401, cors); }
function forbidden(cors: Headers): Response { return json({ error: { code: "permission_denied", message: "Permission denied." } }, 403, cors); }
function notFound(cors: Headers): Response { return json({ error: { code: "not_found", message: "Resource not found." } }, 404, cors); }
function validation(cors: Headers, message: string): Response { return json({ error: { code: "validation_error", message } }, 400, cors); }
function databaseError(cors: Headers): Response { return json({ error: { code: "database_error", message: "Database operation failed." } }, 500, cors); }
