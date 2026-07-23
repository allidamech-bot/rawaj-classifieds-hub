import { createHash } from "node:crypto";

export const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

export async function migrateLegacyMedia({
  records,
  source,
  target,
  dryRun = true,
  batchSize = 50,
  resumeAfter = null,
  now = () => new Date().toISOString(),
}) {
  const selected = records
    .filter((record) => !resumeAfter || stableRecordKey(record) > resumeAfter)
    .slice(0, Math.max(1, batchSize));
  const report = emptyReport(dryRun ? "dry-run" : "apply");

  for (const record of selected) {
    report.source[pluralKind(record.kind)] += 1;
    const key = stableRecordKey(record);
    report.lastCheckpoint = key;
    try {
      validateRecord(record);
      const mapped = await target.resolveMapping(record);
      if (!mapped) {
        report.results.push(result(record, "unresolved_mapping"));
        report.counts.unresolvedMapping += 1;
        continue;
      }
      if (mapped.ownerId && record.ownerId && mapped.ownerId !== record.ownerId) {
        report.results.push(result(record, "ownership_mismatch"));
        report.counts.ownershipMismatch += 1;
        continue;
      }
      const existing = await target.findMigration(record);
      if (existing?.status === "migrated" && (await target.objectExists(existing.objectKey))) {
        report.results.push(result(record, "duplicate", { objectKey: existing.objectKey }));
        report.counts.duplicate += 1;
        continue;
      }
      if (dryRun) {
        report.results.push(result(record, "planned"));
        report.counts.planned += 1;
        continue;
      }

      let media;
      try {
        media = await source.read(record);
      } catch (error) {
        const code = error?.code === "SOURCE_MISSING" ? "missing_source" : "source_failure";
        await target.recordFailure(record, code, safeError(error), now());
        report.results.push(result(record, code, { error: safeError(error) }));
        report.counts[camel(code)] += 1;
        continue;
      }
      const verified = validateImage(media.bytes, media.contentType);
      const checksum = sha256(media.bytes);
      const objectKey = generatedObjectKey(record, checksum);
      const assetId = generatedAssetId(record);
      const duplicateChecksum = await target.findChecksum(record, checksum);
      if (duplicateChecksum?.objectKey && (await target.objectExists(duplicateChecksum.objectKey))) {
        await target.attachExisting({
          record,
          mapped,
          media: { ...media, ...verified },
          checksum,
          objectKey: duplicateChecksum.objectKey,
          assetId: duplicateChecksum.assetId,
          now: now(),
        });
        report.results.push(
          result(record, "duplicate", { objectKey: duplicateChecksum.objectKey, checksum }),
        );
        report.counts.duplicate += 1;
        continue;
      }

      let uploaded = false;
      try {
        await target.putObject(objectKey, media.bytes, verified.contentType, checksum);
        uploaded = true;
        await target.commit({
          record,
          mapped,
          media: { ...media, ...verified },
          checksum,
          objectKey,
          assetId,
          now: now(),
        });
      } catch (error) {
        if (uploaded) await target.deleteObject(objectKey).catch(() => {});
        await target.recordFailure(record, uploaded ? "d1_failure" : "upload_failure", safeError(error), now());
        const status = uploaded ? "d1_failure" : "upload_failure";
        report.results.push(result(record, status, { error: safeError(error) }));
        report.counts[camel(status)] += 1;
        continue;
      }

      report.results.push(result(record, "migrated", { objectKey, checksum }));
      report.counts.migrated += 1;
      report.counts.r2ObjectsCreated += 1;
      report.counts.d1MediaRecordsCreated += 1;
    } catch (error) {
      const status = error?.code === "INVALID_MEDIA" ? "invalid_file" : "invalid_source_data";
      if (!dryRun) await target.recordFailure(record, status, safeError(error), now()).catch(() => {});
      report.results.push(result(record, status, { error: safeError(error) }));
      report.counts[camel(status)] += 1;
    }
  }
  return report;
}

