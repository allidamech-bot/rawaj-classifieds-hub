#!/usr/bin/env node
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
  "../../cloudflare/snapshots/essential",
);

await mkdir(outputDir, { recursive: true });

const sql = postgres(databaseUrl, {
  max: 1,
  ssl: "require",
  prepare: false,
  connect_timeout: 30,
  idle_timeout: 30,
});

const batchId = `essential-${new Date()
  .toISOString()
  .replace(/[-:.TZ]/g, "")}`;

const source = {};
const connection = await sql.reserve();

try {
  await connection.unsafe(
    "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
  );

  source.users = await connection.unsafe(`
    SELECT
      id,
      email,
      email_confirmed_at,
      banned_until,
      last_sign_in_at,
      created_at,
      updated_at,
      deleted_at
    FROM auth.users
    WHERE email IS NOT NULL
    ORDER BY created_at, id
  `);

  source.identities = await connection.unsafe(`
    SELECT
      id,
      user_id,
      provider,
      provider_id,
      email,
      identity_data,
      created_at,
      updated_at
    FROM auth.identities
    ORDER BY created_at, id
  `);

  source.profiles = await connection.unsafe(`
    SELECT *
    FROM public.profiles
    ORDER BY created_at, id
  `);

  source.roles = await connection.unsafe(`
    SELECT *
    FROM public.user_roles
    ORDER BY assigned_at, user_id
  `);

  const publicTables = [
    "categories",
    "subcategories",
    "governorates",
    "taxonomy_nodes",
    "option_sets",
    "option_values",
    "field_definitions",
    "vehicle_makes",
    "vehicle_models",
    "vehicle_generations",
    "vehicle_trims",
    "location_regions",
    "location_nodes",
    "location_region_members",
    "location_search_aliases",
    "listings",
    "listing_taxonomy_assignments",
    "conversations",
    "conversation_messages",
    "seller_reviews",
    "support_requests",
  ];

  for (const table of publicTables) {
    source[table] = await connection.unsafe(
      `SELECT * FROM public.${table}`,
    );
  }

  await connection.unsafe("COMMIT");
} catch (error) {
  await connection.unsafe("ROLLBACK").catch(() => {});
  throw error;
} finally {
  connection.release();
  await sql.end({ timeout: 5 });
}

const userIds = new Set(source.users.map((row) => String(row.id)));
const listingIds = new Set(
  source.listings
    .filter((row) => userIds.has(String(row.owner_id)))
    .map((row) => String(row.id)),
);

const profilesById = new Map(
  source.profiles.map((row) => [String(row.id), row]),
);

const statements = [
  "PRAGMA foreign_keys = ON;",
  "BEGIN TRANSACTION;",
  insert("rawaj_import_batches", {
    id: batchId,
    source_system: "supabase",
    source_snapshot_at: new Date().toISOString(),
    source_checksum_sha256: batchId,
    status: "importing",
    counts_json: JSON.stringify(
      Object.fromEntries(
        Object.entries(source).map(([key, rows]) => [
          key,
          rows.length,
        ]),
      ),
    ),
    started_at: new Date().toISOString(),
  }),
];

