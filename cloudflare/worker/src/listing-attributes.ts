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
}

export interface ListingAttributesEnv {
  DB: Database;
  API_ALLOWED_ORIGINS?: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_AUTH_TEST_JWKS?: string;
  FIREBASE_JWKS_URL?: string;
}

function asAuthEnv(env: ListingAttributesEnv): AuthEnv {
  return env as unknown as AuthEnv;
}

export async function handleListingAttributes(
  request: Request,
  env: ListingAttributesEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\b/, "/v1");
  const match = path.match(/^\/v1\/listings\/([^/]+)\/attributes(?:\/(completeness))?$/);
  if (!match) return null;
  const cors = corsHeaders(request, asAuthEnv(env));
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const listingId = decodeURIComponent(match[1]);
  if (match[2] === "completeness" && request.method === "GET") {
    return completeness(request, listingId, env, cors);
  }
  if (!match[2] && request.method === "GET") return readAttributes(request, listingId, env, cors);
  if (!match[2] && (request.method === "PUT" || request.method === "PATCH")) {
    return replaceAttributes(request, listingId, env, cors);
  }
  return json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, 405, cors);
}

async function ownerListing(
  request: Request,
  listingId: string,
  env: ListingAttributesEnv,
  cors: Headers,
): Promise<{ auth: Awaited<ReturnType<typeof authenticate>>; row: Row } | Response> {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  const row = await env.DB.prepare(
    `SELECT id, owner_id, status, details, updated_at
       FROM listings WHERE id = ?`,
  )
    .bind(listingId)
    .first<Row>();
  if (!row || row.owner_id !== auth.userId) return forbidden(cors);
  return { auth, row };
}

async function readAttributes(
  request: Request,
  listingId: string,
  env: ListingAttributesEnv,
  cors: Headers,
): Promise<Response> {
  const owner = await ownerListing(request, listingId, env, cors);
  if (owner instanceof Response) return owner;
  const assignment = await assignmentFor(listingId, env);
  const values = objectValue(owner.row.details);
  return json(
    {
      data: {
        listingId,
        listingUpdatedAt: stringValue(owner.row.updated_at),
        listingStatus: stringValue(owner.row.status),
        taxonomyVersionId: null,
        taxonomyVersionNumber: null,
        taxonomyNodeId: assignment,
        valueCount: Object.keys(values).length,
        values,
      },
    },
    200,
    cors,
  );
}

async function completeness(
  request: Request,
  listingId: string,
  env: ListingAttributesEnv,
  cors: Headers,
): Promise<Response> {
  const owner = await ownerListing(request, listingId, env, cors);
  if (owner instanceof Response) return owner;
  const taxonomyNodeId = await assignmentFor(listingId, env);
  const values = objectValue(owner.row.details);
  const required = taxonomyNodeId ? await requiredFields(taxonomyNodeId, env) : [];
  const missing = required
    .filter((field) => !hasValue(values[field.key]))
    .map((field) => ({
      fieldKey: field.key,
      labelAr: field.labelAr,
      labelEn: field.labelEn,
      groupKey: field.groupKey,
      sortOrder: field.sortOrder,
    }));
  const filledRequiredCount = required.length - missing.length;
  return json(
    {
      data: {
        complete: missing.length === 0,
        blockingCode: missing.length ? "listing_attributes_incomplete" : null,
        taxonomyVersionId: null,
        taxonomyNodeId,
        requiredCount: required.length,
        filledRequiredCount,
        filledCount: Object.values(values).filter(hasValue).length,
        missingRequiredFields: missing,
      },
    },
    200,
    cors,
  );
}

async function replaceAttributes(
  request: Request,
  listingId: string,
  env: ListingAttributesEnv,
  cors: Headers,
): Promise<Response> {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const expectedUpdatedAt = clean(body.data.expectedUpdatedAt, 120);
  const attributes = objectValue(body.data.attributes);
  if (!expectedUpdatedAt) return validation(cors, "Expected listing version is required.");
  const listing = await env.DB.prepare(
    "SELECT owner_id, status, details, updated_at FROM listings WHERE id = ?",
  )
    .bind(listingId)
    .first<Row>();
  if (!listing || listing.owner_id !== auth.userId) return forbidden(cors);
  if (!["draft", "rejected"].includes(stringValue(listing.status))) {
    return json(
      { error: { code: "invalid_transition", message: "Listing attributes cannot be changed." } },
      409,
      cors,
    );
  }
  if (stringValue(listing.updated_at) !== expectedUpdatedAt) {
    return json(
      { error: { code: "status_mismatch", message: "Listing changed. Reload and retry." } },
      409,
      cors,
    );
  }
  const taxonomyNodeId = await assignmentFor(listingId, env);
  if (!taxonomyNodeId) return validation(cors, "Choose the final taxonomy node first.");
  const allowed = await allowedFields(taxonomyNodeId, env);
  if (allowed.size > 0 && Object.keys(attributes).some((key) => !allowed.has(key))) {
    return validation(cors, "Listing attributes contain unsupported fields.");
  }
  const merged = { ...objectValue(listing.details), ...attributes };
  const updatedAt = new Date().toISOString();
  const result = await env.DB.prepare(
    "UPDATE listings SET details = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND updated_at = ?",
  )
    .bind(JSON.stringify(merged), updatedAt, listingId, auth.userId, expectedUpdatedAt)
    .run();
  if (!result.success) return databaseError(cors);
  const required = await requiredFields(taxonomyNodeId, env);
  const missing = required
    .filter((field) => !hasValue(merged[field.key]))
    .map((field) => ({
      fieldKey: field.key,
      labelAr: field.labelAr,
      labelEn: field.labelEn,
      groupKey: field.groupKey,
      sortOrder: field.sortOrder,
    }));
  return json(
    {
      data: {
        listingId,
        updatedAt,
        writtenCount: Object.keys(attributes).length,
        completeness: {
          complete: missing.length === 0,
          blockingCode: missing.length ? "listing_attributes_incomplete" : null,
          taxonomyVersionId: null,
          taxonomyNodeId,
          requiredCount: required.length,
          filledRequiredCount: required.length - missing.length,
          filledCount: Object.values(merged).filter(hasValue).length,
          missingRequiredFields: missing,
        },
      },
    },
    200,
    cors,
  );
}

