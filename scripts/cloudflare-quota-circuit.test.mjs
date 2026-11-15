import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

async function loadIsolatedQuotaCircuit() {
  const source = await read("src/lib/public-data/worker-quota-backoff.ts");
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
}

test("HTTP 429 from application JSON is not mistaken for account quota Error 1027", async () => {
  const circuit = await loadIsolatedQuotaCircuit();
  const response = new Response(JSON.stringify({ error: { code: "rate_limited" } }), {
    status: 429,
    headers: { "Content-Type": "application/json" },
  });
  assert.equal(await circuit.observeWorkerQuotaResponse(response, 1000), false);
  assert.equal(circuit.isWorkerQuotaReadCooldownActive(1001), false);
});

test("only a Cloudflare edge 429 page containing 1027 starts the 2-minute read cooldown", async () => {
  const circuit = await loadIsolatedQuotaCircuit();
  const other = new Response("Too many requests", {
    status: 429,
    headers: { "Content-Type": "text/html" },
  });
  assert.equal(await circuit.observeWorkerQuotaResponse(other, 1000), false);

  const response = new Response("<html>This website has been temporarily rate limited. Error 1027</html>", {
    status: 429,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
  assert.equal(await circuit.observeWorkerQuotaResponse(response, 1000), true);
  assert.equal(circuit.isWorkerQuotaReadCooldownActive(1000), true);
  assert.equal(circuit.isWorkerQuotaReadCooldownActive(120999), true);
  assert.equal(circuit.isWorkerQuotaReadCooldownActive(121000), false);
  assert.equal(response.bodyUsed, false, "recognition must not consume the response body");
});

test("quota circuit is wired to public and authenticated reads, not write operations", async () => {
  const [publicClient, auth, sellers] = await Promise.all([
    read("src/lib/public-data/cloudflare-client.ts"),
    read("src/lib/cloudflare-auth.ts"),
    read("src/lib/api/seller-cloudflare.ts"),
  ]);
  for (const source of [publicClient, auth, sellers]) {
    assert.match(source, /isWorkerQuotaReadCooldownActive\(\)/);
    assert.match(source, /observeWorkerQuotaResponse\(response\)/);
  }
  assert.match(auth, /\(init\.method \?\? "GET"\)\.toUpperCase\(\) === "GET"/);
  assert.match(auth, /const first = await sendRequest<T>/);
  assert.doesNotMatch(auth, /isWorkerQuotaReadCooldownActive\(\)\s*\?\s*return/);
});
