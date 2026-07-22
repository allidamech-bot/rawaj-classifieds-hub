#!/usr/bin/env node
import { createHash, createHmac } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
const EMPTY_SHA256 = sha256Hex(Buffer.alloc(0));
const options = parseArguments(process.argv.slice(2));
const manifestPath = resolve(options.manifest);
const outputPath = resolve(
  options.output ??
    `${dirname(manifestPath)}/media-results-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`,
);
const finalizeSqlPath = resolve(
  options.finalizeSql ?? `${dirname(manifestPath)}/media-finalize.sql`,
);

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (manifest.version !== 1 || !Array.isArray(manifest.entries)) {
  throw new Error("Unsupported media manifest.");
}

const selectedEntries =
  options.limit === null ? manifest.entries : manifest.entries.slice(0, options.limit);
const requiresSupabase = selectedEntries.some(
  (entry) => entry.sourceType === "supabase_storage",
);
const supabase = requiresSupabase
  ? createClient(
      requiredEnvironment("SUPABASE_URL"),
      requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    )
  : null;

const r2 = options.apply
  ? {
      accessKeyId: requiredEnvironment("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnvironment("R2_SECRET_ACCESS_KEY"),
      bucket: requiredEnvironment("R2_BUCKET_NAME"),
      endpoint: requiredEnvironment("R2_ENDPOINT").replace(/\/$/, ""),
      region: process.env.R2_REGION?.trim() || "auto",
    }
  : null;

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, "", "utf8");

const summary = {
  mode: options.apply ? "apply" : "dry-run",
  discovered: selectedEntries.length,
  planned: 0,
  uploaded: 0,
  alreadyPresent: 0,
  failed: 0,
  bytes: 0,
  outputPath,
  finalizeSqlPath,
};
const finalizeRows = [];

