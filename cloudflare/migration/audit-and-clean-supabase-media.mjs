#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const APPLY_CONFIRMATION = "DELETE_CONFIRMED_ORPHAN_MEDIA";
const MAX_DELETE_OBJECTS = 20;
const MAX_DELETE_BYTES = 64 * 1024 * 1024;
const KNOWN_BUCKETS = new Set([
  "listing-images",
  "profile-media",
  "ad-placement-media",
  "conversation-images",
  "conversation-audio",
  "promotion-receipts",
  "verification-documents",
]);

const options = parseArguments(process.argv.slice(2));
const databaseUrl = requiredEnvironment("SUPABASE_DATABASE_URL");
const outputPath = resolve(
  options.output ??
    `cloudflare/snapshots/media-audit-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
);

const sql = postgres(databaseUrl, {
  max: 1,
  ssl: "require",
  idle_timeout: 20,
  connect_timeout: 20,
  prepare: false,
});

let before;
try {
  before = await auditMedia(sql);
} finally {
  await sql.end({ timeout: 5 });
}

const orphanObjects = before.objects.filter((object) => object.referenceCount === 0);
const orphanBytes = orphanObjects.reduce((total, object) => total + object.bytes, 0);
const report = {
  generatedAt: new Date().toISOString(),
  mode: options.apply ? "apply" : "audit",
  limits: {
    maxDeleteObjects: MAX_DELETE_OBJECTS,
    maxDeleteBytes: MAX_DELETE_BYTES,
  },
  summary: summarize(before.objects),
  orphanSummary: {
    count: orphanObjects.length,
    bytes: orphanBytes,
  },
  orphanObjects,
  deletion: null,
};

if (!options.apply) {
  await writeJson(outputPath, report);
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

if (options.confirmation !== APPLY_CONFIRMATION) {
  throw new Error(`Apply mode requires --confirmation=${APPLY_CONFIRMATION}.`);
}
if (orphanObjects.length < 1) {
  throw new Error("No orphaned media objects were found; refusing an empty cleanup run.");
}
if (orphanObjects.length > MAX_DELETE_OBJECTS) {
  throw new Error(
    `Refusing to delete ${orphanObjects.length} objects; maximum is ${MAX_DELETE_OBJECTS}.`,
  );
}
if (orphanBytes > MAX_DELETE_BYTES) {
  throw new Error(
    `Refusing to delete ${orphanBytes} bytes; maximum is ${MAX_DELETE_BYTES}.`,
  );
}
if (orphanObjects.some((object) => !KNOWN_BUCKETS.has(object.bucketId))) {
  throw new Error("Audit found an orphan in an unknown bucket; manual review is required.");
}

const supabase = createClient(
  requiredEnvironment("SUPABASE_URL"),
  requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);

const deletionResults = [];
for (const [bucketId, objects] of groupByBucket(orphanObjects)) {
  const paths = objects.map((object) => object.name);
  const { data, error } = await supabase.storage.from(bucketId).remove(paths);
  if (error) {
    throw new Error(`Storage API failed to delete ${bucketId}: ${error.message}`);
  }
  deletionResults.push({
    bucketId,
    requestedPaths: paths,
    deletedPaths: (data ?? []).map((item) => item.name),
  });
}

const verifySql = postgres(databaseUrl, {
  max: 1,
  ssl: "require",
  idle_timeout: 20,
  connect_timeout: 20,
  prepare: false,
});
let after;
try {
  after = await auditMedia(verifySql);
} finally {
  await verifySql.end({ timeout: 5 });
}

const remainingDeletedCandidates = new Set(
  after.objects
    .filter((object) =>
      orphanObjects.some(
        (candidate) =>
          candidate.bucketId === object.bucketId && candidate.name === object.name,
      ),
    )
    .map((object) => `${object.bucketId}/${object.name}`),
);
if (remainingDeletedCandidates.size > 0) {
  throw new Error(
    `Cleanup verification failed; ${remainingDeletedCandidates.size} objects still exist.`,
  );
}

report.deletion = {
  completedAt: new Date().toISOString(),
  deletedCount: orphanObjects.length,
  deletedBytes: orphanBytes,
  results: deletionResults,
  remainingSummary: summarize(after.objects),
};
await writeJson(outputPath, report);
console.log(JSON.stringify(report, null, 2));

async function auditMedia(client) {
  const rows = await client.unsafe(`
    WITH references AS (
      SELECT 'listing-images'::text AS bucket_id,
             storage_path::text AS name,
             'listing_images'::text AS source
        FROM public.listing_images
       WHERE storage_path IS NOT NULL AND btrim(storage_path) <> ''

      UNION ALL
      SELECT 'profile-media', avatar_path, 'profiles.avatar_path'
        FROM public.profiles
       WHERE avatar_path IS NOT NULL AND btrim(avatar_path) <> ''

      UNION ALL
      SELECT 'profile-media', cover_path, 'profiles.cover_path'
        FROM public.profiles
       WHERE cover_path IS NOT NULL AND btrim(cover_path) <> ''

      UNION ALL
      SELECT CASE WHEN attachment_kind = 'audio'
                  THEN 'conversation-audio'
                  ELSE 'conversation-images'
             END,
             attachment_path,
             CASE WHEN deleted_at IS NULL
                  THEN 'conversation_messages.active'
                  ELSE 'conversation_messages.deleted'
             END
        FROM public.conversation_messages
       WHERE attachment_path IS NOT NULL AND btrim(attachment_path) <> ''

      UNION ALL
      SELECT 'ad-placement-media',
             split_part(split_part(image_url, '/ad-placement-media/', 2), '?', 1),
             'ad_placements'
        FROM public.ad_placements
       WHERE image_url LIKE '%/ad-placement-media/%'

      UNION ALL
      SELECT 'ad-placement-media',
             split_part(split_part(image_url, '/ad-placement-media/', 2), '?', 1),
             'ad_campaign_creatives'
        FROM public.ad_campaign_creatives
       WHERE image_url LIKE '%/ad-placement-media/%'

      UNION ALL
      SELECT 'promotion-receipts', proof_path, 'listing_promotion_requests'
        FROM public.listing_promotion_requests
       WHERE proof_path IS NOT NULL AND btrim(proof_path) <> ''

      UNION ALL
      SELECT 'verification-documents', document_path, 'seller_verification_requests'
        FROM public.seller_verification_requests
       WHERE document_path IS NOT NULL AND btrim(document_path) <> ''
    )
    SELECT o.bucket_id,
           o.name,
           COALESCE((o.metadata->>'size')::bigint, 0) AS bytes,
           NULLIF(trim(both '"' from o.metadata->>'eTag'), '') AS etag,
           COALESCE(o.metadata->>'mimetype', 'application/octet-stream') AS content_type,
           o.created_at,
           count(r.*)::int AS reference_count,
           COALESCE(string_agg(DISTINCT r.source, ', ' ORDER BY r.source), '') AS reference_sources
      FROM storage.objects o
      LEFT JOIN references r
        ON r.bucket_id = o.bucket_id
       AND r.name = o.name
     GROUP BY o.bucket_id, o.name, o.metadata, o.created_at
     ORDER BY o.bucket_id, o.name
  `);

  return {
    objects: rows.map((row) => ({
      bucketId: String(row.bucket_id),
      name: String(row.name),
      bytes: Number(row.bytes),
      etag: row.etag ? String(row.etag) : null,
      contentType: String(row.content_type),
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
      referenceCount: Number(row.reference_count),
      referenceSources: String(row.reference_sources || "")
        .split(", ")
        .filter(Boolean),
    })),
  };
}

function summarize(objects) {
  const buckets = new Map();
  for (const object of objects) {
    const bucket = buckets.get(object.bucketId) ?? {
      bucketId: object.bucketId,
      objectCount: 0,
      totalBytes: 0,
      referencedCount: 0,
      referencedBytes: 0,
      orphanCount: 0,
      orphanBytes: 0,
    };
    bucket.objectCount += 1;
    bucket.totalBytes += object.bytes;
    if (object.referenceCount > 0) {
      bucket.referencedCount += 1;
      bucket.referencedBytes += object.bytes;
    } else {
      bucket.orphanCount += 1;
      bucket.orphanBytes += object.bytes;
    }
    buckets.set(object.bucketId, bucket);
  }
  return [...buckets.values()].sort((a, b) => b.totalBytes - a.totalBytes);
}

function groupByBucket(objects) {
  const groups = new Map();
  for (const object of objects) {
    const group = groups.get(object.bucketId) ?? [];
    group.push(object);
    groups.set(object.bucketId, group);
  }
  return groups.entries();
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function parseArguments(args) {
  const parsed = {
    apply: false,
    confirmation: null,
    output: null,
  };
  for (const argument of args) {
    if (argument === "--apply") parsed.apply = true;
    else if (argument.startsWith("--confirmation=")) {
      parsed.confirmation = argument.slice("--confirmation=".length);
    } else if (argument.startsWith("--output=")) {
      parsed.output = argument.slice("--output=".length);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return parsed;
}
