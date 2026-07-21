import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [shell, dashboard, css, pkg] = await Promise.all([
  readFile(new URL("../src/routes/admin.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/admin.index.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

test("phase 8 scopes the permission-preserving admin shell and dashboard", () => {
  assert.match(shell, /rawaj-admin-v3/);
  assert.match(shell, /auth\.hasPermission/);
  assert.match(shell, /<Outlet \/>/);
  assert.match(dashboard, /rawaj-admin-dashboard-v3/);
});

test("admin navigation, KPI surfaces, tables, and inputs share one premium system", () => {
  assert.match(css, /--admin-v3-coral/);
  assert.match(css, /nav a\[aria-current="page"\]/);
  assert.match(css, /rawaj-admin-dashboard-v3/);
  assert.match(css, /role="columnheader"/);
  assert.match(css, /:focus-visible/);
});

test("admin console remains responsive and reduced-motion safe", () => {
  assert.match(css, /@media \(max-width: 639px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /translateY\(-2px\)/);
});

test("phase 8 contract is permanent", () => {
  const parsed = JSON.parse(pkg);
  assert.equal(parsed.scripts["test:admin-console-v3"], "node --test scripts/admin-console-v3.test.mjs");
  assert.match(parsed.scripts.precheck, /test:admin-console-v3/);
});
