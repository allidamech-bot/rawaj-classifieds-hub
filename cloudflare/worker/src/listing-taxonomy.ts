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

export interface ListingTaxonomyEnv {
  DB: Database;
  API_ALLOWED_ORIGINS?: string;
  SUPABASE_URL?: string;
  SUPABASE_AUTH_TEST_JWKS?: string;
  SUPABASE_JWKS_URL?: string;
}

function asAuthEnv(env: ListingTaxonomyEnv): AuthEnv {
  return env as unknown as AuthEnv;
}

export async function handleListingTaxonomy(
  request: Request,
  env: ListingTaxonomyEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\b/, "/v1");
  const cors = corsHeaders(request, asAuthEnv(env));
  const assignmentMatch = path.match(/^\/v1\/listings\/([^/]+)\/taxonomy$/);
  const leafMatch = path.match(/^\/v1\/taxonomy\/leaf-schema\/([^/]+)$/);
  if (!assignmentMatch && !leafMatch) return null;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  if (leafMatch && request.method === "GET") {
    return leafSchema(env, cors, decodeURIComponent(leafMatch[1]));
  }
  if (assignmentMatch && request.method === "GET") {
    return getAssignment(request, env, cors, decodeURIComponent(assignmentMatch[1]));
  }
  if (assignmentMatch && (request.method === "PUT" || request.method === "PATCH")) {
    return assignTaxonomy(request, env, cors, decodeURIComponent(assignmentMatch[1]));
  }
  return json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, 405, cors);
}

async function getAssignment(
  request: Request,
  env: ListingTaxonomyEnv,
  cors: Headers,
  listingId: string,
) {
  const auth = await authenticate(request, asAuthEnv(env));
  const listing = await env.DB.prepare("SELECT owner_id, status FROM listings WHERE id = ?")
    .bind(listingId)
    .first<{ owner_id: string; status: string }>();
  if (!listing || (listing.status !== "approved" && listing.owner_id !== auth?.userId)) {
    return json({ error: { code: "not_found", message: "Listing not found." } }, 404, cors);
  }
  const row = await env.DB.prepare(
    `SELECT listing_id, taxonomy_node_id, created_at
       FROM listing_taxonomy_assignments WHERE listing_id = ? LIMIT 1`,
  )
    .bind(listingId)
    .first<Row>();
  return json({ data: row ? mapAssignment(row) : null }, 200, cors);
}

async function assignTaxonomy(
  request: Request,
  env: ListingTaxonomyEnv,
  cors: Headers,
  listingId: string,
) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  const listing = await env.DB.prepare("SELECT owner_id, status FROM listings WHERE id = ?")
    .bind(listingId)
    .first<{ owner_id: string; status: string }>();
  if (!listing || listing.owner_id !== auth.userId) return forbidden(cors);
  if (!["draft", "rejected"].includes(listing.status)) {
    return json(
      { error: { code: "invalid_transition", message: "Listing taxonomy cannot be changed." } },
      409,
      cors,
    );
  }
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const taxonomyNodeId = clean(body.data.taxonomyNodeId, 160);
  if (!taxonomyNodeId) return validation(cors, "Choose a final taxonomy node.");
  const node = await env.DB.prepare(
    "SELECT id, is_leaf, is_active FROM taxonomy_nodes WHERE id = ?",
  )
    .bind(taxonomyNodeId)
    .first<{ id: string; is_leaf: number; is_active: number }>();
  if (!node || node.is_active !== 1 || node.is_leaf !== 1) {
    return validation(cors, "The selected taxonomy node is invalid or not a leaf.");
  }
  const now = new Date().toISOString();
  const results = await env.DB.batch([
    env.DB.prepare("DELETE FROM listing_taxonomy_assignments WHERE listing_id = ?").bind(listingId),
    env.DB.prepare(
      "INSERT INTO listing_taxonomy_assignments (listing_id, taxonomy_node_id, created_at) VALUES (?, ?, ?)",
    ).bind(listingId, taxonomyNodeId, now),
  ]);
  if (results.some((result) => !result.success)) return databaseError(cors);
  return json(
    { data: { listingId, taxonomyNodeId, assignmentSource: "explicit", updatedAt: now } },
    200,
    cors,
  );
}

async function leafSchema(env: ListingTaxonomyEnv, cors: Headers, nodeId: string) {
  const node = await env.DB.prepare(
    `SELECT id, parent_id, slug, name_ar, name_en, description_ar, description_en,
            icon_key, filter_schema_key, classification_key, classification_value, is_leaf, is_active
       FROM taxonomy_nodes WHERE id = ?`,
  )
    .bind(nodeId)
    .first<Row>();
  if (!node || Number(node.is_active) !== 1 || Number(node.is_leaf) !== 1) {
    return json(
      { data: { found: false, version: null, leaf: null, fields: [], conditionalRules: [] } },
      200,
      cors,
    );
  }
  return json(
    {
      data: {
        found: true,
        version: null,
        leaf: {
          id: stringValue(node.id),
          parentId: nullableString(node.parent_id),
          slug: stringValue(node.slug),
          nameAr: stringValue(node.name_ar),
          nameEn: nullableString(node.name_en),
          descriptionAr: nullableString(node.description_ar),
          descriptionEn: nullableString(node.description_en),
          iconKey: nullableString(node.icon_key),
          filterSchemaKey: nullableString(node.filter_schema_key),
          displaySchemaKey: null,
          classificationKey: nullableString(node.classification_key),
          classificationValue: nullableString(node.classification_value),
        },
        fields: [],
        conditionalRules: [],
      },
    },
    200,
    cors,
  );
}

function mapAssignment(row: Row) {
  return {
    listingId: stringValue(row.listing_id),
    taxonomyNodeId: stringValue(row.taxonomy_node_id),
    assignmentSource: "explicit",
    updatedAt: stringValue(row.created_at),
  };
}
function clean(value: unknown, max: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}
function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}
function nullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}
function validation(cors: Headers, message: string) {
  return json({ error: { code: "validation_error", message } }, 400, cors);
}
function forbidden(cors: Headers) {
  return json({ error: { code: "permission_denied", message: "Permission denied." } }, 403, cors);
}
function databaseError(cors: Headers) {
  return json(
    { error: { code: "database_error", message: "Database operation failed." } },
    500,
    cors,
  );
}
