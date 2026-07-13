import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootRoute = await readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8");
const foundation = await readFile(new URL("../src/design-foundation.css", import.meta.url), "utf8");

test("canonical design foundation is loaded after legacy visual layers", () => {
  const foundationLink = rootRoute.indexOf('{ rel: "stylesheet", href: designFoundationCss }');
  const finalLegacyLink = rootRoute.indexOf(
    '{ rel: "stylesheet", href: launchReadinessVisualPolishCss }',
  );

  assert.notEqual(foundationLink, -1, "design foundation stylesheet must be linked");
  assert.ok(
    foundationLink > finalLegacyLink,
    "canonical tokens must load after legacy visual layers during migration",
  );
});

test("canonical design foundation exposes required semantic contracts", () => {
  const requiredTokens = [
    "--rawaj-page-background",
    "--rawaj-card-background",
    "--rawaj-primary",
    "--rawaj-primary-deep",
    "--rawaj-accent-orange",
    "--rawaj-accent-gold",
    "--rawaj-text-primary",
    "--rawaj-text-secondary",
    "--rawaj-border",
    "--rawaj-muted-surface",
    "--rawaj-success",
    "--rawaj-warning",
    "--rawaj-danger",
    "--rawaj-touch-target",
  ];

  for (const token of requiredTokens) {
    assert.match(foundation, new RegExp(`${token.replaceAll("-", "\\-")}\\s*:`));
  }

  assert.match(foundation, /min-height:\s*100dvh/);
  assert.match(foundation, /env\(safe-area-inset-bottom/);
  assert.match(foundation, /prefers-reduced-motion/);
});
