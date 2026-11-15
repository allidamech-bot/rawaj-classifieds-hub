import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [shell, dashboard, baseCss, finalCss, stableStyles, pkg, auditV8] = await Promise.all([
  readFile(new URL("../src/routes/admin.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/admin.index.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
  readFile(new URL("../src/admin-final-polish.css", import.meta.url), "utf8"),
  readFile(new URL("../src/auth-stable-route-styles.css", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("../src/rawaj-audit-corrections-v8.css", import.meta.url), "utf8"),
]);

const css = `${baseCss}\n${finalCss}`;

test("phase 8 scopes the permission-preserving admin shell and dashboard", () => {
  assert.match(shell, /rawaj-admin-v3/);
  assert.match(shell, /auth\.hasPermission/);
  assert.match(shell, /labelEn: "Command center"/);
  assert.match(shell, /text\(tab\.labelAr, tab\.labelEn\)/);
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

test("admin source styles retain approved petrol/ivory colors without retired gradients", () => {
  const phase8 = baseCss.split("/* Premium UI phase 8:")[1]?.split("/* Premium UI phase 9:")[0];
  assert.ok(phase8, "phase 8 base admin styles exist");
  assert.match(phase8, /--admin-v3-coral: var\(--rawaj-identity-teal\)/);
  assert.match(phase8, /background: var\(--rawaj-identity-petrol\)/);
  assert.doesNotMatch(phase8, /(?:linear|radial)-gradient|#df693c|#ee7a4c|#d75c32|#98381d/);

  const adminV8 = auditV8.split("Admin: readable semantic surfaces")[1]
    ?.split("@media (max-width: 39.99rem)")[0];
  assert.ok(adminV8, "legacy V8 admin paint section exists");
  assert.match(adminV8, /background: var\(--rawaj-card-background\)/);
  assert.match(adminV8, /background: var\(--rawaj-elevated-background\)/);
  assert.doesNotMatch(adminV8, /(?:linear|radial)-gradient|#373229|#303137|#2c2d33/);
});

test("admin console remains touch-safe and reduced-motion safe", () => {
  assert.match(finalCss, /@media \(hover:none\),\(pointer:coarse\)/);
  assert.match(finalCss, /@media \(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(finalCss, /translateY\(-2px\)/);
});

test("final admin polish remains loaded through authenticated route transitions", () => {
  assert.match(stableStyles, /@import "\.\/admin-final-polish\.css"/);
});

test("phase 8 contract is permanent", () => {
  const parsed = JSON.parse(pkg);
  assert.equal(
    parsed.scripts["test:admin-console-v3"],
    "node --test scripts/admin-console-v3.test.mjs",
  );
  assert.match(parsed.scripts.precheck, /test:admin-console-v3/);
});
