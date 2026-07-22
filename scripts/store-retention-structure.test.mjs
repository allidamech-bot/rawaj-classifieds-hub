import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../src/mobile-structural-ui.css", import.meta.url), "utf8");

assert.match(css, /\.rawaj-storefront-identity\{/);
assert.match(css, /#fffaf2/);
assert.match(css, /\.rawaj-storefront-identity__content\{min-height:18rem/);
assert.match(css, /\.rawaj-account-collection-v3>section/);
assert.match(css, /\.rawaj-account-activity-v3>section/);
assert.match(css, /padding:1rem!important/);

console.log("store retention structural contract passed");
