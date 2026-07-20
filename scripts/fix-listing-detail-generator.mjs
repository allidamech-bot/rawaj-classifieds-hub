import { readFile, rm, writeFile } from "node:fs/promises";

const path = "scripts/apply-listing-detail-actions-integrity.mjs";
let source = await readFile(path, "utf8");

const returnToPattern = '      void navigate({ to: "/login", search: { returnTo: `/listings/${id}` } });';
const returnToCount = source.split(returnToPattern).length - 1;
if (returnToCount !== 3) throw new Error(`Expected three returnTo interpolation matches, found ${returnToCount}`);
source = source.split(returnToPattern).join('      void navigate({ to: "/login", search: { returnTo: "/listings/" + id } });');

const alertNamePattern = '        nameAr: `نتائج مشابهة بسعر ${listing.price}`,';
const alertNameCount = source.split(alertNamePattern).length - 1;
if (alertNameCount !== 1) throw new Error(`Expected one price alert interpolation match, found ${alertNameCount}`);
source = source.replace(alertNamePattern, '        nameAr: "نتائج مشابهة بسعر " + listing.price,');

await writeFile(path, source);
await rm("scripts/fix-listing-detail-generator.mjs", { force: true });
