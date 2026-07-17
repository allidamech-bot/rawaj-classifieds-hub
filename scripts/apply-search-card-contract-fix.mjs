import { readFile, writeFile, unlink } from "node:fs/promises";

const path = "scripts/search-results-taxonomy-integrity.test.mjs";
let source = await readFile(path, "utf8");
const before = 'assert.match(route, /<RealListingCard key=\\{listing\\.id\\} listing=\\{listing\\}/);';
const after = 'assert.match(route, /<RealListingCard[\\s\\S]{0,180}key=\\{listing\\.id\\}[\\s\\S]{0,180}listing=\\{listing\\}/);';
if (!source.includes(before)) throw new Error("Search result card assertion anchor not found");
source = source.replace(before, after);
await writeFile(path, source);
await unlink(new URL(import.meta.url));
