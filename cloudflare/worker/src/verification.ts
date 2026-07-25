import {
  authenticate,
  corsHeaders,
  json,
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
interface R2Object {
  body: ReadableStream;
  writeHttpMetadata(headers: Headers): void;
}
interface R2Bucket {
  put(
    key: string,
    value: ArrayBuffer,
    options?: { httpMetadata?: { contentType?: string; cacheControl?: string } },
  ): Promise<{ httpEtag: string }>;
  get(key: string): Promise<R2Object | null>;
  delete(key: string): Promise<void>;
}

export interface VerificationEnv {
  DB: Database;
  MEDIA: R2Bucket;
  API_ALLOWED_ORIGINS?: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_AUTH_TEST_JWKS?: string;
  FIREBASE_JWKS_URL?: string;
}

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const DOCUMENT_TYPES = new Set([
  "national_id",
  "passport",
  "other_government_id",
  "commercial_registration",
  "business_license",
  "tax_document",
]);
const CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

function asAuthEnv(env: VerificationEnv): AuthEnv {
  return env as unknown as AuthEnv;
}

export async function handleVerification(
  request: Request,
  env: VerificationEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\b/, "/v1");
  const cors = corsHeaders(request, asAuthEnv(env));
  if (!relevant(path)) return null;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  if (path === "/v1/account/verifications") {
    if (request.method === "GET") return listOwn(request, env, cors);
    if (request.method === "POST") return createOwn(request, env, cors);
  }
  if (path === "/v1/admin/verifications" && request.method === "GET") {
    return listAdmin(request, env, cors);
  }
  const document = path.match(/^\/v1\/admin\/verifications\/([^/]+)\/document$/);
  if (document && request.method === "GET") {
    return readDocument(request, env, cors, decodeURIComponent(document[1]));
  }
  const moderate = path.match(/^\/v1\/admin\/verifications\/([^/]+)$/);
  if (moderate && request.method === "PATCH") {
    return moderateRequest(request, env, cors, decodeURIComponent(moderate[1]));
  }
  return json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, 405, cors);
}

function relevant(path: string): boolean {
  return /^\/v1\/(?:account\/verifications|admin\/verifications)(?:\/|$)/.test(path);
}

