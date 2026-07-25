#!/usr/bin/env node

/**
 * Fetch metadata and downloadable resources for reviewed Syria location sources.
 *
 * Primary target:
 * - HDX/OCHA COD-AB Syria dataset: cod-ab-syr
 *
 * Secondary verification target:
 * - Humanitarian Atlas Syria coverage page
 *
 * Safe behavior:
 * - metadata-only by default
 * - downloads only when --download is supplied
 * - never writes to the retired backend
 * - records provenance manifest with URLs, timestamps, sizes and SHA-256 hashes
 */

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
const download = Boolean(args.download);
const outputDir = resolve(args.output ?? "data/locations/sources");
const manifestPath = resolve(args.manifest ?? "data/locations/source-manifest.json");
const datasetId = String(args.dataset ?? "cod-ab-syr");

const hdxApiUrl = `https://data.humdata.org/api/3/action/package_show?id=${encodeURIComponent(datasetId)}`;
const atlasUrl = "https://humanitarianatlas.org/syria/";

const atlasResponse = await fetch(atlasUrl, {
  headers: { "user-agent": "RAWAJ-location-source-audit/1.0" },
});
if (!atlasResponse.ok) {
  throw new Error(`Humanitarian Atlas request failed: ${atlasResponse.status}`);
}
const atlasHtml = await atlasResponse.text();
const atlasCoverage = parseAtlasCoverage(atlasHtml);

const hdxResponse = await fetch(hdxApiUrl, {
  headers: {
    accept: "application/json",
    "user-agent": "RAWAJ-location-source-audit/1.0",
  },
});
if (!hdxResponse.ok) {
  throw new Error(`HDX metadata request failed: ${hdxResponse.status}`);
}
const hdxPayload = await hdxResponse.json();
if (!hdxPayload?.success || !hdxPayload?.result) {
  throw new Error("HDX metadata payload is missing a successful dataset result.");
}

const dataset = hdxPayload.result;
const resources = (dataset.resources ?? [])
  .map((resource) => ({
    id: resource.id ?? null,
    name: resource.name ?? null,
    description: resource.description ?? null,
    format: String(resource.format ?? "").toUpperCase(),
    url: resource.url ?? null,
    size: resource.size ?? null,
    created: resource.created ?? null,
    lastModified: resource.last_modified ?? null,
  }))
  .filter((resource) => resource.url);

const preferredResources = resources.filter((resource) =>
  ["CSV", "XLSX", "XLS", "GEOJSON", "ZIP", "SHP"].includes(resource.format),
);

const manifest = {
  generatedAt: new Date().toISOString(),
  primarySource: {
    provider: "HDX / OCHA",
    datasetId,
    metadataUrl: hdxApiUrl,
    title: dataset.title ?? null,
    name: dataset.name ?? null,
    version: dataset.version ?? null,
    metadataCreated: dataset.metadata_created ?? null,
    metadataModified: dataset.metadata_modified ?? null,
    licenseId: dataset.license_id ?? null,
    licenseTitle: dataset.license_title ?? null,
    organization: dataset.organization?.title ?? null,
    notes: dataset.notes ?? null,
    resourceCount: resources.length,
    resources,
  },
  verificationSource: {
    provider: "Humanitarian Atlas / OCHA Syria",
    url: atlasUrl,
    coverage: atlasCoverage,
  },
  downloads: [],
};

if (download) {
  await mkdir(outputDir, { recursive: true });
  for (const resource of preferredResources) {
    const downloaded = await downloadResource(resource, outputDir);
    manifest.downloads.push(downloaded);
  }
}

await mkdir(dirname(manifestPath), { recursive: true });
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify(manifest, null, 2));

function parseAtlasCoverage(html) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  return {
    governorates: extractCount(text, /14\s+Governorates/i),
    districts: extractCount(text, /61\s+Districts/i),
    subdistricts: extractCount(text, /272\s+Sub-?districts/i),
    localities: extractCount(text, /5596\s+Localities/i),
    pcodeClaim: /standard unique code \(pcode\).*city or village or neighborhood/i.test(text),
  };
}

function extractCount(text, pattern) {
  const match = text.match(pattern);
  if (!match) return null;
  const countMatch = match[0].match(/\d+/);
  return countMatch ? Number(countMatch[0]) : null;
}

async function downloadResource(resource, outputDir) {
  const response = await fetch(resource.url, {
    headers: { "user-agent": "RAWAJ-location-source-audit/1.0" },
  });
  if (!response.ok) {
    return {
      resourceId: resource.id,
      name: resource.name,
      url: resource.url,
      status: "failed",
      httpStatus: response.status,
    };
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const filename = safeFilename(resource, response.headers.get("content-type"));
  const filepath = resolve(outputDir, filename);
  await writeFile(filepath, buffer);
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  return {
    resourceId: resource.id,
    name: resource.name,
    url: resource.url,
    status: "downloaded",
    file: filepath,
    bytes: buffer.length,
    sha256,
    contentType: response.headers.get("content-type"),
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"),
  };
}

function safeFilename(resource, contentType) {
  const urlName = basename(new URL(resource.url).pathname);
  const named = String(resource.name ?? "").trim();
  const candidate = urlName || named || `resource-${resource.id ?? "unknown"}`;
  const sanitized = candidate.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (extname(sanitized)) return sanitized;
  const extension = extensionFor(resource.format, contentType);
  return `${sanitized || "resource"}${extension}`;
}

function extensionFor(format, contentType) {
  const normalized = String(format ?? "").toUpperCase();
  if (normalized === "CSV") return ".csv";
  if (normalized === "XLSX") return ".xlsx";
  if (normalized === "XLS") return ".xls";
  if (normalized === "GEOJSON") return ".geojson";
  if (normalized === "ZIP" || normalized === "SHP") return ".zip";
  if (String(contentType ?? "").includes("json")) return ".json";
  return ".bin";
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      result[key] = true;
    } else {
      result[key] = next;
      index += 1;
    }
  }
  return result;
}