for (const entry of selectedEntries) {
  validateEntry(entry);

  if (!options.apply) {
    summary.planned += 1;
    await writeResult({
      assetId: entry.assetId,
      targetKey: entry.targetKey,
      status: "planned",
      sourceType: entry.sourceType,
    });
    continue;
  }

  try {
    const source = await readSource(entry, supabase);
    if (source.bytes.byteLength > MAX_MEDIA_BYTES) {
      throw new Error(`Media exceeds ${MAX_MEDIA_BYTES} bytes.`);
    }
    if (!source.contentType.startsWith("image/")) {
      throw new Error(`Unsupported media content type: ${source.contentType}`);
    }

    const checksum = sha256Hex(source.bytes);
    const existing = await headR2Object(r2, entry.targetKey);

    if (existing.exists && existing.sha256 === checksum) {
      summary.alreadyPresent += 1;
    } else {
      if (existing.exists && !options.force) {
        throw new Error(
          "Target object exists with a different checksum. Review before using --force.",
        );
      }
      await putR2Object(r2, entry.targetKey, source.bytes, source.contentType, checksum);
      const verified = await headR2Object(r2, entry.targetKey);
      if (!verified.exists || verified.sha256 !== checksum) {
        throw new Error("R2 checksum verification failed.");
      }
      summary.uploaded += 1;
    }

    summary.bytes += source.bytes.byteLength;
    const verified = await headR2Object(r2, entry.targetKey);
    const result = {
      assetId: entry.assetId,
      targetKey: entry.targetKey,
      status: existing.exists && existing.sha256 === checksum ? "already-present" : "uploaded",
      bytes: source.bytes.byteLength,
      contentType: source.contentType,
      sha256: checksum,
      etag: verified.etag,
      verified: true,
    };
    finalizeRows.push(result);
    await writeResult(result);
  } catch (error) {
    summary.failed += 1;
    await writeResult({
      assetId: entry.assetId,
      targetKey: entry.targetKey,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

if (options.apply) {
  const statements = [
    "PRAGMA foreign_keys = ON;",
    "BEGIN TRANSACTION;",
    ...finalizeRows.map(
      (row) =>
        `UPDATE media_assets
            SET content_type = ${sqlString(row.contentType)},
                byte_size = ${row.bytes},
                checksum_sha256 = ${sqlString(row.sha256)},
                etag = ${row.etag ? sqlString(row.etag) : "NULL"},
                status = 'ready',
                updated_at = ${sqlString(new Date().toISOString())}
          WHERE id = ${sqlString(row.assetId)}
            AND object_key = ${sqlString(row.targetKey)};`,
    ),
    "COMMIT;",
  ];
  await writeFile(finalizeSqlPath, `${statements.join("\n")}\n`, "utf8");
}

await writeResult({ recordType: "summary", ...summary });
console.log(JSON.stringify(summary, null, 2));
if (summary.failed > 0) process.exitCode = 1;

async function readSource(entry, client) {
  if (entry.sourceType === "supabase_storage") {
    if (!client) throw new Error("Supabase client is unavailable.");
    const { data, error } = await client.storage
      .from(entry.sourceBucket)
      .download(entry.sourcePath);
    if (error || !data) {
      throw new Error(error?.message ?? "Supabase object could not be downloaded.");
    }
    return {
      bytes: Buffer.from(await data.arrayBuffer()),
      contentType: normalizeContentType(data.type, entry.sourcePath),
    };
  }

  if (entry.sourceType === "url") {
    const response = await fetch(entry.sourceUrl, {
      redirect: "follow",
      headers: { "user-agent": "rawaj-cloudflare-migration/1.0" },
    });
    if (!response.ok) {
      throw new Error(`Source URL returned ${response.status}.`);
    }
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_MEDIA_BYTES) {
      throw new Error(`Media exceeds ${MAX_MEDIA_BYTES} bytes.`);
    }
    return {
      bytes: Buffer.from(await response.arrayBuffer()),
      contentType: normalizeContentType(
        response.headers.get("content-type") ?? "",
        entry.sourceUrl,
      ),
    };
  }

  throw new Error(`Unsupported source type: ${entry.sourceType}`);
}

function normalizeContentType(value, source) {
  const clean = String(value || "").split(";")[0].trim().toLowerCase();
  if (clean.startsWith("image/")) return clean;
  const path = String(source || "").toLowerCase();
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".gif")) return "image/gif";
  if (path.endsWith(".avif")) return "image/avif";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

async function putR2Object(config, key, body, contentType, checksum) {
  const response = await signedR2Fetch(config, key, "PUT", body, {
    "cache-control": "public, max-age=31536000, immutable",
    "content-type": contentType,
    "x-amz-meta-sha256": checksum,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`R2 PUT failed with ${response.status}${detail ? `: ${detail}` : ""}`);
  }
}

async function headR2Object(config, key) {
  const response = await signedR2Fetch(config, key, "HEAD", undefined, {});
  if (response.status === 404) return { exists: false, sha256: null, etag: null };
  if (!response.ok) throw new Error(`R2 HEAD failed with ${response.status}`);
  return {
    exists: true,
    sha256: response.headers.get("x-amz-meta-sha256"),
    etag: response.headers.get("etag"),
  };
}

async function signedR2Fetch(config, key, method, body, extraHeaders) {
  const now = new Date();
  const amzDate = formatAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const url = new URL(objectUrl(config, key));
  const payloadHash = body ? sha256Hex(body) : EMPTY_SHA256;
  const canonicalHeadersMap = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...extraHeaders,
  };
  const signedHeaderNames = Object.keys(canonicalHeadersMap).sort();
  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${String(canonicalHeadersMap[name]).trim()}\n`)
    .join("");
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const canonicalRequest = [
    method,
    url.pathname,
    "",
    canonicalHeaders,
    signedHeaderNames.join(";"),
    payloadHash,
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = deriveSigningKey(config.secretAccessKey, dateStamp, config.region);
  const signature = hmacHex(signingKey, stringToSign);
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaderNames.join(";")}, Signature=${signature}`;

  const headers = new Headers(extraHeaders);
  headers.set("x-amz-content-sha256", payloadHash);
  headers.set("x-amz-date", amzDate);
  headers.set("authorization", authorization);
  return fetch(url, { method, headers, body });
}

function objectUrl(config, key) {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `${config.endpoint}/${encodeURIComponent(config.bucket)}/${encodedKey}`;
}

function deriveSigningKey(secret, dateStamp, region) {
  const dateKey = hmac(Buffer.from(`AWS4${secret}`, "utf8"), dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, "s3");
  return hmac(serviceKey, "aws4_request");
}

function hmac(key, value) {
  return createHmac("sha256", key).update(value).digest();
}

function hmacHex(key, value) {
  return createHmac("sha256", key).update(value).digest("hex");
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function formatAmzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function validateEntry(entry) {
  if (!entry || typeof entry !== "object") throw new Error("Invalid media entry.");
  for (const key of ["assetId", "sourceType", "targetKey"]) {
    if (typeof entry[key] !== "string" || !entry[key].trim()) {
      throw new Error(`Media entry is missing ${key}.`);
    }
  }
  if (entry.sourceType === "supabase_storage") {
    if (!entry.sourceBucket || !entry.sourcePath) {
      throw new Error("Supabase media entry requires sourceBucket and sourcePath.");
    }
  } else if (entry.sourceType === "url") {
    if (!entry.sourceUrl) throw new Error("URL media entry requires sourceUrl.");
    const url = new URL(entry.sourceUrl);
    if (url.protocol !== "https:") throw new Error("Only HTTPS source URLs are allowed.");
  }
}

function parseArguments(args) {
  const parsed = {
    apply: false,
    force: false,
    manifest: "cloudflare/snapshots/latest/media-manifest.json",
    output: null,
    finalizeSql: null,
    limit: null,
  };

  for (const argument of args) {
    if (argument === "--apply") parsed.apply = true;
    else if (argument === "--force") parsed.force = true;
    else if (argument.startsWith("--manifest=")) {
      parsed.manifest = argument.slice("--manifest=".length);
    } else if (argument.startsWith("--output=")) {
      parsed.output = argument.slice("--output=".length);
    } else if (argument.startsWith("--finalize-sql=")) {
      parsed.finalizeSql = argument.slice("--finalize-sql=".length);
    } else if (argument.startsWith("--limit=")) {
      const limit = Number.parseInt(argument.slice("--limit=".length), 10);
      if (!Number.isInteger(limit) || limit < 1) throw new Error("Invalid --limit.");
      parsed.limit = limit;
    } else {
      throw new Error(`Unsupported argument: ${argument}`);
    }
  }

  if (parsed.force && !parsed.apply) throw new Error("--force requires --apply.");
  return parsed;
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function writeResult(record) {
  await appendFile(outputPath, `${JSON.stringify(record)}\n`, "utf8");
}
