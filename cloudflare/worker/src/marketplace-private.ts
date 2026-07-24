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
interface R2Object {
  body: ReadableStream;
  httpEtag: string;
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
export interface MarketplaceEnv {
  DB: Database;
  MEDIA: R2Bucket;
  API_ALLOWED_ORIGINS?: string;
}

function asAuthEnv(env: MarketplaceEnv): AuthEnv {
  return env as unknown as AuthEnv;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGES = 12;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function handleMarketplacePrivate(
  request: Request,
  env: MarketplaceEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\b/, "/v1");
  const cors = corsHeaders(request, asAuthEnv(env));

  if (request.method === "OPTIONS" && relevant(path)) {
    return new Response(null, { status: 204, headers: cors });
  }
  if (path === "/v1/profile") {
    if (request.method === "GET") return getProfile(request, env, cors);
    if (request.method === "PATCH" || request.method === "PUT") {
      return updateProfile(request, env, cors);
    }
  }
  if (path === "/v1/account/listings" && request.method === "GET") {
    return ownerListings(request, env, cors);
  }
  if (path === "/v1/listings" && request.method === "POST") {
    return createListing(request, env, cors);
  }
  if (path === "/v1/listings" && request.method === "GET" && url.pathname.startsWith("/api/")) {
    return publicListings(url, env, cors);
  }
  const listingMatch = path.match(/^\/v1\/listings\/([^/]+)$/);
  if (listingMatch && request.method === "GET" && url.pathname.startsWith("/api/")) {
    return listingDetail(request, env, cors, decodeURIComponent(listingMatch[1]));
  }
  if (listingMatch && (request.method === "PATCH" || request.method === "PUT")) {
    return updateListing(request, env, cors, decodeURIComponent(listingMatch[1]));
  }
  if (listingMatch && request.method === "DELETE") {
    return deleteListing(request, env, cors, decodeURIComponent(listingMatch[1]));
  }
  const imagesMatch = path.match(/^\/v1\/listings\/([^/]+)\/images$/);
  if (imagesMatch && request.method === "POST") {
    return uploadImage(request, env, cors, decodeURIComponent(imagesMatch[1]));
  }
  if (imagesMatch && request.method === "GET") {
    return listImages(env, cors, decodeURIComponent(imagesMatch[1]));
  }
  if (imagesMatch && request.method === "PATCH") {
    return reorderImages(request, env, cors, decodeURIComponent(imagesMatch[1]));
  }
  const imageMatch = path.match(/^\/v1\/listing-images\/([^/]+)$/);
  if (imageMatch && request.method === "DELETE") {
    return deleteImage(request, env, cors, decodeURIComponent(imageMatch[1]));
  }
  const privateMediaMatch = path.match(/^\/v1\/account\/media\/assets\/([^/]+)$/);
  if (privateMediaMatch && request.method === "GET") {
    return privateMedia(request, env, cors, decodeURIComponent(privateMediaMatch[1]));
  }
  return relevant(path) && url.pathname.startsWith("/api/")
    ? json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, 405, cors)
    : null;
}

function relevant(path: string) {
  return /^\/v1\/(profile|account\/(?:listings|media)|listings|listing-images)\b/.test(path);
}

async function getProfile(request: Request, env: MarketplaceEnv, cors: Headers) {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  const row = await env.DB.prepare(
    `SELECT id, email, display_name, first_name, last_name, business_name, bio,
      governorate, city_area, phone, whatsapp, preferred_contact_method,
      verification_status, account_status, avatar_asset_id, cover_asset_id,
      created_at, updated_at FROM public_profiles WHERE id = ?`,
  )
    .bind(auth.userId)
    .first<Row>();
  return row
    ? json({ data: { ...mapProfile(row), roles: auth.roles } }, 200, cors)
    : json({ error: { code: "not_found", message: "Profile not found." } }, 404, cors);
}