const tableSpecs = {
  categories: [
    "id",
    "slug",
    "name_ar",
    "name_en",
    "hint_ar",
    "hint_en",
    "placeholder",
    "sort_order",
    "is_active",
    "created_at",
    "updated_at",
  ],
  subcategories: [
    "id",
    "category_id",
    "name_ar",
    "name_en",
    "sort_order",
    "created_at",
    "updated_at",
  ],
  governorates: [
    "id",
    "slug",
    "name_ar",
    "name_en",
    "districts_ar",
    "districts_en",
    "sort_order",
    "is_active",
    "created_at",
    "updated_at",
  ],
  taxonomy_nodes: [
    "id",
    "parent_id",
    "slug",
    "name_ar",
    "name_en",
    "description_ar",
    "description_en",
    "icon_key",
    "sort_order",
    "depth",
    "is_active",
    "is_leaf",
    "filter_schema_key",
    "classification_key",
    "classification_value",
    "legacy_category_id",
    "legacy_subcategory_id",
    "created_at",
    "updated_at",
  ],
  option_sets: [
    "key",
    "name_ar",
    "name_en",
    "description_ar",
    "description_en",
    "provider_key",
    "is_active",
    "created_at",
    "updated_at",
  ],
  option_values: [
    "option_set_key",
    "value_key",
    "label_ar",
    "label_en",
    "aliases",
    "sort_order",
    "is_active",
    "metadata",
    "created_at",
    "updated_at",
  ],
  field_definitions: [
    "key",
    "label_ar",
    "label_en",
    "description_ar",
    "description_en",
    "placeholder_ar",
    "placeholder_en",
    "field_type",
    "unit_key",
    "option_set_key",
    "data_provider_key",
    "validation_schema",
    "is_searchable",
    "is_filterable",
    "is_displayable",
    "is_sensitive",
    "is_active",
    "sort_order",
    "created_at",
    "updated_at",
  ],
  vehicle_makes: [
    "id",
    "slug",
    "name_ar",
    "name_en",
    "aliases",
    "country_code",
    "sort_order",
    "is_active",
    "metadata",
    "created_at",
    "updated_at",
  ],
  vehicle_models: [
    "id",
    "make_id",
    "slug",
    "name_ar",
    "name_en",
    "aliases",
    "vehicle_type",
    "start_year",
    "end_year",
    "sort_order",
    "is_active",
    "metadata",
    "created_at",
    "updated_at",
  ],
  vehicle_generations: [
    "id",
    "model_id",
    "slug",
    "name_ar",
    "name_en",
    "aliases",
    "start_year",
    "end_year",
    "sort_order",
    "is_active",
    "metadata",
    "created_at",
    "updated_at",
  ],
  vehicle_trims: [
    "id",
    "model_id",
    "generation_id",
    "slug",
    "name_ar",
    "name_en",
    "aliases",
    "start_year",
    "end_year",
    "sort_order",
    "is_active",
    "metadata",
    "created_at",
    "updated_at",
  ],
  location_regions: [
    "id",
    "country_code",
    "slug",
    "name_ar",
    "name_en",
    "region_type",
    "is_complete",
    "is_active",
    "source_name",
    "source_url",
    "source_note",
    "confidence",
    "review_status",
    "created_at",
    "updated_at",
  ],
  location_nodes: [
    "id",
    "parent_id",
    "country_code",
    "node_type",
    "name_ar",
    "name_en",
    "slug",
    "official_code",
    "external_source",
    "external_id",
    "latitude",
    "longitude",
    "sort_order",
    "depth",
    "is_active",
    "search_aliases",
    "legacy_governorate_id",
    "legacy_district_ar",
    "source_url",
    "source_date",
    "confidence",
    "review_status",
    "notes",
    "created_at",
    "updated_at",
  ],
  location_region_members: [
    "region_id",
    "location_node_id",
    "relation_type",
    "source_name",
    "source_url",
    "source_note",
    "confidence",
    "review_status",
    "created_at",
  ],
  location_search_aliases: [
    "id",
    "location_node_id",
    "alias",
    "normalized_alias",
    "language_code",
    "alias_type",
    "source_name",
    "source_url",
    "source_note",
    "confidence",
    "review_status",
    "created_at",
    "updated_at",
  ],
};

for (const [table, columns] of Object.entries(tableSpecs)) {
  let rows = source[table] ?? [];

  if (table === "taxonomy_nodes" || table === "location_nodes") {
    rows = [...rows].sort((a, b) =>
      Number(a.depth ?? 0) - Number(b.depth ?? 0) ||
      Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
    );
  }

  for (const row of rows) {
    statements.push(insert(table, pick(row, columns)));
  }
}

for (const user of source.users) {
  const profile = profilesById.get(String(user.id)) ?? {};

  statements.push(
    insert("public_profiles", {
      id: user.id,
      display_name:
        profile.display_name ??
        profile.business_name ??
        user.email?.split("@")[0] ??
        "مستخدم رواج",
      first_name: profile.first_name,
      last_name: profile.last_name,
      business_name: profile.business_name,
      bio: profile.bio,
      governorate: profile.governorate,
      city_area: profile.city_area,
      verification_status:
        profile.verification_status ?? "unverified",
      account_status:
        profile.account_status ?? "active",
      avatar_asset_id: null,
      cover_asset_id: null,
      created_at:
        profile.created_at ?? user.created_at,
      updated_at:
        profile.updated_at ?? user.updated_at,
      imported_batch_id: batchId,
    }),
  );
}

