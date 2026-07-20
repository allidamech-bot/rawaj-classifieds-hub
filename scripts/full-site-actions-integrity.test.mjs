import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function collectFiles(directory, predicate) {
  const absolute = new URL(`${directory}/`, root);
  const entries = await readdir(absolute, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(relative, predicate)));
    else if (predicate(relative)) files.push(relative);
  }
  return files.sort();
}

async function readSources(files) {
  return Promise.all(
    files.map(async (file) => ({
      file,
      source: await readFile(new URL(file, root), "utf8"),
    })),
  );
}

function count(source, expression) {
  return [...source.matchAll(expression)].length;
}

const routeFiles = await collectFiles(
  "src/routes",
  (file) => file.endsWith(".tsx") && !path.posix.basename(file).startsWith("admin"),
);
const componentFiles = [
  ...(await collectFiles("src/features", (file) => file.endsWith(".tsx"))),
  ...(await collectFiles("src/components", (file) => file.endsWith(".tsx"))),
];
const sources = await readSources([...routeFiles, ...componentFiles]);
const combined = sources.map((entry) => entry.source).join("\n");
const interactiveRoutes = routeFiles.filter((file) => {
  const source = sources.find((entry) => entry.file === file)?.source ?? "";
  return /<(?:button|form|input|select|textarea)\b|onClick=|onSubmit=/.test(source);
});
const staticOrLoaderRoutes = routeFiles.filter((file) => !interactiveRoutes.includes(file));

const inventory = {
  routeFiles: routeFiles.length,
  interactiveRoutes: interactiveRoutes.length,
  staticOrLoaderRoutes: staticOrLoaderRoutes.length,
  featureAndComponentFiles: componentFiles.length,
  buttons: count(combined, /<button\b/g),
  links: count(combined, /<(?:Link|a)\b/g),
  forms: count(combined, /<form\b/g),
  fields: count(combined, /<(?:input|select|textarea)\b/g),
  busyStates: count(combined, /aria-busy=/g),
  disabledStates: count(combined, /disabled=/g),
};
inventory.interactiveElements =
  inventory.buttons + inventory.links + inventory.forms + inventory.fields;

console.log(`FULL_SITE_ACTIONS_INVENTORY ${JSON.stringify(inventory)}`);
console.log(`FULL_SITE_INTERACTIVE_ROUTES ${JSON.stringify(interactiveRoutes)}`);
console.log(`FULL_SITE_STATIC_ROUTES ${JSON.stringify(staticOrLoaderRoutes)}`);

test("all public routes are inventoried", () => {
  assert.ok(routeFiles.length >= 30, `Expected at least 30 public route files, found ${routeFiles.length}`);
  assert.ok(interactiveRoutes.length >= 18, "Expected the operational route surface to be represented");
  assert.ok(inventory.buttons >= 100, `Expected a substantial button inventory, found ${inventory.buttons}`);
  assert.ok(
    inventory.interactiveElements >= 300,
    `Expected at least 300 interactive elements, found ${inventory.interactiveElements}`,
  );
  assert.ok(inventory.busyStates >= 27, "Expected measured explicit busy-state coverage");
  assert.ok(inventory.disabledStates >= 100, "Expected disabled-state coverage across controls");
});

test("critical public journeys have permanent contracts", async () => {
  const contracts = [
    "scripts/public-auth-actions-integrity.test.mjs",
    "scripts/listing-actions-runtime-integrity.test.mjs",
    "scripts/saved-items-actions-runtime-integrity.test.mjs",
    "scripts/listing-detail-actions-runtime-integrity.test.mjs",
    "scripts/chat-actions-runtime-integrity.test.mjs",
    "scripts/notification-actions-runtime-integrity.test.mjs",
    "scripts/trust-actions-runtime-integrity.test.mjs",
    "scripts/public-discovery-review-actions-integrity.test.mjs",
    "scripts/profile-public-operations-integrity.test.mjs",
  ];
  const existing = new Set(await collectFiles("scripts", (file) => file.endsWith(".test.mjs")));
  for (const contract of contracts) assert.ok(existing.has(contract), `Missing contract: ${contract}`);
});

test("no temporary action-repair generators or write workflows remain", async () => {
  const scripts = await collectFiles("scripts", () => true);
  const workflows = await collectFiles(".github/workflows", () => true);
  const auditBatchNames =
    "(?:public-auth|listing-actions|listing-detail-actions|saved-items-actions|chat-actions|notification-actions|trust-actions|profile-seller-actions|category-directory-actions|review-card-actions|search-actions|final-public-operations)";
  const temporaryScriptPattern = new RegExp(
    `scripts/(?:apply-${auditBatchNames}-integrity|fix-${auditBatchNames}-generator)\\.mjs$`,
  );
  const temporaryWorkflowPattern = new RegExp(
    `\\.github/workflows/apply-${auditBatchNames}-integrity\\.ya?ml$`,
  );
  const temporaryScripts = scripts.filter((file) => temporaryScriptPattern.test(file));
  const temporaryWorkflows = workflows.filter((file) => temporaryWorkflowPattern.test(file));
  assert.deepEqual(temporaryScripts, []);
  assert.deepEqual(temporaryWorkflows, []);
});

test("public mutations expose loading, disabled, or single-flight protection", () => {
  const highRiskFiles = [
    "src/routes/login.tsx",
    "src/routes/reset-password.tsx",
    "src/routes/add-listing.tsx",
    "src/routes/listings.$id.tsx",
    "src/routes/profile/listings.$id.tsx",
    "src/routes/profile/listings.tsx",
    "src/routes/chats.tsx",
    "src/routes/notifications.tsx",
    "src/routes/favorites.tsx",
    "src/routes/saved-searches.tsx",
    "src/routes/support.tsx",
    "src/routes/verification.tsx",
    "src/routes/promotion.tsx",
    "src/routes/profile.tsx",
    "src/routes/seller.$id.tsx",
  ];
  for (const file of highRiskFiles) {
    const source = sources.find((entry) => entry.file === file)?.source;
    assert.ok(source, `Missing high-risk route: ${file}`);
    assert.match(
      source,
      /useRef\(|aria-busy=|disabled=|InFlightRef|ScopesRef/,
      `Missing action protection in ${file}`,
    );
    assert.match(source, /catch\b|\.catch\(/, `Missing thrown-error handling in ${file}`);
  }
});