async function updateProfile(request: Request, env: MarketplaceEnv, cors: Headers) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const profile = normalizeProfile(body.data);
  if (!profile) return validation(cors, "Invalid profile fields.");
  const result = await env.DB.prepare(
    `UPDATE public_profiles SET first_name = ?, last_name = ?, display_name = ?,
      governorate = ?, city_area = ?, bio = ?, business_name = ?, phone = ?,
      whatsapp = ?, preferred_contact_method = ?, profile_version = profile_version + 1,
      updated_at = ? WHERE id = ?`,
  )
    .bind(
      profile.firstName,
      profile.lastName,
      profile.displayName,
      profile.governorate,
      profile.cityArea,
      profile.bio,
      profile.businessName,
      profile.phone,
      profile.whatsapp,
      profile.preferredContactMethod,
      now(),
      auth.userId,
    )
    .run();
  return result.success ? getProfile(request, env, cors) : databaseError(cors);
}

async function publicListings(url: URL, env: MarketplaceEnv, cors: Headers) {
  const page = integer(url.searchParams.get("page"), 1, 1, 100_000);
  const pageSize = integer(url.searchParams.get("pageSize"), 30, 1, 50);
  const where = ["l.status = 'approved'", "l.archived_at IS NULL"];
  const values: Value[] = [];
  addFilter(where, values, "l.category_id", clean(url.searchParams.get("categoryId"), 120));
  addFilter(where, values, "l.subcategory_id", clean(url.searchParams.get("subcategoryId"), 120));
  addFilter(where, values, "l.governorate_id", clean(url.searchParams.get("governorateId"), 120));
  addFilter(where, values, "l.owner_id", clean(url.searchParams.get("sellerId"), 120));
  const min = numberOrNull(url.searchParams.get("priceMin"));
  const max = numberOrNull(url.searchParams.get("priceMax"));
  if (min !== null) {
    where.push("l.price >= ?");
    values.push(min);
  }
  if (max !== null) {
    where.push("l.price <= ?");
    values.push(max);
  }
  const query = clean(url.searchParams.get("q"), 120);
  if (query) {
    where.push("(l.title LIKE ? OR l.description LIKE ?)");
    values.push(`%${query}%`, `%${query}%`);
  }
  const sort = url.searchParams.get("sort");
  const order =
    sort === "cheapest"
      ? "l.price ASC, l.id ASC"
      : sort === "expensive"
        ? "l.price DESC, l.id DESC"
        : "l.created_at DESC, l.id DESC";
  values.push(pageSize, (page - 1) * pageSize);
  const result = await env.DB.prepare(
    `SELECT l.id, l.owner_id, l.category_id, l.subcategory_id, l.governorate_id,
      l.location_node_id, l.title, l.description, l.price, l.currency, l.price_type,
      l.listing_condition, l.status, l.district_ar, l.details, l.created_at, l.updated_at
      FROM listings l WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ? OFFSET ?`,
  )
    .bind(...values)
    .all();
  return result.success
    ? json({ data: { items: result.results ?? [], page, pageSize } }, 200, cors)
    : databaseError(cors);
}

async function listingDetail(request: Request, env: MarketplaceEnv, cors: Headers, id: string) {
  const auth = await authenticate(request, asAuthEnv(env));
  const row = await env.DB.prepare(
    `SELECT id, owner_id, category_id, subcategory_id, governorate_id, location_node_id,
      title, description, price, currency, price_type, listing_condition, status,
      district_ar, details, created_at, updated_at FROM listings WHERE id = ?`,
  )
    .bind(id)
    .first<Row>();
  if (!row || (row.status !== "approved" && row.owner_id !== auth?.userId)) {
    return json({ error: { code: "not_found", message: "Listing not found." } }, 404, cors);
  }
  const images = await env.DB.prepare(
    `SELECT li.id, li.listing_id, li.media_asset_id, li.alt_ar, li.sort_order,
      li.created_at FROM listing_images li JOIN media_assets m ON m.id = li.media_asset_id
      WHERE li.listing_id = ? AND m.status = 'ready' ORDER BY li.sort_order, li.id`,
  )
    .bind(id)
    .all();
  return json({ data: { listing: row, images: images.results ?? [] } }, 200, cors);
}

