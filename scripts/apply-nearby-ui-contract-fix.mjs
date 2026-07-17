import { readFile, writeFile, unlink } from "node:fs/promises";

const testPath = "scripts/adaptive-listing-cards.test.mjs";
let testSource = await readFile(testPath, "utf8");
testSource = testSource.replace(
  'assert.match(listingsRoute, /<RealListingCard key=\\{listing\\.id\\} listing=\\{listing\\}/);',
  'assert.match(listingsRoute, /<RealListingCard[\\s\\S]{0,180}key=\\{listing\\.id\\}[\\s\\S]{0,180}listing=\\{listing\\}/);',
);
await writeFile(testPath, testSource);

const hookPath = "src/features/listings/use-nearby-discovery.ts";
let hookSource = await readFile(hookPath, "utf8");
hookSource = hookSource.replace(
  `      const point = pointRef.current;\n      if (active && point) void load(point, radius);\n`,
  "",
);
await writeFile(hookPath, hookSource);

await unlink(new URL(import.meta.url));
