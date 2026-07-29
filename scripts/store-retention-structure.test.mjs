import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../src/mobile-structural-ui.css", import.meta.url), "utf8");

assert.match(css, /\.rawaj-storefront-identity\s*{/);
assert.match(css, /var\(--rawaj-card-background\)/);
assert.doesNotMatch(css, /#fffaf2|#18352f|#536b63/);
assert.match(css, /\.rawaj-storefront-identity__content\s*{[\s\S]*min-height:\s*18rem/);
assert.match(css, /\.rawaj-account-collection-v3\s*>\s*section/);
assert.match(css, /\.rawaj-account-activity-v3\s*>\s*section/);
assert.match(css, /padding:\s*1rem !important/);

console.log("store retention structural contract passed");