async function ownerListings(request: Request, env: MarketplaceEnv, cors: Headers) {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  const result = await env.DB.prepare(
    `SELECT id, category_id, subcategory_id, governorate_id, location_node_id,
      title, description, price, currency, price_type, listing_condition, status,
      district_ar, details, created_at, updated_at FROM listings
      WHERE owner_id = ? ORDER BY updated_at DESC LIMIT 200`,
  )
    .bind(auth.userId)
    .all();
  return result.success ? json({ data: result.results ?? [] }, 200, cors) : databaseError(cors);
}

async function createListing(request: Request, env: MarketplaceEnv, cors: Headers) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  const input = await parseListing(request, env, cors);
  if (input instanceof Response) return input;
  const id = crypto.randomUUID();
  const timestamp = now();
  const status = input.submit ? "pending_review" : "draft";
  const result = await env.DB.prepare(
    `INSERT INTO listings (id, owner_id, category_id, subcategory_id, governorate_id,
      location_node_id, title, description, price, currency, price_type,
      listing_condition, status, district_ar, contact_name, contact_options, details,
      is_featured, search_text_normalized, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYP', ?, ?, ?, ?, ?, '{}', ?, 0, ?, ?, ?)`,
  )
    .bind(
      id,
      auth.userId,
      input.categoryId,
      input.subcategoryId,
      input.governorateId,
      input.locationNodeId,
      input.title,
      input.description,
      input.price,
      input.priceType,
      input.condition,
      status,
      input.districtAr,
      input.contactName,
      JSON.stringify(input.details),
      `${input.title} ${input.description}`.toLowerCase(),
      timestamp,
      timestamp,
    )
    .run();
  return result.success ? json({ data: { id, status } }, 201, cors) : databaseError(cors);
}

async function updateListing(request: Request, env: MarketplaceEnv, cors: Headers, id: string) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  const existing = await env.DB.prepare("SELECT owner_id, status FROM listings WHERE id = ?")
    .bind(id)
    .first<{ owner_id: string; status: string }>();
  if (!existing || existing.owner_id !== auth.userId) return forbidden(cors);
  if (!["draft", "rejected"].includes(existing.status)) {
    return json(
      { error: { code: "invalid_transition", message: "Listing cannot be edited." } },
      409,
      cors,
    );
  }
  const input = await parseListing(request, env, cors);
  if (input instanceof Response) return input;
  const status = input.submit ? "pending_review" : existing.status;
  const result = await env.DB.prepare(
    `UPDATE listings SET category_id = ?, subcategory_id = ?, governorate_id = ?,
      location_node_id = ?, title = ?, description = ?, price = ?, price_type = ?,
      listing_condition = ?, status = ?, district_ar = ?, contact_name = ?, details = ?,
      search_text_normalized = ?, updated_at = ? WHERE id = ? AND owner_id = ?`,
  )
    .bind(
      input.categoryId,
      input.subcategoryId,
      input.governorateId,
      input.locationNodeId,
      input.title,
      input.description,
      input.price,
      input.priceType,
      input.condition,
      status,
      input.districtAr,
      input.contactName,
      JSON.stringify(input.details),
      `${input.title} ${input.description}`.toLowerCase(),
      now(),
      id,
      auth.userId,
    )
    .run();
  return result.success ? json({ data: { id, status } }, 200, cors) : databaseError(cors);
}

async function deleteListing(request: Request, env: MarketplaceEnv, cors: Headers, id: string) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  const listing = await env.DB.prepare("SELECT owner_id, status FROM listings WHERE id = ?")
    .bind(id)
    .first<{ owner_id: string; status: string }>();
  if (!listing || listing.owner_id !== auth.userId) return forbidden(cors);
  if (!["draft", "pending_review", "approved", "rejected"].includes(listing.status)) {
    return json(
      { error: { code: "invalid_transition", message: "Listing cannot be deleted." } },
      409,
      cors,
    );
  }
  const assets = await env.DB.prepare(
    `SELECT m.id, m.object_key FROM listing_images li JOIN media_assets m
      ON m.id = li.media_asset_id WHERE li.listing_id = ? AND m.owner_id = ?`,
  )
    .bind(id, auth.userId)
    .all<{ id: string; object_key: string }>();
  for (const asset of assets.results ?? []) await env.MEDIA.delete(asset.object_key);
  const statements = [
    env.DB.prepare("DELETE FROM listing_images WHERE listing_id = ?").bind(id),
    ...(assets.results ?? []).map((asset) =>
      env.DB.prepare("DELETE FROM media_assets WHERE id = ? AND owner_id = ?").bind(
        asset.id,
        auth.userId,
      ),
    ),
    env.DB.prepare("DELETE FROM listings WHERE id = ? AND owner_id = ?").bind(id, auth.userId),
  ];
  const results = await env.DB.batch(statements);
  return results.every((result) => result.success)
    ? json({ data: { success: true } }, 200, cors)
    : databaseError(cors);
}