for (const user of source.users) {
  statements.push(
    insert("auth_users", {
      id: user.id,
      email: user.email,
      email_normalized: String(user.email).trim().toLowerCase(),

      // لا ننقل Supabase password hashes إلى نظام مصادقة مختلف.
      password_hash: null,
      password_algorithm: null,

      email_confirmed_at: user.email_confirmed_at,
      disabled_at:
        user.deleted_at ??
        (user.banned_until &&
        new Date(user.banned_until) > new Date()
          ? user.banned_until
          : null),
      last_sign_in_at: user.last_sign_in_at,
      created_at: user.created_at,
      updated_at: user.updated_at,
    }),
  );
}

for (const identity of source.identities) {
  if (!userIds.has(String(identity.user_id))) continue;

  statements.push(
    insert("auth_identities", {
      id: identity.id,
      user_id: identity.user_id,
      provider: identity.provider,
      provider_subject:
        identity.provider_id ?? identity.id,
      provider_email:
        identity.email ??
        identity.identity_data?.email ??
        null,
      identity_data:
        identity.identity_data ?? {},
      created_at: identity.created_at,
      updated_at: identity.updated_at,
    }),
  );
}

for (const role of source.roles) {
  if (!userIds.has(String(role.user_id))) continue;

  statements.push(
    insert("user_roles", {
      user_id: role.user_id,
      role: normalizeRole(role.role),
      created_at:
        role.assigned_at ??
        role.created_at ??
        new Date().toISOString(),
    }),
  );
}

for (const listing of source.listings) {
  if (!userIds.has(String(listing.owner_id))) continue;

  statements.push(
    insert("listings", {
      id: listing.id,
      owner_id: listing.owner_id,
      category_id: listing.category_id,
      subcategory_id: listing.subcategory_id,
      governorate_id: listing.governorate_id,
      location_node_id: listing.location_node_id,
      title: listing.title,
      description: listing.description,
      price: listing.price,
      currency: listing.currency,
      price_type: listing.price_type,
      listing_condition: listing.listing_condition,
      status: listing.status,
      district_ar: listing.district_ar,
      contact_name: listing.contact_name,
      contact_options: listing.contact_options ?? {},
      details: listing.details ?? {},
      is_featured: listing.is_featured,
      featured_until: listing.featured_until,
      published_at: listing.published_at,
      archived_at: listing.archived_at,
      reserved_at: listing.reserved_at,
      expires_at: listing.expires_at,
      renewed_at: listing.renewed_at,
      expiry_days: listing.expiry_days,
      search_text_normalized:
        listing.search_text_normalized,
      created_at: listing.created_at,
      updated_at: listing.updated_at,
      imported_batch_id: batchId,
    }),
  );
}

for (const assignment of source.listing_taxonomy_assignments) {
  if (!listingIds.has(String(assignment.listing_id))) continue;

  statements.push(
    insert("listing_taxonomy_assignments", {
      listing_id: assignment.listing_id,
      taxonomy_node_id: assignment.taxonomy_node_id,
      created_at: assignment.created_at,
    }),
  );
}

for (const conversation of source.conversations) {
  if (
    !userIds.has(String(conversation.buyer_user_id)) ||
    !userIds.has(String(conversation.seller_user_id))
  ) {
    continue;
  }

  statements.push(
    insert("conversations", {
      id: conversation.id,
      listing_id:
        conversation.listing_id &&
        listingIds.has(String(conversation.listing_id))
          ? conversation.listing_id
          : null,
      buyer_id: conversation.buyer_user_id,
      seller_id: conversation.seller_user_id,
      status: normalizeConversationStatus(
        conversation.status,
      ),
      last_message_at: conversation.last_message_at,
      created_at: conversation.created_at,
      updated_at: conversation.updated_at,
    }),
  );
}

const conversationIds = new Set(
  source.conversations
    .filter(
      (row) =>
        userIds.has(String(row.buyer_user_id)) &&
        userIds.has(String(row.seller_user_id)),
    )
    .map((row) => String(row.id)),
);

for (const message of source.conversation_messages) {
  if (
    !conversationIds.has(String(message.conversation_id)) ||
    !userIds.has(String(message.sender_user_id))
  ) {
    continue;
  }

  const hasAttachment = Boolean(message.attachment_path);
  const body =
    String(message.body ?? "").trim() ||
    (hasAttachment
      ? "[مرفق لم يتم نقله]"
      : "[رسالة فارغة]");

  statements.push(
    insert("conversation_messages", {
      id: message.id,
      conversation_id: message.conversation_id,
      sender_id: message.sender_user_id,
      body,
      message_type: "text",
      media_asset_id: null,
      delivered_at: message.created_at,
      read_at: null,
      deleted_at: message.deleted_at,
      created_at: message.created_at,
    }),
  );
}

