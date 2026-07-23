#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { migrateLegacyMedia, normalizePlacementStatus } from "./legacy-media-core.mjs";

const options = parseArguments(process.argv.slice(2));
const manifest = JSON.parse(await readFile(resolve(options.manifest), "utf8"));
if (manifest.version !== 1 || !Array.isArray(manifest.entries)) {
  throw new Error("Unsupported legacy media manifest.");
}

const allowedKinds = new Set();
for (const entity of options.entities === "all" ? ["all"] : options.entities.split(",")) {
  if (entity === "all") {
    for (const kind of ["listing_image", "ad_placement", "profile_avatar", "profile_cover"])
      allowedKinds.add(kind);
  } else if (entity === "profile-media") {
    allowedKinds.add("profile_avatar");
    allowedKinds.add("profile_cover");
  } else {
    allowedKinds.add(normalizeEntity(entity));
  }
}
const records = manifest.entries
  .map(normalizeManifestEntry)
  .filter((entry) => allowedKinds.has(entry.kind));
const source = createLegacySource(records);
const target = createLocalTarget(options);

let report;
if (options.reconcileOnly) {
  report = await target.reconcile(records);
} else {
  report = await migrateLegacyMedia({
    records,
    source,
    target,
    dryRun: !options.apply,
    batchSize: options.batchSize,
    resumeAfter: options.resumeAfter,
  });
}
report.generatedAt = new Date().toISOString();
report.manifest = resolve(options.manifest);
report.entities = [...allowedKinds];

const output = resolve(options.report);
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ...report, results: undefined, report: output }, null, 2));
if (
  report.counts &&
  Object.entries(report.counts).some(
    ([key, value]) =>
      ["sourceFailure", "invalidFile", "invalidSourceData", "unresolvedMapping", "ownershipMismatch", "uploadFailure", "d1Failure"].includes(key) &&
      value > 0,
  )
) {
  process.exitCode = 1;
}

function createLegacySource(selected) {
  const needsStorage = selected.some((record) => record.sourcePath);
  let client = null;
  return {
    async read(record) {
      if (record.sourcePath) {
        if (!needsStorage) throw new Error("Unexpected storage source.");
        client ??= createClient(
          requiredEnvironment("SUPABASE_URL"),
          requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
          {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          },
        );
        const { data, error } = await client.storage
          .from(record.sourceBucket)
          .download(record.sourcePath);
        if (error || !data) {
          throw Object.assign(
            new Error(error?.message ?? "Source object is missing."),
            { code: "SOURCE_MISSING" },
          );
        }
        return {
          bytes: Buffer.from(await data.arrayBuffer()),
          contentType: data.type || "application/octet-stream",
        };
      }
      const response = await fetch(record.sourceUrl, {
        redirect: "follow",
        headers: { "user-agent": "rawaj-local-legacy-migration/1.0" },
      });
      if (response.status === 404) {
        throw Object.assign(new Error("Source object is missing."), { code: "SOURCE_MISSING" });
      }
      if (!response.ok) throw new Error(`Source URL returned ${response.status}.`);
      return {
        bytes: Buffer.from(await response.arrayBuffer()),
        contentType: response.headers.get("content-type") ?? "application/octet-stream",
      };
    },
  };
}

