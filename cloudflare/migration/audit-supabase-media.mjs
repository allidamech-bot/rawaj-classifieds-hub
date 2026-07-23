#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import postgres from "postgres";

const databaseUrl = process.env.SUPABASE_DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("SUPABASE_DATABASE_URL is required.");

const outputPath = resolve(
  process.env.RAWAJ_MEDIA_AUDIT_OUTPUT?.trim() ||
    "cloudflare/snapshots/latest/supabase-media-audit.json",
);
const maxReferencedBytes = Number.parseInt(
  process.env.RAWAJ_MAX_REFERENCED_MEDIA_BYTES || String(250 * 1024 * 1024),
  10,
);

const sql = postgres(databaseUrl, {
  max: 1,
  ssl: "require",
  idle_timeout: 20,
  connect_timeout: 20,
  prepare: false,
});

const referenceSql = sql`
  WITH refs AS (
    SELECT 'listing-images'::text AS bucket_id, storage_path::text AS name,
           'listing_image'::text AS source
      FROM public.listing_images
     WHERE storage_path IS NOT NULL AND btrim(storage_path) <> ''
    UNION ALL
    SELECT 'profile-media', avatar_path, 'profile_avatar'
      FROM public.profiles
     WHERE avatar_path IS NOT NULL AND btrim(avatar_path) <> ''
    UNION ALL
    SELECT 'profile-media', cover_path, 'profile_cover'
      FROM public.profiles
     WHERE cover_path IS NOT NULL AND btrim(cover_path) <> ''
    UNION ALL
    SELECT CASE WHEN attachment_kind = 'audio'
                THEN 'conversation-audio' ELSE 'conversation-images' END,
           attachment_path, 'conversation_attachment'
      FROM public.conversation_messages
     WHERE attachment_path IS NOT NULL AND btrim(attachment_path) <> ''
    UNION ALL
    SELECT 'verification-documents', document_path, 'verification_document'
      FROM public.seller_verification_requests
     WHERE document_path IS NOT NULL AND btrim(document_path) <> ''
    UNION ALL
    SELECT 'promotion-receipts', proof_path, 'promotion_receipt'
      FROM public.listing_promotion_requests
     WHERE proof_path IS NOT NULL AND btrim(proof_path) <> ''
    UNION ALL
    SELECT 'ad-placement-media',
           regexp_replace(image_url, '^.*/object/public/ad-placement-media/', ''),
           'ad_placement'
      FROM public.ad_placements
     WHERE image_url LIKE '%/object/public/ad-placement-media/%'
  )
  SELECT DISTINCT bucket_id, name, source FROM refs
`;

const objectSql = sql`
  SELECT bucket_id, name,
         COALESCE((metadata->>'size')::bigint, 0) AS size_bytes,
         metadata->>'mimetype' AS content_type,
         metadata->>'eTag' AS etag,
         created_at, updated_at
    FROM storage.objects
   ORDER BY bucket_id, name
`;

try {
  const [references, objects] = await Promise.all([referenceSql, objectSql]);
  const referenceKeys = new Map(
    references.map((row) => [`${row.bucket_id}\n${row.name}`, row]),
  );
  const objectKeys = new Map(
    objects.map((row) => [`${row.bucket_id}\n${row.name}`, row]),
  );

  const referenced = [];
  const orphaned = [];
  for (const object of objects) {
    const key = `${object.bucket_id}\n${object.name}`;
    const reference = referenceKeys.get(key);
    const item = {
      bucketId: object.bucket_id,
      name: object.name,
      sizeBytes: Number(object.size_bytes || 0),
      contentType: object.content_type || null,
      etag: object.etag || null,
      createdAt: object.created_at,
      updatedAt: object.updated_at,
      source: reference?.source || null,
    };
    (reference ? referenced : orphaned).push(item);
  }

  const missing = references
    .filter((row) => !objectKeys.has(`${row.bucket_id}\n${row.name}`))
    .map((row) => ({ bucketId: row.bucket_id, name: row.name, source: row.source }));

  const duplicateGroups = [...groupBy(objects, (row) => `${row.bucket_id}\n${row.etag || ""}\n${row.size_bytes}`)]
    .map(([key, rows]) => ({ key, rows }))
    .filter(({ rows }) => rows.length > 1 && rows[0].etag)
    .map(({ rows }) => ({
      bucketId: rows[0].bucket_id,
      etag: rows[0].etag,
      sizeBytes: Number(rows[0].size_bytes || 0),
      objects: rows.map((row) => ({
        name: row.name,
        referenced: referenceKeys.has(`${row.bucket_id}\n${row.name}`),
      })),
    }));

  const totals = {
    objectCount: objects.length,
    totalBytes: sumBytes(objects),
    referencedCount: referenced.length,
    referencedBytes: sumBytes(referenced),
    orphanCount: orphaned.length,
    orphanBytes: sumBytes(orphaned),
    missingReferenceCount: missing.length,
  };

  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    migrationPolicy: "database-reference-allowlist-only",
    totals,
    byBucket: summarizeBuckets(objects, referenceKeys),
    referenced,
    orphaned,
    missing,
    duplicateGroups,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ outputPath, totals }, null, 2));

  if (missing.length > 0) throw new Error("Referenced media is missing from Supabase Storage.");
  if (totals.referencedBytes > maxReferencedBytes) {
    throw new Error(
      `Referenced media ${totals.referencedBytes} exceeds safety ceiling ${maxReferencedBytes}.`,
    );
  }
} finally {
  await sql.end({ timeout: 5 });
}

function groupBy(rows, keyFor) {
  const result = new Map();
  for (const row of rows) {
    const key = keyFor(row);
    const group = result.get(key) || [];
    group.push(row);
    result.set(key, group);
  }
  return result;
}

function sumBytes(rows) {
  return rows.reduce((sum, row) => sum + Number(row.size_bytes ?? row.sizeBytes ?? 0), 0);
}

function summarizeBuckets(objects, referenceKeys) {
  const buckets = new Map();
  for (const object of objects) {
    const current = buckets.get(object.bucket_id) || {
      bucketId: object.bucket_id,
      objectCount: 0,
      totalBytes: 0,
      referencedCount: 0,
      referencedBytes: 0,
      orphanCount: 0,
      orphanBytes: 0,
    };
    const size = Number(object.size_bytes || 0);
    const referenced = referenceKeys.has(`${object.bucket_id}\n${object.name}`);
    current.objectCount += 1;
    current.totalBytes += size;
    if (referenced) {
      current.referencedCount += 1;
      current.referencedBytes += size;
    } else {
      current.orphanCount += 1;
      current.orphanBytes += size;
    }
    buckets.set(object.bucket_id, current);
  }
  return [...buckets.values()].sort((a, b) => b.totalBytes - a.totalBytes);
}