for (const review of source.seller_reviews) {
  if (
    !userIds.has(String(review.seller_user_id)) ||
    !userIds.has(String(review.reviewer_user_id))
  ) {
    continue;
  }

  statements.push(
    insert("seller_reviews", {
      id: review.id,
      seller_id: review.seller_user_id,
      reviewer_id: review.reviewer_user_id,
      listing_id:
        review.related_listing_id &&
        listingIds.has(String(review.related_listing_id))
          ? review.related_listing_id
          : null,
      rating: review.rating,
      comment: review.comment,
      status: normalizeReviewStatus(review.status),
      created_at: review.created_at,
      updated_at: review.updated_at,
    }),
  );
}

const usersById = new Map(
  source.users.map((user) => [String(user.id), user]),
);

for (const request of source.support_requests) {
  const userExists =
    request.user_id &&
    userIds.has(String(request.user_id));

  const reviewerExists =
    request.reviewed_by &&
    userIds.has(String(request.reviewed_by));

  statements.push(
    insert("support_requests", {
      id: request.id,
      user_id: userExists ? request.user_id : null,
      email: userExists
        ? usersById.get(String(request.user_id))?.email ?? null
        : null,
      subject:
        request.subject ??
        request.type ??
        "طلب دعم",
      message: request.message,
      status: normalizeSupportStatus(request.status),
      priority: "normal",
      assigned_to:
        reviewerExists ? request.reviewed_by : null,
      created_at: request.created_at,
      updated_at: request.updated_at,
    }),
  );
}

statements.push(
  `UPDATE rawaj_import_batches
   SET status = 'verified',
       completed_at = ${literal(new Date().toISOString())}
   WHERE id = ${literal(batchId)};`,
);

statements.push("COMMIT;");

const outputFile = resolve(outputDir, "essential-data.sql");

await writeFile(
  outputFile,
  `${statements.join("\n")}\n`,
  "utf8",
);

console.log(
  JSON.stringify(
    {
      batchId,
      outputFile,
      counts: Object.fromEntries(
        Object.entries(source).map(([key, rows]) => [
          key,
          rows.length,
        ]),
      ),
      excluded: [
        "listing_images",
        "media_assets",
        "storage objects",
        "ad_placements",
        "notifications",
        "sessions",
        "one-time tokens",
        "audit logs",
      ],
    },
    null,
    2,
  ),
);

function pick(row, columns) {
  return Object.fromEntries(
    columns.map((column) => [column, row[column]]),
  );
}

function insert(table, values) {
  const entries = Object.entries(values);
  const columns = entries
    .map(([key]) => `"${key.replaceAll('"', '""')}"`)
    .join(", ");

  const data = entries
    .map(([, value]) => literal(value))
    .join(", ");

  return `INSERT OR IGNORE INTO "${table}" (${columns}) VALUES (${data});`;
}

function literal(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }

  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "NULL";
  }

  if (value instanceof Date) {
    return quote(value.toISOString());
  }

  if (typeof value === "object") {
    return quote(JSON.stringify(value));
  }

  return quote(String(value));
}

function quote(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function normalizeRole(role) {
  const value = String(role ?? "").toLowerCase();

  const allowed = new Set([
    "owner",
    "admin",
    "moderator",
    "seller",
    "user",
  ]);

  if (allowed.has(value)) return value;
  if (value === "super_admin") return "owner";

  return "user";
}

function normalizeConversationStatus(status) {
  const value = String(status ?? "").toLowerCase();

  if (
    ["active", "archived", "blocked", "closed"].includes(value)
  ) {
    return value;
  }

  return "active";
}

function normalizeReviewStatus(status) {
  const value = String(status ?? "").toLowerCase();

  if (
    ["pending", "approved", "rejected", "removed"].includes(value)
  ) {
    return value;
  }

  return "pending";
}

function normalizeSupportStatus(status) {
  const value = String(status ?? "").toLowerCase();

  if (
    ["open", "in_progress", "resolved", "closed"].includes(value)
  ) {
    return value;
  }

  if (value === "pending" || value === "new") {
    return "open";
  }

  return "open";
}




