#!/usr/bin/env node

/**
 * Import reviewed RAWAJ location nodes into Supabase.
 *
 * Safe defaults:
 * - validates input first
 * - dry-run unless --apply is explicitly supplied
 * - requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY only for --apply
 * - upserts by external_source + external_id
 * - never deletes unmatched rows
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const args = parseArgs(process.argv.slice(2));
const inputPath = resolve(args.input ?? "data/locations/syria-pcode-location-nodes.json");
const apply = Boolean(args.apply);
const batchSize = Math.max(1, Math.min(Number(args["batch-size"] ?? 500), 1000));

const sourceNodes = JSON.parse(await readFile(inputPath, "utf8"));
if (!Array.isArray(sourceNodes)) throw new Error("Location import JSON must contain an array.");

const nodes = sourceNodes.map(normalizeNode);
const report = validateNodes(nodes);
console.log(JSON.stringify(report, null, 2));

if (report.blockingIssues.length > 0) {
  throw new Error("Location import blocked by validation errors.");
}

if (!apply) {
  console.log("Dry run complete. Re-run with --apply to write reviewed nodes.");
  process.exit(0);
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --apply.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let imported = 0;
for (let index = 0; index < nodes.length; index += batchSize) {
  const batch = nodes.slice(index, index + batchSize);
  const { error } = await supabase
    .from("location_nodes")
    .upsert(batch, { onConflict: "external_source,external_id" });

  if (error) {
    throw new Error(`Location import failed at batch ${index / batchSize + 1}: ${error.message}`);
  }
  imported += batch.length;
  console.log(`Imported ${imported}/${nodes.length}`);
}

console.log(`Location import complete: ${imported} rows upserted; 0 rows deleted.`);

function normalizeNode(node) {
  return {
    id: requiredText(node.id, "id"),
    parent_id: nullableText(node.parent_id),
    country_code: requiredText(node.country_code ?? "SY", "country_code"),
    node_type: requiredText(node.node_type, "node_type"),
    name_ar: requiredText(node.name_ar, "name_ar"),
    name_en: nullableText(node.name_en),
    slug: requiredText(node.slug, "slug"),
    official_code: nullableText(node.official_code),
    external_source: requiredText(node.external_source, "external_source"),
    external_id: requiredText(node.external_id, "external_id"),
    latitude: nullableNumber(node.latitude),
    longitude: nullableNumber(node.longitude),
    sort_order: integer(node.sort_order, 0),
    depth: integer(node.depth, 0),
    is_active: node.is_active !== false,
    search_aliases: Array.isArray(node.search_aliases)
      ? [...new Set(node.search_aliases.map((value) => String(value).trim()).filter(Boolean))]
      : [],
    legacy_governorate_id: nullableText(node.legacy_governorate_id),
    legacy_district_ar: nullableText(node.legacy_district_ar),
    source_url: nullableText(node.source_url),
    source_date: nullableText(node.source_date),
    confidence: nullableText(node.confidence),
    review_status: nullableText(node.review_status) ?? "unreviewed",
    notes: nullableText(node.notes),
  };
}

function validateNodes(nodes) {
  const blockingIssues = [];
  const ids = new Set();
  const externalKeys = new Set();
  const parentSlugKeys = new Set();

  for (const node of nodes) {
    if (ids.has(node.id)) blockingIssues.push(`duplicate id: ${node.id}`);
    ids.add(node.id);

    const externalKey = `${node.external_source}|${node.external_id}`;
    if (externalKeys.has(externalKey)) blockingIssues.push(`duplicate external key: ${externalKey}`);
    externalKeys.add(externalKey);

    const parentSlugKey = `${node.country_code}|${node.parent_id ?? "root"}|${node.slug}`;
    if (parentSlugKeys.has(parentSlugKey)) blockingIssues.push(`duplicate parent slug: ${parentSlugKey}`);
    parentSlugKeys.add(parentSlugKey);

    if (node.parent_id === node.id) blockingIssues.push(`self parent: ${node.id}`);
    if (node.latitude !== null && (node.latitude < -90 || node.latitude > 90)) {
      blockingIssues.push(`invalid latitude: ${node.id}`);
    }
    if (node.longitude !== null && (node.longitude < -180 || node.longitude > 180)) {
      blockingIssues.push(`invalid longitude: ${node.id}`);
    }
  }

  for (const node of nodes) {
    if (node.parent_id && !ids.has(node.parent_id)) {
      blockingIssues.push(`orphan parent: ${node.id} -> ${node.parent_id}`);
    }
  }

  detectCycles(nodes, blockingIssues);
  return {
    inputRows: nodes.length,
    blockingIssueCount: blockingIssues.length,
    blockingIssues: blockingIssues.slice(0, 200),
  };
}

function detectCycles(nodes, issues) {
  const parentById = new Map(nodes.map((node) => [node.id, node.parent_id]));
  for (const node of nodes) {
    const path = new Set();
    let current = node.id;
    while (current) {
      if (path.has(current)) {
        issues.push(`cycle detected from: ${node.id}`);
        break;
      }
      path.add(current);
      current = parentById.get(current) ?? null;
    }
  }
}

function requiredText(value, field) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`Missing required field: ${field}`);
  return text;
}
function nullableText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}
function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`Invalid number: ${value}`);
  return number;
}
function integer(value, fallback) {
  const number = Number.parseInt(String(value ?? fallback), 10);
  return Number.isFinite(number) ? number : fallback;
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