async function createOwn(
  request: Request,
  env: VerificationEnv,
  cors: Headers,
): Promise<Response> {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("multipart/form-data")) {
    return json({ error: { code: "unsupported_media_type", message: "Multipart form required." } }, 415, cors);
  }

  const form = await request.formData();
  const clientRequestId = clean(form.get("requestId"), 80);
  const requestType = clean(form.get("requestType"), 20);
  const legalName = clean(form.get("legalName"), 120);
  const businessName = cleanOptional(form.get("businessName"), 120);
  const documentType = clean(form.get("documentType"), 80);
  const file = form.get("file");
  if (!clientRequestId || !isUuid(clientRequestId)) return validation(cors, "Invalid request id.");
  if (!requestType || !["personal", "business"].includes(requestType)) {
    return validation(cors, "Invalid verification type.");
  }
  if (!legalName || legalName.length < 3) return validation(cors, "Legal name is required.");
  if (requestType === "business" && (!businessName || businessName.length < 3)) {
    return validation(cors, "Business name is required.");
  }
  if (!documentType || !DOCUMENT_TYPES.has(documentType) || !documentMatches(requestType, documentType)) {
    return validation(cors, "Document type does not match the request.");
  }
  if (!(file instanceof File)) return validation(cors, "Verification document is required.");

  const existing = await env.DB.prepare(
    `SELECT id, status, request_type, legal_name, business_name, document_type,
      reviewed_at, created_at, updated_at
      FROM seller_verification_requests WHERE user_id = ? AND client_request_id = ?`,
  )
    .bind(auth.userId, clientRequestId)
    .first<Row>();
  if (existing) return json({ data: mapOwner(existing) }, 200, cors);

  const profile = await env.DB.prepare(
    "SELECT verification_status FROM public_profiles WHERE id = ?",
  )
    .bind(auth.userId)
    .first<{ verification_status: string }>();
  if (profile?.verification_status === "verified") {
    return json({ error: { code: "status_mismatch", message: "Account is already verified." } }, 409, cors);
  }
  const pending = await env.DB.prepare(
    "SELECT id FROM seller_verification_requests WHERE user_id = ? AND status = 'pending_review'",
  )
    .bind(auth.userId)
    .first();
  if (pending) {
    return json({ error: { code: "status_mismatch", message: "A verification request is already pending." } }, 409, cors);
  }

  const contentType = normalizeContentType(file.type);
  if (!CONTENT_TYPES.has(contentType) || file.size <= 0 || file.size > MAX_DOCUMENT_BYTES) {
    return validation(cors, "Unsupported verification document type or size.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesDocumentSignature(bytes, contentType)) {
    return validation(cors, "Verification document content is invalid.");
  }

  const requestId = crypto.randomUUID();
  const assetId = crypto.randomUUID();
  const extension = extensionFor(contentType);
  const objectKey = `verifications/${auth.userId}/${requestId}/${assetId}.${extension}`;
  const checksum = await sha256Hex(bytes);
  const timestamp = now();
  let object: { httpEtag: string };
  try {
    object = await env.MEDIA.put(objectKey, bytes.buffer, {
      httpMetadata: { contentType, cacheControl: "private, no-store" },
    });
  } catch {
    return databaseError(cors);
  }

  const results = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO media_assets (id, owner_id, object_key, content_type, byte_size,
        checksum_sha256, etag, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?)`,
    ).bind(
      assetId,
      auth.userId,
      objectKey,
      contentType,
      file.size,
      checksum,
      object.httpEtag,
      timestamp,
      timestamp,
    ),
    env.DB.prepare(
      `INSERT INTO seller_verification_requests
       (id, user_id, client_request_id, status, request_type, legal_name, business_name,
        document_type, document_asset_id, created_at, updated_at)
       VALUES (?, ?, ?, 'pending_review', ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      requestId,
      auth.userId,
      clientRequestId,
      requestType,
      legalName,
      requestType === "business" ? businessName : null,
      documentType,
      assetId,
      timestamp,
      timestamp,
    ),
  ]);
  if (results.some((result) => !result.success)) {
    await env.MEDIA.delete(objectKey).catch(() => undefined);
    const duplicate = await env.DB.prepare(
      `SELECT id, status, request_type, legal_name, business_name, document_type,
        reviewed_at, created_at, updated_at
        FROM seller_verification_requests WHERE user_id = ? AND client_request_id = ?`,
    )
      .bind(auth.userId, clientRequestId)
      .first<Row>();
    return duplicate ? json({ data: mapOwner(duplicate) }, 200, cors) : databaseError(cors);
  }

  return json(
    {
      data: {
        id: requestId,
        status: "pending_review",
        requestType,
        legalName,
        businessName: requestType === "business" ? businessName : null,
        documentType,
        reviewedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    },
    201,
    cors,
  );
}

