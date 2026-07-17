import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const campaignApi = await readFile(new URL("../src/lib/api/campaigns.ts", import.meta.url), "utf8");
const campaignRoute = await readFile(
  new URL("../src/routes/admin.campaigns.tsx", import.meta.url),
  "utf8",
);
const adminShell = await readFile(new URL("../src/routes/admin.tsx", import.meta.url), "utf8");

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
  assert.match(campaignApi, /admin_campaign_list_stale_read/);
  assert.match(campaignApi, /admin_campaign_creatives_stale_read/);
});

test("campaign and creative writes use resource-scoped in-flight locks", () => {
  assert.match(campaignApi, /const campaignMutationInFlight = new Set<string>\(\)/);
  assert.match(campaignApi, /const creativeMutationInFlight = new Set<string>\(\)/);
  assert.match(campaignApi, /campaignMutationInFlight\.has\(operationKey\)/);
  assert.match(campaignApi, /creativeMutationInFlight\.has\(operationKey\)/);
  assert.match(campaignApi, /campaignMutationInFlight\.delete\(operationKey\)/);
  assert.match(campaignApi, /creativeMutationInFlight\.delete\(operationKey\)/);
  assert.match(campaignApi, /admin_campaign_save_in_progress/);
  assert.match(campaignApi, /admin_campaign_status_in_progress/);
  assert.match(campaignApi, /admin_campaign_creative_save_in_progress/);
});

test("duplicate operation failures stay inside the established error contract", () => {
  assert.match(campaignApi, /function staleReadResult<T>/);
  assert.match(campaignApi, /function operationInProgressResult<T>/);
  assert.match(campaignApi, /code: "unknown", message: "", operation/);
  assert.match(campaignApi, /code: "unknown", message, operation/);
});
