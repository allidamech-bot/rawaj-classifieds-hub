#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
const nodesPath = resolve(args.nodes ?? "data/locations/syria-ocha-location-nodes.json");
const nodes = JSON.parse(await readFile(nodesPath, "utf8"));

if (!Array.isArray(nodes)) {
  throw new Error("Canonical location nodes JSON must contain an array.");
}

const source = "ocha-hdx-cod-ab-syr";
const settlementTypes = new Set(["city", "town", "village", "locality"]);
const sourceNodes = nodes.filter(
  (node) => node?.external_source === source && settlementTypes.has(node?.node_type),
);

const counts = {
  city: 0,
  town: 0,
  village: 0,
  locality: 0,
};

for (const node of sourceNodes) {
  counts[node.node_type] += 1;
}

const total = sourceNodes.length;
const explicitSettlementTypes = counts.city + counts.town + counts.village;
const localityRatio = total > 0 ? counts.locality / total : 0;
const explicitRatio = total > 0 ? explicitSettlementTypes / total : 0;
const blockingIssues = [];

if (total >= 100 && localityRatio >= 0.9 && explicitRatio <= 0.01) {
  blockingIssues.push(
    `location type collapse detected: ${counts.locality}/${total} (${(
      localityRatio * 100
    ).toFixed(2)}%) OCHA settlement nodes map to locality while only ${explicitSettlementTypes} map to city/town/village`,
  );
}

const report = {
  source,
  nodesPath,
  counts,
  totalSettlementNodes: total,
  explicitSettlementTypes,
  localityRatio,
  explicitRatio,
  blockingIssueCount: blockingIssues.length,
  blockingIssues,
};

console.log(JSON.stringify(report, null, 2));

if (blockingIssues.length > 0) {
  throw new Error(
    "Syria location bundle blocked because populated-place types collapsed into generic locality nodes.",
  );
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