function createLocalTarget(config) {
  if (config.apply && config.target !== "local") {
    throw new Error("Apply is restricted to --target=local in this migration tool.");
  }
  const workerDir = resolve(dirname(fileURLToPath(import.meta.url)), "../worker");
  const wrangler = resolve(workerDir, "node_modules/wrangler/bin/wrangler.js");
  const commonD1 = [
    wrangler,
    "d1",
    "execute",
    "rawaj-staging",
    "--local",
    "--persist-to",
    config.persistTo,
    "--config",
    "wrangler.generated.jsonc",
  ];
  const execute = (sql) => runJson(process.execPath, [...commonD1, "--command", sql], workerDir);
  return {
    async resolveMapping(record) {
      if (record.kind === "listing_image") {
        const row = firstRow(
          execute(
            `SELECT id, owner_id FROM listings WHERE id = ${sql(record.listingId)} LIMIT 1;`,
          ),
        );
        return row ? { id: row.id, ownerId: row.owner_id } : null;
      }
      if (record.kind === "profile_avatar" || record.kind === "profile_cover") {
        const row = firstRow(
          execute(`SELECT id FROM public_profiles WHERE id = ${sql(record.ownerId)} LIMIT 1;`),
        );
        return row ? { id: row.id, ownerId: row.id } : null;
      }
      return { id: record.sourceId, ownerId: null };
    },
    async findMigration(record) {
      const row = firstRow(
        execute(
          `SELECT status, target_object_key AS objectKey, target_asset_id AS assetId
           FROM legacy_media_migrations
           WHERE source_system = 'supabase'
             AND entity_kind = ${sql(record.kind)}
             AND source_id = ${sql(record.sourceId)} LIMIT 1;`,
        ),
      );
      return row ?? null;
    },
    async findChecksum(record, checksum) {
      const row = firstRow(
        execute(
          `SELECT target_object_key AS objectKey, target_asset_id AS assetId
           FROM legacy_media_migrations
           WHERE source_system = 'supabase'
             AND entity_kind = ${sql(record.kind)}
             AND checksum_sha256 = ${sql(checksum)}
             AND status = 'migrated' LIMIT 1;`,
        ),
      );
      return row ?? null;
    },
    async objectExists(objectKey) {
      const temp = await mkdtemp(resolve(tmpdir(), "rawaj-r2-head-"));
      const destination = resolve(temp, "object");
      try {
        const result = spawnSync(
          process.execPath,
          [
            wrangler,
            "r2",
            "object",
            "get",
            `rawaj-staging-media/${objectKey}`,
            "--local",
            "--persist-to",
            config.persistTo,
            "--config",
            "wrangler.generated.jsonc",
            "--file",
            destination,
          ],
          { cwd: workerDir, windowsHide: true, encoding: "utf8" },
        );
        return result.status === 0;
      } finally {
        await rm(temp, { recursive: true, force: true });
      }
    },
    async putObject(objectKey, bytes, contentType) {
      const temp = await mkdtemp(resolve(tmpdir(), "rawaj-r2-put-"));
      const sourcePath = resolve(temp, "object");
      try {
        await writeFile(sourcePath, bytes);
        run(
          process.execPath,
          [
            wrangler,
            "r2",
            "object",
            "put",
            `rawaj-staging-media/${objectKey}`,
            "--local",
            "--persist-to",
            config.persistTo,
            "--config",
            "wrangler.generated.jsonc",
            "--file",
            sourcePath,
            "--content-type",
            contentType,
          ],
          workerDir,
        );
      } finally {
        await rm(temp, { recursive: true, force: true });
      }
    },
    async deleteObject(objectKey) {
      run(
        process.execPath,
        [
          wrangler,
          "r2",
          "object",
          "delete",
          `rawaj-staging-media/${objectKey}`,
          "--local",
          "--persist-to",
          config.persistTo,
          "--config",
          "wrangler.generated.jsonc",
        ],
        workerDir,
      );
    },
    async commit(context) {
      execute(commitSql(context));
    },
    async attachExisting(context) {
      execute(commitSql(context));
    },
    async recordFailure(record, code, message, attemptedAt) {
      execute(
        `INSERT INTO legacy_media_migrations
          (source_system, entity_kind, source_id, source_bucket, source_path,
           status, error_code, attempted_at)
         VALUES ('supabase', ${sql(record.kind)}, ${sql(record.sourceId)},
           ${sql(record.sourceBucket)}, ${sql(record.sourcePath ?? record.sourceUrl)},
           ${sql(failureStatus(code))}, ${sql(`${code}:${message}`.slice(0, 500))},
           ${sql(attemptedAt)})
         ON CONFLICT(source_system, entity_kind, source_id) DO UPDATE SET
           status = excluded.status, error_code = excluded.error_code,
           attempted_at = excluded.attempted_at;`,
      );
    },
    async reconcile() {
      const counts = firstRow(
        execute(
          `SELECT
            (SELECT COUNT(*) FROM auth_users) AS targetUsers,
            (SELECT COUNT(*) FROM auth_users WHERE password_hash IS NOT NULL) AS workingPasswords,
            (SELECT COUNT(*) FROM auth_users WHERE password_hash IS NULL) AS recoveryRequired,
            (SELECT COUNT(*) FROM listings) AS targetListings,
            (SELECT COUNT(*) FROM listing_images) AS targetListingImages,
            (SELECT COUNT(*) FROM ad_placements) AS targetPlacements,
            (SELECT COUNT(*) FROM public_profiles WHERE avatar_asset_id IS NOT NULL) AS targetAvatars,
            (SELECT COUNT(*) FROM public_profiles WHERE cover_asset_id IS NOT NULL) AS targetCovers,
            (SELECT COUNT(*) FROM media_assets) AS d1MediaRecords,
            (SELECT COUNT(*) FROM legacy_media_migrations WHERE status = 'migrated') AS migratedLedger;`,
        ),
      );
      const integrity = firstRow(
        execute(
          `SELECT
            (SELECT COUNT(*) FROM listing_images li LEFT JOIN listings l ON l.id = li.listing_id WHERE l.id IS NULL) AS missingListing,
            (SELECT COUNT(*) FROM listing_images li LEFT JOIN media_assets m ON m.id = li.media_asset_id WHERE m.id IS NULL) AS missingMedia,
            (SELECT COUNT(*) FROM public_profiles p LEFT JOIN media_assets m ON m.id = p.avatar_asset_id WHERE p.avatar_asset_id IS NOT NULL AND m.id IS NULL) AS missingAvatarMedia,
            (SELECT COUNT(*) FROM public_profiles p LEFT JOIN media_assets m ON m.id = p.cover_asset_id WHERE p.cover_asset_id IS NOT NULL AND m.id IS NULL) AS missingCoverMedia;`,
        ),
      );
      return { version: 1, mode: "reconcile-only", counts, integrity, results: [] };
    },
  };
}

