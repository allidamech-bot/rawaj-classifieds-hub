import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const safetyApi = await readFile(new URL("../src/lib/api/safety-cases.ts", import.meta.url), "utf8");
const safetyRoute = await readFile(new URL("../src/routes/admin.safety.tsx", import.meta.url), "utf8");
const adminShell = await readFile(new URL("../src/routes/admin.tsx", import.meta.url), "utf8");

test("safety workspace is discoverable and permission-scoped", () => {
  assert.match(adminShell, /to: "\/admin\/safety"/);
  assert.match(adminShell, /labelAr: "مركز السلامة"/);
  assert.match(adminShell, /permission: "canManageReports"/);
  assert.match(safetyRoute, /hasPermission\("canManageReports"\)/);
});

test("only the newest safety reads may update the workspace", () => {
  assert.match(safetyApi, /let safetyCaseReadGeneration = 0/);
  assert.match(safetyApi, /let safetyStaffReadGeneration = 0/);
  assert.match(safetyApi, /const requestGeneration = \+\+safetyCaseReadGeneration/);
  assert.match(safetyApi, /const requestGeneration = \+\+safetyStaffReadGeneration/);
  assert.match(safetyApi, /requestGeneration !== safetyCaseReadGeneration/);
  assert.match(safetyApi, /requestGeneration !== safetyStaffReadGeneration/);
});

test("safety writes share a case-scoped in-flight lock", () => {
  assert.match(safetyApi, /const safetyCaseMutationInFlight = new Set<string>\(\)/);
  assert.match(safetyApi, /safetyCaseMutationInFlight\.has\(operationKey\)/);
  assert.match(safetyApi, /safetyCaseMutationInFlight\.add\(operationKey\)/);
  assert.match(safetyApi, /safetyCaseMutationInFlight\.delete\(operationKey\)/);
  assert.match(safetyApi, /admin_safety_case_save_in_progress/);
  assert.match(safetyApi, /admin_safety_case_status_in_progress/);
  assert.match(safetyApi, /admin_safety_case_escalation_in_progress/);
});
