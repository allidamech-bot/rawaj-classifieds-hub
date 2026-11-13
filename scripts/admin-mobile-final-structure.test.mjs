import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../src/admin-final-polish.css", import.meta.url), "utf8");

assert.match(css, /max-width:\s*96rem/);
assert.match(css, /nav\s*\{\s*display:\s*flex;\s*overflow-x:\s*auto/);
assert.match(css, /min-height:\s*3rem/);
assert.match(css, /min-width:\s*42rem/);
assert.match(css, /max-height:\s*calc\(100dvh - 2rem\)/);
assert.match(css, /background:\s*#eef8f2\b/);

console.log("admin mobile final structure contract passed");
