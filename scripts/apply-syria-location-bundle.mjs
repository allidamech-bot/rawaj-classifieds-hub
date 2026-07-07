#!/usr/bin/env node

/**
 * Final RAWAJ Syria location bundle runner.
 *
 * Pipeline:
 * 1) expects generated canonical nodes JSON from prepare-syria-ocha-geojson-locations-v2.mjs
 * 2) validates canonical nodes + curated overlays
 * 3) dry-run by default
 * 4) with --apply, upserts nodes first, then aliases, regions and region members
 * 5) never deletes unmatched production rows
 *
 * Required for --apply:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const args = parseArgs(process.argv.slice(2));
const nodesPath = resolve(args.nodes ?? "data/locations/syria-ocha-location-nodes.json");
const overlaysPath = resolve(args.overlays ?? "data/locations/curated-location-overlays.json");
const apply = Boolean(args.apply);
const batchSize = Math.max(1, Math.min(Number(args["batch-size"] ?? 500), 1000));

const nodes = JSON.parse(await readFile(nodesPath, "utf8"));
const overlays = JSON.parse(await readFile(overlaysPath, "utf8"));

if (!Array.isArray(nodes)) throw new Error("Canonical nodes JSON must contain an array.");
if (!overlays || !Array.isArray(overlays.aliases) || !Array.isArray(overlays.regions)) {
  throw new Error("Overlay JSON is missing aliases or regions arrays.");
}

const validation = validateBundle(nodes, overlays);
console.log(JSON.stringify(validation, null, 2));
if (validation.blockingIssues.length > 0) {
  throw new Error("Syria location bundle blocked by validation issues.");
}

if (!apply) {
  console.log("Dry run complete. No Supabase writes were performed.");
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

await assertSchemaReady(supabase);
await upsertNodes(supabase, nodes);
const nodeIdByExternalKey = await loadNodeIdMap(supabase, nodes);
await upsertAliases(supabase, overlays.aliases, nodeIdByExternalKey);
const regionIdBySlug = await upsertRegions(supabase, overlays.regions);
await upsertRegionMembers(supabase, overlays.regions, regionIdBySlug, nodeIdByExternalKey);

console.log(
  JSON.stringify(
    {
      status: "applied",
      canonicalNodes: nodes.length,
      aliases: overlays.aliases.length,
      regions: overlays.regions.length,
      regionMembers: overlays.regions.reduce(
        (sum, region) => sum + (region.members?.length ?? 0),
        0,
      ),
      deletesPerformed: 0,
    },
    null,
    2,
  ),
);

function validateBundle(canonicalNodes, curated) {
  const blockingIssues = [];
  const externalKeys = new Set();
  const ids = new Set();
  const parentIds = new Set(canonicalNodes.map((node) => node.parent_id).filter(Boolean));

  for (const node of canonicalNodes) {
    if (!node.id || !node.external_source || !node.external_id || !node.name_ar || !node.slug) {
      blockingIssues.push(`invalid canonical node: ${node.external_id ?? node.id ?? "unknown"}`);
      continue;
    }
    if (ids.has(node.id)) blockingIssues.push(`duplicate node id: ${node.id}`);
    ids.add(node.id);
    const externalKey = key(node.external_source, node.external_id);
    if (externalKeys.has(externalKey))
      blockingIssues.push(`duplicate external key: ${externalKey}`);
    externalKeys.add(externalKey);
  }

  for (const parentId of parentIds) {
    if (!ids.has(parentId)) blockingIssues.push(`orphan canonical parent id: ${parentId}`);
  }

  for (const alias of curated.aliases) {
    const target = key(alias.targetExternalSource, alias.targetExternalId);
    if (!externalKeys.has(target)) blockingIssues.push(`alias target missing: ${target}`);
    if (!String(alias.alias ?? "").trim()) blockingIssues.push(`empty alias for: ${target}`);
  }

  const regionSlugs = new Set();
  for (const region of curated.regions) {
    if (!region.slug || !region.nameAr) blockingIssues.push("region missing slug or nameAr");
    if (regionSlugs.has(region.slug)) blockingIssues.push(`duplicate region slug: ${region.slug}`);
    regionSlugs.add(region.slug);
    for (const member of region.members ?? []) {
      const target = key(member.targetExternalSource, member.targetExternalId);
      if (!externalKeys.has(target)) blockingIssues.push(`region member target missing: ${target}`);
    }
  }

  return {
    canonicalNodes: canonicalNodes.length,
    aliases: curated.aliases.length,
    regions: curated.regions.length,
    regionMembers: curated.regions.reduce((sum, region) => sum + (region.members?.length ?? 0), 0),
    blockingIssueCount: blockingIssues.length,
    blockingIssues: blockingIssues.slice(0, 200),
  };
}

async function assertSchemaReady(supabase) {
  const checks = [
    ["location_nodes", "id"],
    ["location_search_aliases", "id"],
    ["location_regions", "id"],
    ["location_region_members", "region_id"],
  ];
  for (const [table, column] of checks) {
    const { error } = await supabase.from(table).select(column).limit(1);
    if (error) throw new Error(`Required schema is not ready (${table}): ${error.message}`);
  }
}

async function upsertNodes(supabase, canonicalNodes) {
  const ordered = [...canonicalNodes].sort((a, b) => Number(a.depth ?? 0) - Number(b.depth ?? 0));
  let written = 0;
  for (let index = 0; index < ordered.length; index += batchSize) {
    const batch = ordered.slice(index, index + batchSize).map(stripUnknownNodeFields);
    const { error } = await supabase
      .from("location_nodes")
      .upsert(batch, { onConflict: "external_source,external_id" });
    if (error) throw new Error(`Node upsert failed at ${written}: ${error.message}`);
    written += batch.length;
    console.log(`location_nodes ${written}/${ordered.length}`);
  }
}

async function loadNodeIdMap(supabase, canonicalNodes) {
  const sourceNames = [...new Set(canonicalNodes.map((node) => node.external_source))];
  const result = new Map();
  for (const source of sourceNames) {
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("location_nodes")
        .select("id,external_source,external_id")
        .eq("external_source", source)
        .range(from, from + pageSize - 1);
      if (error) throw new Error(`Failed loading node map: ${error.message}`);
      for (const row of data ?? []) result.set(key(row.external_source, row.external_id), row.id);
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }
  }
  return result;
}

async function upsertAliases(supabase, aliases, nodeMap) {
  const rows = aliases.map((alias) => ({
    location_node_id: requireMappedNode(
      nodeMap,
      alias.targetExternalSource,
      alias.targetExternalId,
    ),
    alias: alias.alias,
    normalized_alias: String(alias.alias).trim(),
    language_code: alias.languageCode ?? null,
    alias_type: alias.aliasType ?? "alternate_name",
    source_name: alias.sourceName ?? null,
    source_url: alias.sourceUrl ?? null,
    source_note: alias.sourceNote ?? null,
    confidence: alias.confidence ?? "medium",
    review_status: alias.reviewStatus ?? "unreviewed",
  }));
  if (!rows.length) return;
  const { error } = await supabase
    .from("location_search_aliases")
    .upsert(rows, { onConflict: "location_node_id,normalized_alias" });
  if (error) throw new Error(`Alias upsert failed: ${error.message}`);
}

async function upsertRegions(supabase, regions) {
  const rows = regions.map((region) => ({
    country_code: region.countryCode ?? "SY",
    slug: region.slug,
    name_ar: region.nameAr,
    name_en: region.nameEn ?? null,
    region_type: region.regionType ?? "vernacular",
    is_complete: Boolean(region.isComplete),
    is_active: region.isActive !== false,
    source_name: region.sourceName ?? null,
    source_url: region.sourceUrl ?? null,
    source_note: region.sourceNote ?? null,
    confidence: region.confidence ?? "medium",
    review_status: region.reviewStatus ?? "unreviewed",
  }));
  if (rows.length) {
    const { error } = await supabase
      .from("location_regions")
      .upsert(rows, { onConflict: "country_code,slug" });
    if (error) throw new Error(`Region upsert failed: ${error.message}`);
  }
  const { data, error } = await supabase
    .from("location_regions")
    .select("id,country_code,slug")
    .in(
      "slug",
      regions.map((region) => region.slug),
    );
  if (error) throw new Error(`Failed loading regions: ${error.message}`);
  return new Map((data ?? []).map((row) => [`${row.country_code}|${row.slug}`, row.id]));
}

async function upsertRegionMembers(supabase, regions, regionMap, nodeMap) {
  const rows = [];
  for (const region of regions) {
    const regionId = regionMap.get(`${region.countryCode ?? "SY"}|${region.slug}`);
    if (!regionId) throw new Error(`Region id missing after upsert: ${region.slug}`);
    for (const member of region.members ?? []) {
      rows.push({
        region_id: regionId,
        location_node_id: requireMappedNode(
          nodeMap,
          member.targetExternalSource,
          member.targetExternalId,
        ),
        relation_type: member.relationType ?? "member",
        source_name: member.sourceName ?? null,
        source_url: member.sourceUrl ?? null,
        source_note: member.sourceNote ?? null,
        confidence: member.confidence ?? "medium",
        review_status: member.reviewStatus ?? "unreviewed",
      });
    }
  }
  if (!rows.length) return;
  const { error } = await supabase
    .from("location_region_members")
    .upsert(rows, { onConflict: "region_id,location_node_id" });
  if (error) throw new Error(`Region member upsert failed: ${error.message}`);
}

function stripUnknownNodeFields(node) {
  const allowed = [
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
  ];
  return Object.fromEntries(allowed.map((field) => [field, node[field] ?? null]));
}

function requireMappedNode(map, source, externalId) {
  const mapped = map.get(key(source, externalId));
  if (!mapped) throw new Error(`Canonical node not found after import: ${key(source, externalId)}`);
  return mapped;
}

function key(source, externalId) {
  return `${String(source ?? "").trim()}|${String(externalId ?? "").trim()}`;
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const name = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) result[name] = true;
    else {
      result[name] = next;
      index += 1;
    }
  }
  return result;
}