export function validateImage(bytesLike, declaredType = "") {
  const bytes = Buffer.from(bytesLike ?? []);
  if (bytes.length === 0) throw migrationError("INVALID_MEDIA", "Image is empty.");
  if (bytes.length > MAX_MEDIA_BYTES) {
    throw migrationError("INVALID_MEDIA", `Image exceeds ${MAX_MEDIA_BYTES} bytes.`);
  }
  const detected = detectImageType(bytes);
  if (!detected) throw migrationError("INVALID_MEDIA", "Unsupported or invalid image signature.");
  const clean = String(declaredType).split(";")[0].trim().toLowerCase();
  if (clean && clean !== "application/octet-stream" && clean !== detected) {
    throw migrationError("INVALID_MEDIA", `Declared MIME ${clean} does not match ${detected}.`);
  }
  return { contentType: detected };
}

export function detectImageType(bytesLike) {
  const bytes = Buffer.from(bytesLike ?? []);
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return "image/webp";
  if (
    bytes.length >= 6 &&
    ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"))
  )
    return "image/gif";
  if (
    bytes.length >= 12 &&
    bytes.subarray(4, 8).toString("ascii") === "ftyp" &&
    ["avif", "avis"].includes(bytes.subarray(8, 12).toString("ascii"))
  )
    return "image/avif";
  return null;
}

export function generatedObjectKey(record, checksum) {
  const namespace = {
    listing_image: "listings",
    ad_placement: "ad-placements",
    profile_avatar: "profiles",
    profile_cover: "profiles",
  }[record.kind];
  const digest = sha256(
    Buffer.from(`supabase\0${record.kind}\0${record.sourceId}\0${checksum}`, "utf8"),
  );
  const suffix =
    record.kind === "profile_avatar"
      ? "avatar"
      : record.kind === "profile_cover"
        ? "cover"
        : "media";
  return `${namespace}/${digest.slice(0, 2)}/${digest.slice(2, 34)}/${suffix}`;
}

export function generatedAssetId(record) {
  return `legacy:${record.kind}:${record.sourceId}`;
}

export function normalizePlacementStatus(record, currentTime = Date.now()) {
  if (record.status !== "active") return record.status;
  if (record.endsAt && Date.parse(record.endsAt) <= currentTime) return "draft";
  if (record.startsAt && Date.parse(record.startsAt) > currentTime) return "draft";
  return "active";
}

export function stableRecordKey(record) {
  return `${record.kind}:${record.sourceId}`;
}

function validateRecord(record) {
  if (!record || typeof record !== "object") throw new Error("Legacy media record is required.");
  if (!["listing_image", "ad_placement", "profile_avatar", "profile_cover"].includes(record.kind))
    throw new Error(`Unsupported entity kind: ${record.kind}`);
  if (typeof record.sourceId !== "string" || !record.sourceId.trim())
    throw new Error("Stable sourceId is required.");
  if (!record.sourcePath && !record.sourceUrl) throw new Error("Source path or URL is required.");
  if (record.sourceUrl) {
    const url = new URL(record.sourceUrl);
    if (url.protocol !== "https:") throw new Error("Only HTTPS source URLs are allowed.");
  }
  if (record.kind === "listing_image" && !record.listingId)
    throw new Error("Listing image requires listingId.");
  if ((record.kind === "profile_avatar" || record.kind === "profile_cover") && !record.ownerId)
    throw new Error("Profile media requires ownerId.");
}

function emptyReport(mode) {
  return {
    version: 1,
    mode,
    source: { listingImages: 0, promotionalPlacements: 0, avatars: 0, covers: 0 },
    counts: {
      planned: 0,
      migrated: 0,
      duplicate: 0,
      missingSource: 0,
      sourceFailure: 0,
      invalidFile: 0,
      invalidSourceData: 0,
      unresolvedMapping: 0,
      ownershipMismatch: 0,
      uploadFailure: 0,
      d1Failure: 0,
      r2ObjectsCreated: 0,
      d1MediaRecordsCreated: 0,
    },
    lastCheckpoint: null,
    results: [],
  };
}

function pluralKind(kind) {
  return {
    listing_image: "listingImages",
    ad_placement: "promotionalPlacements",
    profile_avatar: "avatars",
    profile_cover: "covers",
  }[kind];
}

function result(record, status, extra = {}) {
  return { kind: record.kind, sourceId: record.sourceId, status, ...extra };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function migrationError(code, message) {
  return Object.assign(new Error(message), { code });
}

function safeError(error) {
  return error instanceof Error ? error.message : String(error);
}

function camel(value) {
  return value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}
