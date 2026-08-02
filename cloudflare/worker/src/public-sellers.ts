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
}

interface Database {
  prepare(query: string): Statement;
}

export interface PublicSellersEnv {
  DB: Database;
  API_CACHE_SECONDS?: string;
}

const LISTING_LIMIT = 24;
const REVIEW_DISPLAY_LIMIT = 6;
const REVIEW_SUMMARY_LIMIT = 500;
const SELLER_SEARCH_LIMIT = 20;

export async function handlePublicSellers(
  request: Request,
  env: PublicSellersEnv,
): Promise<Response | null> {
  const url = new URL(request.url);

  if (url.pathname === "/v1/sellers") {
    if (request.method !== "GET") {
      return json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, 405);
    }
    return searchPublicSellers(url, env);
  }

  const match = url.pathname.match(/^\/v1\/sellers\/([^/]+)$/);
  if (!match) return null;
  if (request.method !== "GET") {
    return json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, 405);
  }

  const sellerId = decodeURIComponent(match[1]).trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sellerId)
  ) {
    return json({ error: { code: "validation_error", message: "Invalid seller id." } }, 400);
  }

  const [profile, inventory, reviewsResult] = await Promise.all([
    env.DB.prepare(
      `SELECT p.id, p.display_name, p.business_name, p.bio, p.governorate,
        p.verification_status, p.account_status, p.avatar_asset_id, p.cover_asset_id,
        p.created_at
       FROM public_profiles p
       WHERE p.id = ?
       LIMIT 1`,
    )
      .bind(sellerId)
      .first<Row>(),
    env.DB.prepare(
      `SELECT l.id, l.owner_id, l.category_id, l.subcategory_id, l.governorate_id,
        l.title, l.description, l.price, l.currency, l.price_type, l.listing_condition,
        l.status, l.district_ar, l.contact_name, l.contact_options, l.details,
        l.is_featured, l.featured_until, l.published_at, l.reserved_at, l.expires_at,
        l.renewed_at, l.expiry_days, l.created_at, l.updated_at,
        c.name_ar AS category_name_ar, c.placeholder AS category_placeholder,
        g.name_ar AS governorate_name_ar,
        (SELECT li.media_asset_id FROM listing_images li WHERE li.listing_id = l.id
          ORDER BY li.sort_order ASC, li.id ASC LIMIT 1) AS primary_media_asset_id
       FROM listings l
       JOIN categories c ON c.id = l.category_id
       JOIN governorates g ON g.id = l.governorate_id
       WHERE l.owner_id = ? AND l.status = 'approved' AND l.archived_at IS NULL
         AND (l.expires_at IS NULL OR l.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
       ORDER BY l.created_at DESC, l.id DESC
       LIMIT ?`,
    )
      .bind(sellerId, LISTING_LIMIT)
      .all<Row>(),
    env.DB.prepare(
      `SELECT id, rating, comment, traits, seller_response, seller_response_updated_at, created_at
       FROM seller_reviews
       WHERE seller_id = ? AND status = 'approved'
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    )
      .bind(sellerId, REVIEW_SUMMARY_LIMIT)
      .all<Row>(),
  ]);

  if (!inventory.success || !reviewsResult.success) {
    console.error("rawaj_public_seller_database_error", inventory.error ?? reviewsResult.error);
    return json(
      { error: { code: "database_unavailable", message: "Data service unavailable." } },
      503,
    );
  }

  const listingRows = inventory.results ?? [];
  if (!profile && listingRows.length === 0) {
    return json({ error: { code: "not_found", message: "Seller not found." } }, 404);
  }

  const requestOrigin = url.origin;
  const reviews = (reviewsResult.results ?? []).map(mapReview);
  const summary = ratingSummary(reviews);
  const firstListing = listingRows[0];

  return json(
    {
      data: {
        id: sellerId,
        displayName:
          cleanText(profile?.display_name, 120) ??
          cleanText(firstListing?.contact_name, 120) ??
          "بائع رواج",
        verified: stringValue(profile?.verification_status) === "verified",
        joinedAt:
          nullableString(profile?.created_at) ?? nullableString(listingRows.at(-1)?.created_at),
        locationAr:
          cleanText(profile?.governorate, 120) ?? nullableString(firstListing?.governorate_name_ar),
        bio: cleanText(profile?.bio, 1000),
        businessName: cleanText(profile?.business_name, 120),
        avatarUrl: mediaUrl(requestOrigin, profile?.avatar_asset_id),
        coverUrl: mediaUrl(requestOrigin, profile?.cover_asset_id),
        approvedListingCount: listingRows.length,
        inventoryStatus: "ready",
        listingDisplayLimit: LISTING_LIMIT,
        ratingSummary: summary,
        reviews: reviews.slice(0, REVIEW_DISPLAY_LIMIT),
        reviewsStatus: "ready",
        approvedReviewCount: summary.count,
        reviewDisplayLimit: REVIEW_DISPLAY_LIMIT,
        listings: listingRows.map((row) => mapListing(row, requestOrigin)),
      },
    },
    200,
    cacheHeaders(env),
  );
}

async function searchPublicSellers(url: URL, env: PublicSellersEnv): Promise<Response> {
  const query = cleanText(url.searchParams.get("q"), 120);
  if (!query || query.length < 2) return json({ data: [] }, 200, cacheHeaders(env));
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") ?? "8", 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(requestedLimit, SELLER_SEARCH_LIMIT))
    : 8;
  const pattern = `%${escapeLike(query.toLowerCase())}%`;
  const result = await env.DB.prepare(
    `SELECT p.id, p.display_name, p.first_name, p.last_name, p.business_name,
      p.governorate, p.bio, p.avatar_asset_id,
      COUNT(l.id) AS approved_listing_count
     FROM public_profiles p
     JOIN listings l ON l.owner_id = p.id
       AND l.status = 'approved'
       AND l.archived_at IS NULL
       AND (l.expires_at IS NULL OR l.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     WHERE p.account_status = 'active'
       AND (
         lower(COALESCE(p.display_name, '')) LIKE ? ESCAPE '\\'
         OR lower(COALESCE(p.business_name, '')) LIKE ? ESCAPE '\\'
         OR lower(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) LIKE ? ESCAPE '\\'
       )
     GROUP BY p.id
     ORDER BY approved_listing_count DESC, p.updated_at DESC, p.id ASC
     LIMIT ?`,
  )
    .bind(pattern, pattern, pattern, limit)
    .all<Row>();

  if (!result.success) {
    console.error("rawaj_public_seller_search_database_error", result.error);
    return json(
      { error: { code: "database_unavailable", message: "Data service unavailable." } },
      503,
    );
  }

  return json(
    {
      data: (result.results ?? []).map((row) => ({
        id: stringValue(row.id),
        displayName:
          cleanText(row.display_name, 120) ?? cleanText(row.business_name, 120) ?? "معلن على رواج",
        firstName: cleanText(row.first_name, 80),
        lastName: cleanText(row.last_name, 80),
        businessName: cleanText(row.business_name, 120),
        governorate: cleanText(row.governorate, 120),
        bio: cleanText(row.bio, 500),
        avatarUrl: mediaUrl(url.origin, row.avatar_asset_id),
        approvedListingCount: Math.max(0, numberValue(row.approved_listing_count)),
      })),
    },
    200,
    cacheHeaders(env),
  );
}

function mapReview(row: Row) {
  const rating = clampRating(numberValue(row.rating));
  return {
    id: stringValue(row.id),
    rating,
    comment: cleanText(row.comment, 1200),
    traits: jsonStringArray(row.traits),
    sellerResponse: cleanText(row.seller_response, 800),
    sellerResponseUpdatedAt: nullableString(row.seller_response_updated_at),
    createdAt: stringValue(row.created_at),
  };
}

function ratingSummary(reviews: Array<{ rating: number }>) {
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  for (const review of reviews) {
    const rating = clampRating(review.rating) as 1 | 2 | 3 | 4 | 5;
    distribution[rating] += 1;
    total += rating;
  }
  return {
    average: reviews.length ? Number((total / reviews.length).toFixed(1)) : null,
    count: reviews.length,
    distribution,
  };
}

function mapListing(row: Row, origin: string) {
  return {
    id: stringValue(row.id),
    ownerId: stringValue(row.owner_id),
    categoryId: stringValue(row.category_id),
    subcategoryId: nullableString(row.subcategory_id),
    categoryNameAr: nullableString(row.category_name_ar),
    categoryPlaceholder: nullableString(row.category_placeholder),
    governorateId: stringValue(row.governorate_id),
    governorateNameAr: nullableString(row.governorate_name_ar),
    title: stringValue(row.title),
    description: stringValue(row.description),
    price: nullableNumber(row.price),
    currency: "SAR",
    priceType: stringValue(row.price_type, "fixed"),
    condition: stringValue(row.listing_condition, "not_applicable"),
    status: "approved",
    districtAr: nullableString(row.district_ar),
    contactName: nullableString(row.contact_name),
    contactOptions: jsonObject(row.contact_options),
    details: sanitizeDetails(jsonObject(row.details)),
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
    primaryImageUrl: mediaUrl(origin, row.primary_media_asset_id),
  };
}

function mediaUrl(origin: string, assetId: unknown): string | null {
  const id = nullableString(assetId);
  return id ? `${origin}/v1/media/assets/${encodeURIComponent(id)}` : null;
}

function sanitizeDetails(details: Row): Row {
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

function cacheHeaders(env: PublicSellersEnv): Headers {
  const parsed = Number.parseInt(env.API_CACHE_SECONDS ?? "60", 10);
  const seconds = Number.isFinite(parsed) && parsed >= 0 ? parsed : 60;
  return new Headers({
    "Cache-Control":
      seconds > 0
        ? `public, max-age=${seconds}, stale-while-revalidate=${Math.max(seconds, 300)}`
        : "no-store",
    Vary: "Origin",
  });
}

function json(payload: unknown, status: number, extra?: Headers): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  extra?.forEach((value, key) => headers.set(key, value));
  return new Response(JSON.stringify(payload), { status, headers });
}

function cleanText(value: unknown, maxLength: number): string | null {
  const clean = nullableString(value)?.trim() ?? "";
  return clean ? clean.slice(0, maxLength) : null;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = numberValue(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampRating(value: number): number {
  return Math.min(5, Math.max(1, Math.round(value)));
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function jsonStringArray(value: unknown): string[] {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string").slice(0, 3)
      : [];
  } catch {
    return [];
  }
}

function jsonObject(value: unknown): Row {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Row;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Row) : {};
  } catch {
    return {};
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}