function commitSql({ record, media, checksum, objectKey, assetId, now }) {
  const mediaInsert = `INSERT INTO media_assets
    (id, owner_id, object_key, content_type, byte_size, checksum_sha256,
     status, source_storage_path, created_at, updated_at)
    VALUES (${sql(assetId)}, ${sql(record.ownerId)}, ${sql(objectKey)},
      ${sql(media.contentType)}, ${Number(media.bytes.byteLength)}, ${sql(checksum)},
      'ready', ${sql(record.sourcePath ?? record.sourceUrl)}, ${sql(record.createdAt ?? now)}, ${sql(now)})
    ON CONFLICT(id) DO UPDATE SET
      object_key = excluded.object_key, content_type = excluded.content_type,
      byte_size = excluded.byte_size, checksum_sha256 = excluded.checksum_sha256,
      status = 'ready', updated_at = excluded.updated_at;`;
  let link;
  if (record.kind === "listing_image") {
    link = `INSERT INTO listing_images
      (id, listing_id, media_asset_id, alt_ar, sort_order, created_at)
      VALUES (${sql(record.sourceId)}, ${sql(record.listingId)}, ${sql(assetId)},
        ${sql(record.altAr)}, ${Number(record.sortOrder ?? 0)}, ${sql(record.createdAt ?? now)})
      ON CONFLICT(id) DO UPDATE SET
        media_asset_id = excluded.media_asset_id, alt_ar = excluded.alt_ar,
        sort_order = excluded.sort_order;`;
  } else if (record.kind === "profile_avatar" || record.kind === "profile_cover") {
    const column = record.kind === "profile_avatar" ? "avatar_asset_id" : "cover_asset_id";
    link = `UPDATE public_profiles SET ${column} = ${sql(assetId)}, updated_at = ${sql(now)}
      WHERE id = ${sql(record.ownerId)};`;
  } else {
    const safeDestination = safeDestinationUrl(record.destinationUrl);
    link = `INSERT INTO ad_placements
      (id, name, placement_page, media_asset_id, destination_url, starts_at, ends_at,
       status, priority, target_mobile, target_desktop, version, created_at, updated_at)
      VALUES (${sql(record.sourceId)}, ${sql(record.name)}, ${sql(record.placementPage)},
        ${sql(assetId)}, ${sql(safeDestination)}, ${sql(record.startsAt)}, ${sql(record.endsAt)},
        ${sql(normalizePlacementStatus(record))}, ${Number(record.priority ?? 0)},
        ${record.targetMobile === false ? 0 : 1}, ${record.targetDesktop === false ? 0 : 1},
        ${Number(record.version ?? 1)}, ${sql(record.createdAt ?? now)}, ${sql(record.updatedAt ?? now)})
      ON CONFLICT(id) DO UPDATE SET
        media_asset_id = excluded.media_asset_id, destination_url = excluded.destination_url,
        status = excluded.status, priority = excluded.priority, updated_at = excluded.updated_at;`;
  }
  const ledger = `INSERT INTO legacy_media_migrations
    (source_system, entity_kind, source_id, source_bucket, source_path,
     target_asset_id, target_object_key, checksum_sha256, status, error_code,
     attempted_at, migrated_at)
    VALUES ('supabase', ${sql(record.kind)}, ${sql(record.sourceId)},
      ${sql(record.sourceBucket)}, ${sql(record.sourcePath ?? record.sourceUrl)},
      ${sql(assetId)}, ${sql(objectKey)}, ${sql(checksum)}, 'migrated', NULL,
      ${sql(now)}, ${sql(now)})
    ON CONFLICT(source_system, entity_kind, source_id) DO UPDATE SET
      target_asset_id = excluded.target_asset_id,
      target_object_key = excluded.target_object_key,
      checksum_sha256 = excluded.checksum_sha256, status = 'migrated',
      error_code = NULL, attempted_at = excluded.attempted_at,
      migrated_at = excluded.migrated_at;`;
  return `PRAGMA foreign_keys = ON; BEGIN TRANSACTION; ${mediaInsert} ${link} ${ledger} COMMIT;`;
}

