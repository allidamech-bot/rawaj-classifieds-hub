import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { globSync } from "glob";
import { rimrafSync } from "rimraf";
import { z } from "zod";

const require = createRequire(import.meta.url);

test("patched Firebase transitive gRPC dependency still exposes the supported client API", () => {
  const grpc = require("@grpc/grpc-js");
  assert.equal(typeof grpc.Client, "function");
  assert.equal(typeof grpc.credentials.createInsecure, "function");
  const credentials = grpc.credentials.createInsecure();
  assert.equal(typeof credentials._isSecure, "function");
  assert.equal(credentials._isSecure(), false);
});

test("Zod v4 keeps the app's search preprocessor, optional enums and fallback behavior", () => {
  const schema = z.object({
    q: z.preprocess(
      (value) => (typeof value === "string" ? value.trim() : undefined),
      z.string().max(160).optional(),
    ),
    sort: z.enum(["latest", "cheapest"]).optional().catch("latest"),
    with_photos: z.preprocess(
      (value) => (value === "true" ? true : value === "false" ? false : undefined),
      z.boolean().optional(),
    ),
  });
  assert.deepEqual(schema.parse({ q: "  cars  ", sort: "unknown", with_photos: "true" }), {
    q: "cars",
    sort: "latest",
    with_photos: true,
  });
  assert.equal(schema.safeParse({ q: "a".repeat(161) }).success, false);
});

test("patched glob and rimraf still find and remove local fixture files", () => {
  const dir = mkdtempSync(join(tmpdir(), "rawaj-deps-"));
  try {
    writeFileSync(join(dir, "safe-fixture.test"), "ok");
    assert.deepEqual(globSync("**/*.test", { cwd: dir }), ["safe-fixture.test"]);
  } finally {
    rimrafSync(dir);
  }
  assert.equal(existsSync(dir), false);
});
