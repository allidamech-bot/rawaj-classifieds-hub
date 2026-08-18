import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sellerApi = await readFile(
  new URL("../src/lib/api/seller-cloudflare.ts", import.meta.url),
  "utf8",
);

test("public seller API errors do not expose upstream response messages to UI", () => {
  assert.match(sellerApi, /message: publicSellerErrorMessage\(operation, code\)/);
  assert.doesNotMatch(sellerApi, /message: payload\?\.error\?\.message/);
  assert.match(sellerApi, /if \(code === "not_found"\) return "بيانات المتجر غير متاحة حالياً\."/);
});