function normalizeManifestEntry(entry) {
  return {
    ...entry,
    sourceId: entry.sourceId ?? entry.assetId,
    sourcePath: entry.sourcePath ?? null,
    sourceUrl: entry.sourceUrl ?? null,
    ownerId: entry.ownerId ?? null,
  };
}

function normalizeEntity(value) {
  return {
    "listing-images": "listing_image",
    "promotional-media": "ad_placement",
    "profile-media": "profile_avatar",
    listing_image: "listing_image",
    ad_placement: "ad_placement",
    profile_avatar: "profile_avatar",
    profile_cover: "profile_cover",
  }[value] ?? value;
}

function safeDestinationUrl(value) {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("Unsafe promotion destination.");
  return url.toString();
}

function failureStatus(code) {
  if (code === "missing_source") return "missing";
  if (code.startsWith("invalid")) return "invalid";
  if (code === "unresolved_mapping" || code === "ownership_mismatch") return "unresolved";
  return "failed";
}

function firstRow(payload) {
  return payload?.[0]?.results?.[0] ?? payload?.results?.[0] ?? null;
}

function runJson(command, args, cwd) {
  const output = run(command, [...args, "--json"], cwd);
  return JSON.parse(output);
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, windowsHide: true, encoding: "utf8" });
  if (result.status !== 0) throw new Error((result.stderr || result.stdout).trim());
  return result.stdout;
}

function sql(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function parseArguments(args) {
  const parsed = {
    apply: false,
    target: "local",
    manifest: "cloudflare/snapshots/latest/media-manifest.json",
    entities: "all",
    batchSize: 50,
    resumeAfter: null,
    reconcileOnly: false,
    persistTo: ".wrangler/state",
    report: "cloudflare/migration-report.local.json",
  };
  for (const argument of args) {
    if (argument === "--apply") parsed.apply = true;
    else if (argument === "--dry-run") parsed.apply = false;
    else if (argument === "--reconcile-only") parsed.reconcileOnly = true;
    else if (argument.startsWith("--target=")) parsed.target = argument.slice(9);
    else if (argument.startsWith("--manifest=")) parsed.manifest = argument.slice(11);
    else if (argument.startsWith("--entities=")) parsed.entities = argument.slice(11);
    else if (argument.startsWith("--batch-size=")) parsed.batchSize = Number(argument.slice(13));
    else if (argument.startsWith("--resume-after=")) parsed.resumeAfter = argument.slice(15);
    else if (argument.startsWith("--persist-to=")) parsed.persistTo = argument.slice(13);
    else if (argument.startsWith("--report=")) parsed.report = argument.slice(9);
    else throw new Error(`Unsupported argument: ${argument}`);
  }
  if (!Number.isInteger(parsed.batchSize) || parsed.batchSize < 1 || parsed.batchSize > 500)
    throw new Error("Batch size must be between 1 and 500.");
  return parsed;
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
