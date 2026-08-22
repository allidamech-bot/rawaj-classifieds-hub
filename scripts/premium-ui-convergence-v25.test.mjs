import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [routeStyles, css, ownerSummary, ownerRoute, dialog, button, input, card] = await Promise.all(
  [
    readFile(new URL("../src/lib/route-styles.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/rawaj-ui-convergence-v25.css", import.meta.url), "utf8"),
    readFile(
      new URL("../src/features/storefront/OwnerStoreWorkspaceSummary.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/routes/profile/listings.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/ui/dialog.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/ui/button.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/ui/input.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/ui/card.tsx", import.meta.url), "utf8"),
  ],
);

test("the convergence contract loads once and after the compatibility stack", () => {
  assert.match(routeStyles, /rawaj-ui-convergence-v25\.css\?url/);
  assert.ok(
    routeStyles.indexOf("uiConvergenceV25Css,") >
      routeStyles.indexOf("stabilityAccessibilityFixesCss,"),
  );

  for (const duplicate of [
    "rawaj-semantic-tokens.css",
    "owner-listings-workspace-v9.css",
    "rawaj-marketplace-premium-v14.css",
    "rawaj-marketplace-final-polish-v15.css",
    "rawaj-marketplace-unified-v16.css",
    "stability-accessibility-fixes.css",
  ]) {
    assert.doesNotMatch(
      routeStyles,
      new RegExp(`import \\\"\\.\\.\\/${duplicate.replaceAll(".", "\\\\.")}\\\";`),
    );
  }
});

test("protected header surfaces are outside the convergence selectors", () => {
  assert.doesNotMatch(css, /rawaj-(?:app-header|shell-header|header-)/);
  assert.match(css, /rawaj-app-shell__content/);
});

test("shared controls and cards expose one premium sizing contract", () => {
  assert.match(css, /--rawaj-control-height:\s*3rem/);
  assert.match(css, /--rawaj-control-height-lg:\s*3\.25rem/);
  assert.match(css, /--rawaj-radius-button:\s*0\.9rem/);
  assert.match(css, /data-ui="input"/);
  assert.match(css, /data-ui="card"/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(button, /aria-busy:cursor-wait/);
  assert.match(input, /hover:border-\[var\(--rawaj-border-active\)\]/);
  assert.match(card, /interactive &&/);
});

test("My Store presents explicit action priority and narrow-screen containment", () => {
  assert.match(ownerSummary, /data-priority="primary"/);
  assert.match(ownerSummary, /data-priority="promotion"/);
  assert.match(ownerSummary, /data-priority="secondary"/);
  assert.match(ownerRoute, /<strong className="rawaj-owner-tab-count">/);
  assert.match(css, /data-resolved-pathname="\/profile\/listings"/);
  assert.match(css, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 359px\)/);
  assert.match(css, /overflow-x:\s*clip/);
  assert.match(css, /\.rawaj-owner-tab-count[\s\S]*?color:\s*#151d20 !important/);
  assert.match(ownerRoute, /rawaj-owner-listing-card__overview/);
  assert.match(ownerRoute, /rawaj-owner-listing-management__top-actions/);
  assert.match(ownerRoute, /text\("المزيد", "More"\)/);
  assert.doesNotMatch(ownerRoute, /text\("لا يوجد تفاعل بعد", "No activity yet"\)/);
  assert.match(
    css,
    /\.rawaj-owner-listing-card__overview[\s\S]*?grid-template-columns:\s*clamp\(7\.25rem/,
  );
  assert.match(
    css,
    /\.rawaj-owner-listing-card[\s\S]*?\.rawaj-product-media[\s\S]*?aspect-ratio:\s*1 \/ 1/,
  );
  assert.doesNotMatch(
    css,
    /\.rawaj-owner-listing-card__signals\s*>\s*span\s*\{[\s\S]*?flex:\s*1 1 100%/,
  );
  assert.match(
    css,
    /\.rawaj-owner-workspace-summary__actions\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4/,
  );
  assert.match(css, /\.rawaj-storefront-owner-tabs\s*\{[\s\S]*?grid-template-columns:\s*repeat\(5/);
  assert.match(css, /\.rawaj-owner-workspace-summary__bio\s*\{[\s\S]*?display:\s*none/);
});

test("owner destructive confirmations use focus-managed dialogs", () => {
  assert.match(dialog, /showCloseButton\?: boolean/);
  assert.match(ownerRoute, /<Dialog/);
  assert.match(ownerRoute, /<DialogTitle/);
  assert.match(ownerRoute, /<DialogDescription/);
  assert.match(ownerRoute, /showCloseButton=\{false\}/);
  assert.doesNotMatch(ownerRoute, /role="dialog"/);
  assert.doesNotMatch(ownerRoute, /opacity-75/);
});
