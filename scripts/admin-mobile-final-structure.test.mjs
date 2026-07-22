import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../src/admin-final-polish.css", import.meta.url), "utf8");

assert.match(css, /max-width:96rem/);
assert.match(css, /nav\{display:flex;overflow-x:auto/);
assert.match(css, /min-height:3rem/);
assert.match(css, /min-width:42rem/);
assert.match(css, /max-height:calc\(100dvh - 2rem\)/);
assert.match(css, /linear-gradient\(135deg,#eef8f2,#fff1e8\)/);

console.log("admin mobile final structure contract passed");
