import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const campaignApi = await readFile(new URL("../src/lib/api/campaigns.ts", import.meta.url), "utf8");
const campaignRoute = await readFile(
  new URL("../src/routes/admin.campaigns.tsx", import.meta.url),
  "utf8",
);
const adminShell = await readFile(new URL("../src/routes/admin.tsx", import.meta.url), "utf8");
const errorTypes = await readFile(
  new URL("../src/lib/classifieds-types.ts", import.meta.url),
  "utf8",
);

test("campaign workspace remains permission-scoped in the shell and route", () => {
  assert.match(adminShell, /permission: "canManageAdCampaigns"/);
  assert.match(campaignRoute, /hasPermission\("canManageAdCampaigns"\)/);
});

test("only the newest campaign and creative reads may update the workspace", () => {
  assert.match(campaignApi, /let campaignReadGeneration = 0/);
  assert.match(campaignApi, /let creativeReadGeneration = 0/);
  assert.match(campaignApi, /const requestGeneration = \+\+campaignReadGeneration/);
  assert.match(campaignApi, /const requestGeneration = \+\+creativeReadGeneration/);
  assert.match(campaignApi, /requestGeneration !== campaignReadGeneration/);
  assert.match(campaignApi, /requestGeneration !== creativeReadGeneration/);
});

test("campaign and creative writes use resource-scoped in-flight locks", () => {
  assert.match(campaignApi, /const campaignMutationInFlight = new Set<string>\(\)/);
  assert.match(campaignApi, /const creativeMutationInFlight = new Set<string>\(\)/);
  assert.match(campaignApi, /campaignMutationInFlight\.has\(operationKey\)/);
  assert.match(campaignApi, /creativeMutationInFlight\.has\(operationKey\)/);
  assert.match(campaignApi, /campaignMutationInFlight\.delete\(operationKey\)/);
  assert.match(campaignApi, /creativeMutationInFlight\.delete\(operationKey\)/);
});

test("stale and duplicate operations have explicit non-database error codes", () => {
  assert.match(errorTypes, /\| "stale_request"/);
  assert.match(errorTypes, /\| "operation_in_progress"/);
  assert.match(campaignApi, /code: "stale_request"/);
  assert.match(campaignApi, /code: "operation_in_progress"/);
});
