import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/lib/contact-phone.ts", import.meta.url), "utf8");

function loadFunction(name) {
  const start = source.indexOf(`export function ${name}`);
  assert.notEqual(start, -1, `Missing ${name}`);
  const next = source.indexOf("\nexport function ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

test("Syrian local mobile numbers are converted to international format", () => {
  assert.match(source, /\^09\\d\{8\}\$/);
  assert.match(source, /SYRIA_COUNTRY_CODE/);
  assert.match(source, /digits\.slice\(1\)/);
});

test("Arabic and Persian digits are accepted", () => {
  assert.match(source, /\[٠-٩\]/);
  assert.match(source, /\[۰-۹\]/);
});

test("WhatsApp URLs never retain a local leading zero", () => {
  const whatsapp = loadFunction("whatsappHref");
  assert.match(whatsapp, /https:\/\/wa\.me\/\$\{normalized\.digits\}/);
  assert.doesNotMatch(whatsapp, /replace\(\/\[\^\\d\]/);
});

test("telephone URLs use E.164 form", () => {
  const phone = loadFunction("phoneHref");
  assert.match(phone, /tel:\$\{normalized\.e164\}/);
});

test("invalid short or zero-prefixed international values are rejected", () => {
  assert.match(source, /\^\\d\{8,15\}\$/);
  assert.match(source, /\^0/);
});