async function listOwn(request: Request, env: VerificationEnv, cors: Headers): Promise<Response> {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  const result = await env.DB.prepare(
    `SELECT id, status, request_type, legal_name, business_name, document_type,
      reviewed_at, created_at, updated_at
      FROM seller_verification_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
  )
    .bind(auth.userId)
    .all<Row>();
  return result.success
    ? json({ data: (result.results ?? []).map(mapOwner) }, 200, cors)
    : databaseError(cors);
}

async function listAdmin(request: Request, env: VerificationEnv, cors: Headers): Promise<Response> {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  if (!canManage(auth.roles)) return forbidden(cors);
  const result = await env.DB.prepare(
    `SELECT id, user_id, status, request_type, legal_name, business_name, document_type,
      document_asset_id, admin_note, reviewed_by, reviewed_at, created_at, updated_at
      FROM seller_verification_requests
      ORDER BY CASE status WHEN 'pending_review' THEN 0 ELSE 1 END, created_at DESC LIMIT 200`,
  ).all<Row>();
  return result.success
    ? json({ data: (result.results ?? []).map(mapAdmin) }, 200, cors)
    : databaseError(cors);
}

async function readDocument(
  request: Request,
  env: VerificationEnv,
  cors: Headers,
  requestId: string,
): Promise<Response> {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  if (!canManage(auth.roles)) return forbidden(cors);
  const row = await env.DB.prepare(
    `SELECT a.object_key, a.content_type, a.byte_size
       FROM seller_verification_requests r JOIN media_assets a ON a.id = r.document_asset_id
      WHERE r.id = ? AND a.status = 'ready'`,
  )
    .bind(requestId)
    .first<{ object_key: string; content_type: string; byte_size: number }>();
  if (!row) return notFound(cors);
  const object = await env.MEDIA.get(row.object_key);
  if (!object) return notFound(cors);
  const headers = new Headers(cors);
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", row.content_type);
  headers.set("Content-Length", String(row.byte_size));
  headers.set("Content-Disposition", "inline; filename=verification-document");
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(object.body, { status: 200, headers });
}

async function moderateRequest(
  request: Request,
  env: VerificationEnv,
  cors: Headers,
  requestId: string,
): Promise<Response> {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!canManage(auth.roles)) return forbidden(cors);
  const contentType = request.headers.get("Content-Type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return json({ error: { code: "unsupported_media_type", message: "JSON required." } }, 415, cors);
  }
  let body: Row;
  try {
    body = (await request.json()) as Row;
  } catch {
    return validation(cors, "Invalid request.");
  }
  const status = clean(body.status, 30);
  const expectedUpdatedAt = clean(body.expectedUpdatedAt, 120);
  const adminNote = cleanOptional(body.adminNote, 1000);
  if (!status || !["approved", "rejected"].includes(status) || !expectedUpdatedAt) {
    return validation(cors, "Invalid verification decision.");
  }
  const existing = await env.DB.prepare(
    "SELECT user_id, status, updated_at FROM seller_verification_requests WHERE id = ?",
  )
    .bind(requestId)
    .first<{ user_id: string; status: string; updated_at: string }>();
  if (!existing) return notFound(cors);
  if (existing.updated_at !== expectedUpdatedAt) {
    return json({ error: { code: "status_mismatch", message: "Request changed. Reload and retry." } }, 409, cors);
  }
  if (existing.status !== "pending_review") {
    return json({ error: { code: "invalid_transition", message: "Request is already reviewed." } }, 409, cors);
  }
  const timestamp = now();
  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE seller_verification_requests
        SET status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
        WHERE id = ? AND status = 'pending_review' AND updated_at = ?`,
    ).bind(status, adminNote, auth.userId, timestamp, timestamp, requestId, expectedUpdatedAt),
    env.DB.prepare(
      "UPDATE public_profiles SET verification_status = ?, updated_at = ? WHERE id = ?",
    ).bind(status === "approved" ? "verified" : "unverified", timestamp, existing.user_id),
  ]);
  return results.every((result) => result.success)
    ? json({ data: { success: true, updatedAt: timestamp } }, 200, cors)
    : databaseError(cors);
}

function mapOwner(row: Row) {
  return {
    id: stringValue(row.id),
    status: stringValue(row.status, "pending_review"),
    requestType: stringValue(row.request_type, "personal"),
    legalName: stringValue(row.legal_name),
    businessName: nullableString(row.business_name),
    documentType: nullableString(row.document_type),
    reviewedAt: nullableString(row.reviewed_at),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
  };
}

function mapAdmin(row: Row) {
  return {
    ...mapOwner(row),
    userId: stringValue(row.user_id),
    documentPath: nullableString(row.document_asset_id),
    adminNote: nullableString(row.admin_note),
    reviewedBy: nullableString(row.reviewed_by),
  };
}

function documentMatches(requestType: string, documentType: string): boolean {
  return requestType === "business"
    ? ["commercial_registration", "business_license", "tax_document"].includes(documentType)
    : ["national_id", "passport", "other_government_id"].includes(documentType);
}

function normalizeContentType(value: string): string {
  return value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function extensionFor(contentType: string): string {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "pdf";
}

function matchesDocumentSignature(bytes: Uint8Array, contentType: string): boolean {
  if (contentType === "application/pdf") return bytes.length >= 5 && ascii(bytes, 0, 5) === "%PDF-";
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  }
  if (contentType === "image/webp") {
    return bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP";
  }
  return false;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const input = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(input).set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function canManage(roles: string[]): boolean {
  return roles.includes("owner") || roles.includes("admin");
}

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return normalized && normalized.length <= max ? normalized : null;
}

function cleanOptional(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  return normalized || null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}
function nullableString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}
function now(): string {
  return new Date().toISOString();
}
function validation(cors: Headers, message: string): Response {
  return json({ error: { code: "validation_error", message } }, 400, cors);
}
function unauthorized(cors: Headers): Response {
  return json({ error: { code: "auth_required", message: "Authentication required." } }, 401, cors);
}
function forbidden(cors: Headers): Response {
  return json({ error: { code: "permission_denied", message: "Permission denied." } }, 403, cors);
}
function notFound(cors: Headers): Response {
  return json({ error: { code: "not_found", message: "Resource not found." } }, 404, cors);
}
function databaseError(cors: Headers): Response {
  return json({ error: { code: "database_unavailable", message: "Data unavailable." } }, 503, cors);
}
