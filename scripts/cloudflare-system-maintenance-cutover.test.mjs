import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("public system status exposes only safe maintenance booleans", async () => {
  const [entry, controls] = await Promise.all([
    read("cloudflare/worker/src/entry.ts"),
    read("cloudflare/worker/src/system-controls.ts"),
  ]);

  assert.match(entry, /path === "\/v1\/system-status"/);
  assert.match(controls, /PUBLIC_STATUS_PATH = "\/v1\/system-status"/);
  assert.match(controls, /maintenanceMode:/);
  assert.match(controls, /emergencyReadOnly:/);
  assert.match(controls, /Cache-Control/);
  assert.match(controls, /stale-while-revalidate/);

  const publicBlock = controls.slice(
    controls.indexOf("if (path === PUBLIC_STATUS_PATH)"),
    controls.indexOf('if (request.method === "GET")', controls.indexOf("if (path === PUBLIC_STATUS_PATH)")),
  );
  assert.doesNotMatch(publicBlock, /reason|updated_by|updatedAt|authenticate/);
});

test("global shell notice displays the exact owner-approved maintenance message", async () => {
  const notice = await read("src/components/OfflineNotice.tsx");

  assert.match(notice, /cloudflareApiRequest<PublicSystemStatus>\("\/v1\/system-status"\)/);
  assert.match(notice, /الموقع في وضع الصيانة حاليًا\./);
  assert.match(notice, /rawaj-maintenance-notice/);
  assert.match(notice, /rawaj:system-control-changed/);
});

test("owner maintenance control explains its actual site-wide effect", async () => {
  const ownerControls = await read("src/routes/admin.owner-controls.tsx");

  assert.match(ownerControls, /ar: "الموقع تحت الصيانة"/);
  assert.match(ownerControls, /يعرض تنبيهًا أعلى جميع الصفحات/);
  assert.match(ownerControls, /window\.dispatchEvent\(new Event\("rawaj:system-control-changed"\)\)/);
});
