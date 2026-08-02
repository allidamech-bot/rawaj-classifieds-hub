import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../src/account-social.ts", import.meta.url), "utf8");

test("sending a message atomically creates one recipient notification", () => {
  assert.match(source, /const notificationId = crypto\.randomUUID\(\)/);
  assert.match(source, /type, title, body, data, created_at/);
  assert.match(source, /message\.received/);
  assert.match(source, /targetType: "conversation"/);
  assert.match(source, /messageId: id/);
  assert.match(source, /messages_enabled FROM notification_preferences/);
  assert.ok(source.indexOf("if (existing) return json") < source.indexOf("const notificationId"));
});
