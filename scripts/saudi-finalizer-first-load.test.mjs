import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("Saudi finalizer deploys current Saudi API and preserves its service binding", async () => {
  const workflow = await readFile(".github/workflows/saudi-finalize-production.yml", "utf8");
  assert.doesNotMatch(workflow, /ops\/rawaj-saudi-cloudflare-bootstrap/);
  assert.doesNotMatch(workflow, /delete config\.services/);
  assert.match(
    workflow,
    /config\.services = \[\{ binding: "SAUDI_API", service: "rawaj-saudi-classifieds" \}\]/,
  );
  assert.match(workflow, /working-directory: saudi-repo\/cloudflare\/worker/);
});

test("Saudi finalizer blocks first-load regressions on Worker and custom domain", async () => {
  const workflow = await readFile(".github/workflows/saudi-finalize-production.yml", "utf8");
  assert.match(workflow, /scripts\/saudi-first-load-api-gateway\.test\.mjs/);
  assert.match(workflow, /for origin in "\$SITE_URL" "\$FINAL_SITE_URL"/);
  assert.match(workflow, /\$origin\/v1\/references/);
  assert.match(workflow, /سيارات ومركبات/);
  assert.match(workflow, /_vercel\/insights\/script\.js/);
});