async function assignmentFor(listingId: string, env: ListingAttributesEnv): Promise<string | null> {
  const row = await env.DB.prepare(
    "SELECT taxonomy_node_id FROM listing_taxonomy_assignments WHERE listing_id = ? LIMIT 1",
  )
    .bind(listingId)
    .first<{ taxonomy_node_id: string }>();
  return row?.taxonomy_node_id ?? null;
}

async function schemaKeyFor(nodeId: string, env: ListingAttributesEnv): Promise<string | null> {
  const row = await env.DB.prepare(
    "SELECT filter_schema_key FROM taxonomy_nodes WHERE id = ? AND is_active = 1 AND is_leaf = 1",
  )
    .bind(nodeId)
    .first<{ filter_schema_key: string | null }>();
  return row?.filter_schema_key ?? null;
}

async function allowedFields(nodeId: string, env: ListingAttributesEnv): Promise<Set<string>> {
  const key = await schemaKeyFor(nodeId, env);
  if (!key) return new Set();
  const tokens = schemaTokens(key);
  if (!tokens.length) return new Set();
  const clauses: string[] = [];
  const values: Value[] = [];
  for (const token of tokens) {
    clauses.push("(key = ? OR key LIKE ? OR key LIKE ?)");
    values.push(token, `${token}.%`, `${token}_%`);
  }
  const result = await env.DB.prepare(
    `SELECT key FROM field_definitions WHERE is_active = 1 AND (${clauses.join(" OR ")})`,
  )
    .bind(...values)
    .all<{ key: string }>();
  return new Set((result.results ?? []).map((row) => row.key));
}

async function requiredFields(
  nodeId: string,
  env: ListingAttributesEnv,
): Promise<
  Array<{
    key: string;
    labelAr: string;
    labelEn: string | null;
    groupKey: string | null;
    sortOrder: number;
  }>
> {
  const key = await schemaKeyFor(nodeId, env);
  if (!key) return [];
  const tokens = schemaTokens(key);
  if (!tokens.length) return [];
  const clauses: string[] = [];
  const values: Value[] = [];
  for (const token of tokens) {
    clauses.push("(key = ? OR key LIKE ? OR key LIKE ?)");
    values.push(token, `${token}.%`, `${token}_%`);
  }
  const result = await env.DB.prepare(
    `SELECT key, label_ar, label_en, validation_schema, sort_order
       FROM field_definitions WHERE is_active = 1 AND (${clauses.join(" OR ")})
       ORDER BY sort_order, key`,
  )
    .bind(...values)
    .all<Row>();
  return (result.results ?? [])
    .map((row) => {
      const validation = objectValue(row.validation_schema);
      return {
        key: stringValue(row.key),
        labelAr: stringValue(row.label_ar),
        labelEn: nullableString(row.label_en),
        groupKey: nullableString(validation.groupKey),
        sortOrder: numberValue(row.sort_order),
        required: validation.required === true,
      };
    })
    .filter((field) => field.required);
}

function schemaTokens(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed))
      return parsed.filter((item): item is string => typeof item === "string");
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as Row).fields)) {
      return ((parsed as Row).fields as unknown[]).filter(
        (item): item is string => typeof item === "string",
      );
    }
  } catch {
    // Plain schema keys are supported.
  }
  return value
    .split(/[\s,|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}
function objectValue(value: unknown): Row {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Row;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Row) : {};
    } catch {
      return {};
    }
  }
  return {};
}
function hasValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}
function clean(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}
function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}
function nullableString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}
function numberValue(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function unauthorized(cors: Headers): Response {
  return json({ error: { code: "auth_required", message: "Authentication required." } }, 401, cors);
}
function forbidden(cors: Headers): Response {
  return json({ error: { code: "permission_denied", message: "Permission denied." } }, 403, cors);
}
function validation(cors: Headers, message: string): Response {
  return json({ error: { code: "validation_error", message } }, 400, cors);
}
function databaseError(cors: Headers): Response {
  return json(
    { error: { code: "database_error", message: "Database operation failed." } },
    500,
    cors,
  );
}