async function uploadImage(
  request: Request,
  env: MarketplaceEnv,
  cors: Headers,
  listingId: string,
) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  const listing = await env.DB.prepare("SELECT owner_id, status FROM listings WHERE id = ?")
    .bind(listingId)
    .first<{ owner_id: string; status: string }>();
  if (!listing || listing.owner_id !== auth.userId) return forbidden(cors);
  if (!["draft", "rejected"].includes(listing.status)) return forbidden(cors);
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("multipart/form-data")) {
    return json(
      { error: { code: "unsupported_media_type", message: "Multipart form required." } },
      415,
      cors,
    );
  }
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return validation(cors, "Image file required.");
  if (!IMAGE_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return validation(cors, "Unsupported image type or size.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesImageSignature(bytes, file.type))
    return validation(cors, "Image content is invalid.");
  const count = await env.DB.prepare(
    "SELECT count(*) AS count FROM listing_images WHERE listing_id = ?",
  )
    .bind(listingId)
    .first<{ count: number }>();
  if ((count?.count ?? 0) >= MAX_IMAGES) {
    return json({ error: { code: "limit_exceeded", message: "Image limit reached." } }, 409, cors);
  }
  const assetId = crypto.randomUUID();
  const imageId = crypto.randomUUID();
  const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const objectKey = `listings/${auth.userId}/${listingId}/${crypto.randomUUID()}.${extension}`;
  const checksum = await sha256Hex(bytes);
  let object;
  try {
    object = await env.MEDIA.put(objectKey, bytes.buffer, {
      httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" },
    });
  } catch {
    return databaseError(cors);
  }
  const sortOrder = count?.count ?? 0;
  const timestamp = now();
  const results = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO media_assets (id, owner_id, object_key, content_type, byte_size,
        checksum_sha256, etag, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?)`,
    ).bind(
      assetId,
      auth.userId,
      objectKey,
      file.type,
      file.size,
      checksum,
      object.httpEtag,
      timestamp,
      timestamp,
    ),
    env.DB.prepare(
      "INSERT INTO listing_images (id, listing_id, media_asset_id, alt_ar, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(
      imageId,
      listingId,
      assetId,
      clean(form.get("altAr"), 200) ?? null,
      sortOrder,
      timestamp,
    ),
  ]);
  if (results.some((result) => !result.success)) {
    await env.MEDIA.delete(objectKey);
    return databaseError(cors);
  }
  return json(
    {
      data: {
        id: imageId,
        listingId,
        mediaAssetId: assetId,
        sortOrder,
        publicUrl: `/v1/account/media/assets/${encodeURIComponent(assetId)}`,
      },
    },
    201,
    cors,
  );
}

async function listImages(env: MarketplaceEnv, cors: Headers, listingId: string) {
  const result = await env.DB.prepare(
    `SELECT li.id, li.listing_id, li.media_asset_id, li.alt_ar, li.sort_order, li.created_at
      FROM listing_images li JOIN media_assets m ON m.id = li.media_asset_id
      WHERE li.listing_id = ? AND m.status = 'ready' ORDER BY li.sort_order, li.id`,
  )
    .bind(listingId)
    .all();
  return result.success ? json({ data: result.results ?? [] }, 200, cors) : databaseError(cors);
}

async function reorderImages(
  request: Request,
  env: MarketplaceEnv,
  cors: Headers,
  listingId: string,
) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  const listing = await env.DB.prepare("SELECT owner_id, status FROM listings WHERE id = ?")
    .bind(listingId)
    .first<{ owner_id: string; status: string }>();
  if (!listing || listing.owner_id !== auth.userId) return forbidden(cors);
  if (!["draft", "rejected"].includes(listing.status)) return forbidden(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const imageIds = Array.isArray(body.data.imageIds)
    ? body.data.imageIds.filter((id): id is string => typeof id === "string")
    : [];
  const stored = await env.DB.prepare(
    "SELECT id FROM listing_images WHERE listing_id = ? ORDER BY sort_order, id",
  )
    .bind(listingId)
    .all<{ id: string }>();
  const storedIds = (stored.results ?? []).map((row) => row.id);
  if (
    imageIds.length !== storedIds.length ||
    new Set(imageIds).size !== imageIds.length ||
    storedIds.some((id) => !imageIds.includes(id))
  ) {
    return validation(cors, "Image order must contain every listing image exactly once.");
  }
  const temporary = await env.DB.batch(
    imageIds.map((id, index) =>
      env.DB.prepare(
        "UPDATE listing_images SET sort_order = ? WHERE id = ? AND listing_id = ?",
      ).bind(MAX_IMAGES + 100 + index, id, listingId),
    ),
  );
  if (temporary.some((result) => !result.success)) return databaseError(cors);
  const final = await env.DB.batch(
    imageIds.map((id, index) =>
      env.DB.prepare(
        "UPDATE listing_images SET sort_order = ? WHERE id = ? AND listing_id = ?",
      ).bind(index, id, listingId),
    ),
  );
  return final.every((result) => result.success)
    ? listImages(env, cors, listingId)
    : databaseError(cors);
}

async function deleteImage(request: Request, env: MarketplaceEnv, cors: Headers, imageId: string) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  const row = await env.DB.prepare(
    `SELECT li.listing_id, m.id AS asset_id, m.object_key, m.owner_id, l.owner_id AS listing_owner
      FROM listing_images li JOIN media_assets m ON m.id = li.media_asset_id
      JOIN listings l ON l.id = li.listing_id WHERE li.id = ?`,
  )
    .bind(imageId)
    .first<Row>();
  if (!row || row.owner_id !== auth.userId || row.listing_owner !== auth.userId)
    return forbidden(cors);
  await env.MEDIA.delete(String(row.object_key));
  const results = await env.DB.batch([
    env.DB.prepare("DELETE FROM listing_images WHERE id = ?").bind(imageId),
    env.DB.prepare("DELETE FROM media_assets WHERE id = ? AND owner_id = ?").bind(
      String(row.asset_id),
      auth.userId,
    ),
  ]);
  return results.every((result) => result.success)
    ? json({ data: { success: true } }, 200, cors)
    : databaseError(cors);
}

async function privateMedia(
  request: Request,
  env: MarketplaceEnv,
  cors: Headers,
  assetId: string,
) {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  const asset = await env.DB.prepare(
    `SELECT object_key, content_type, etag FROM media_assets
      WHERE id = ? AND owner_id = ? AND status = 'ready'`,
  )
    .bind(assetId, auth.userId)
    .first<Row>();
  if (!asset) {
    return json({ error: { code: "not_found", message: "Media not found." } }, 404, cors);
  }
  const object = await env.MEDIA.get(String(asset.object_key));
  if (!object) {
    return json({ error: { code: "not_found", message: "Media not found." } }, 404, cors);
  }
  const headers = new Headers(cors);
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", String(asset.content_type));
  headers.set("ETag", object.httpEtag || String(asset.etag ?? ""));
  headers.set("Cache-Control", "private, max-age=3600");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(object.body, { status: 200, headers });
}

async function parseListing(request: Request, env: MarketplaceEnv, cors: Headers) {
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const categoryId = clean(body.data.categoryId, 120);
  const governorateId = clean(body.data.governorateId, 120);
  const title = clean(body.data.title, 160);
  const description = clean(body.data.description, 5000) ?? "";
  if (!categoryId || !governorateId || !title || title.length < 3)
    return validation(cors, "Invalid listing.");
  const refs = await env.DB.prepare(
    `SELECT EXISTS(SELECT 1 FROM categories WHERE id = ? AND is_active = 1) category_ok,
      EXISTS(SELECT 1 FROM governorates WHERE id = ? AND is_active = 1) governorate_ok`,
  )
    .bind(categoryId, governorateId)
    .first<{ category_ok: number; governorate_ok: number }>();
  if (!refs?.category_ok || !refs.governorate_ok) return validation(cors, "Invalid references.");
  const subcategoryId = clean(body.data.subcategoryId, 120);
  if (subcategoryId) {
    const sub = await env.DB.prepare(
      "SELECT id FROM subcategories WHERE id = ? AND category_id = ?",
    )
      .bind(subcategoryId, categoryId)
      .first();
    if (!sub) return validation(cors, "Invalid subcategory.");
  }
  const locationNodeId = clean(body.data.locationNodeId, 160);
  if (locationNodeId) {
    const location = await env.DB.prepare(
      "SELECT id FROM location_nodes WHERE id = ? AND is_active = 1",
    )
      .bind(locationNodeId)
      .first();
    if (!location) return validation(cors, "Invalid location.");
  }
  const price = numberOrNull(body.data.price);
  if (price !== null && (price < 0 || price > 1e15)) return validation(cors, "Invalid price.");
  const details =
    body.data.details && typeof body.data.details === "object" && !Array.isArray(body.data.details)
      ? (body.data.details as Row)
      : {};
  return {
    categoryId,
    subcategoryId,
    governorateId,
    locationNodeId,
    title,
    description,
    price,
    priceType: allowed(body.data.priceType, ["fixed", "negotiable", "contact"], "fixed"),
    condition: clean(body.data.condition, 40) ?? "not_applicable",
    districtAr: clean(body.data.districtAr, 160),
    contactName: clean(body.data.contactName, 120),
    details,
    submit: body.data.submit === true,
  };
}

function normalizeProfile(data: Row) {
  const firstName = clean(data.firstName, 40);
  const lastName = clean(data.lastName, 40);
  const displayName =
    clean(data.displayName, 120) ?? [firstName, lastName].filter(Boolean).join(" ");
  const preferred = clean(data.preferredContactMethod, 20);
  if (
    !displayName ||
    displayName.length < 2 ||
    (preferred && !["phone", "whatsapp", "chat"].includes(preferred))
  )
    return null;
  return {
    firstName,
    lastName,
    displayName,
    governorate: clean(data.governorate, 120),
    cityArea: clean(data.cityArea, 80),
    bio: clean(data.bio, 600),
    businessName: clean(data.businessName, 120),
    phone: clean(data.phone, 40),
    whatsapp: clean(data.whatsapp, 40),
    preferredContactMethod: preferred,
  };
}
function mapProfile(row: Row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    firstName: row.first_name,
    lastName: row.last_name,
    businessName: row.business_name,
    bio: row.bio,
    governorate: row.governorate,
    cityArea: row.city_area,
    phone: row.phone,
    whatsapp: row.whatsapp,
    preferredContactMethod: row.preferred_contact_method,
    verificationStatus: row.verification_status,
    accountStatus: row.account_status,
    avatarAssetId: row.avatar_asset_id,
    coverAssetId: row.cover_asset_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function matchesImageSignature(bytes: Uint8Array, type: string) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png")
    return bytes
      .slice(0, 8)
      .every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index]);
  if (type === "image/webp")
    return (
      new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
    );
  return false;
}
async function sha256Hex(bytes: Uint8Array) {
  const input = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", input)))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}
function addFilter(where: string[], values: Value[], column: string, value: string | null) {
  if (value) {
    where.push(`${column} = ?`);
    values.push(value);
  }
}
function clean(value: unknown, max: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}
function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function integer(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}
function allowed(value: unknown, choices: string[], fallback: string) {
  return typeof value === "string" && choices.includes(value) ? value : fallback;
}
function now() {
  return new Date().toISOString();
}
function validation(cors: Headers, message: string) {
  return json({ error: { code: "validation_error", message } }, 400, cors);
}
function unauthorized(cors: Headers) {
  return json({ error: { code: "auth_required", message: "Authentication required." } }, 401, cors);
}
function forbidden(cors: Headers) {
  return json({ error: { code: "permission_denied", message: "Permission denied." } }, 403, cors);
}
function databaseError(cors: Headers) {
  return json(
    { error: { code: "database_unavailable", message: "Data service unavailable." } },
    503,
    cors,
  );
}
