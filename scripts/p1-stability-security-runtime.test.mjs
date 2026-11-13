import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function workerSource(name) {
  return readFileSync(new URL(`../cloudflare/worker/src/${name}`, import.meta.url), "utf8");
}

function transpile(source, fileName) {
  return ts.transpileModule(source, {
    fileName,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
}

test("public listing details remove contact information recursively without losing safe attributes", () => {
  const exports = {};
  vm.runInNewContext(
    transpile(workerSource("public-listing-privacy.ts"), "public-listing-privacy.ts"),
    { exports },
  );

  const result = exports.sanitizePublicListingDetails({
    phone: "test-private-phone",
    contact_phone: "test-private-number",
    "contact.phone": "test-private-dotted-phone",
    email: "test-private-email",
    color: "blue",
    specifications: { whatsapp: "test-private-chat", "contact.email": "test-private-dotted-email", model: "valid-model" },
    sections: [{ contactWhatsApp: "test-private-chat", "contact.whatsapp": "test-private-dotted-chat", year: 2026 }],
  });
  assert.equal(result.phone, undefined);
  assert.equal(result.contact_phone, undefined);
  assert.equal(result["contact.phone"], undefined);
  assert.equal(result.email, undefined);
  assert.equal(result.specifications.whatsapp, undefined);
  assert.equal(result.specifications["contact.email"], undefined);
  assert.equal(result.sections[0]["contact.whatsapp"], undefined);
  assert.equal(result.sections[0].contactWhatsApp, undefined);
  assert.equal(result.specifications.model, "valid-model");
  assert.equal(result.sections[0].year, 2026);
  assert.equal(result.color, "blue");
});

test("limiter ignores invalid bearer identity and uses stable subject for verified Firebase tokens", async () => {
  const source = workerSource("security.ts");
  const start = source.indexOf("async function actorKey(");
  const end = source.indexOf("function readContentLength(", start);
  assert.ok(start >= 0 && end > start, "actorKey must be present");
  const exports = {};
  const verifyCalls = [];
  const code = transpile(
    source.slice(start, end) + "\nexports.actorKey = actorKey;",
    "isolated-actor-key.ts",
  );
  vm.runInNewContext(code, {
    exports,
    verifyFirebaseIdToken: async (token) => {
      verifyCalls.push(token);
      return token.startsWith("verified-session-")
        ? { subject: "firebase-user-42" }
        : null;
    },
  });
  const request = (token, ip) => ({
    headers: {
      get(key) {
        if (key === "Authorization") return token ? `Bearer ${token}` : null;
        if (key === "CF-Connecting-IP") return ip;
        return null;
      },
    },
  });
  const key = exports.actorKey;
  assert.equal(await key(request("invalid-a", "203.0.113.10"), {}), "ip:203.0.113.10");
  assert.equal(await key(request("invalid-b", "203.0.113.10"), {}), "ip:203.0.113.10");
  assert.equal(await key(request(null, "203.0.113.10"), {}), "ip:203.0.113.10");
  assert.equal(
    await key(request("verified-session-first", "203.0.113.10"), {}),
    "auth:firebase-user-42",
  );
  assert.equal(
    await key(request("verified-session-refreshed", "203.0.113.20"), {}),
    "auth:firebase-user-42",
  );
  assert.equal(await key(request("invalid-b", null), {}), "anonymous");
  assert.equal(verifyCalls.length, 5);
});
