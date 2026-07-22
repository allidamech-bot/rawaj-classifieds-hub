import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../src/mobile-structural-ui.css", import.meta.url), "utf8");
const stable = await readFile(new URL("../src/auth-stable-route-styles.css", import.meta.url), "utf8");

assert.match(css, /rawaj-listing-studio-v4/);
assert.match(css, /rawaj-detail-media__stage/);
assert.match(css, /rawaj-messaging-v4/);
assert.match(css, /rawaj-trust-hero/);
assert.match(css, /rawaj-account-hub-v3/);
assert.match(css, /repeat\(2,minmax\(0,1fr\)\)/);
assert.match(css, /linear-gradient\(135deg,#fffaf2,#eef8f2 55%,#fff1e8\)/);
assert.match(stable, /mobile-structural-ui\.css/);

console.log("mobile structural page application contract passed");
