import { readFile, rm, writeFile } from "node:fs/promises";

const path = "scripts/apply-saved-items-actions-integrity.mjs";
let source = await readFile(path, "utf8");

const interpolationReplacements = [
  [
    "              `تم العثور على ${scanResult.data.createdNotifications} نتيجة جديدة وإضافتها إلى إشعاراتك.`,",
    '              "تم العثور على " + scanResult.data.createdNotifications + " نتيجة جديدة وإضافتها إلى إشعاراتك.",',
  ],
  [
    "              `${scanResult.data.createdNotifications} new matches were added to your notifications.`,",
    '              scanResult.data.createdNotifications + " new matches were added to your notifications.",',
  ],
];
for (const [before, after] of interpolationReplacements) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`Expected one interpolation match, found ${count}: ${before}`);
  source = source.replace(before, after);
}

const localPattern = "          id: `local-${currentProfileId}-${Date.now()}`,";
const localCount = source.split(localPattern).length - 1;
if (localCount !== 1) throw new Error(`Expected one local id match, found ${localCount}`);
source = source.replace(localPattern, '          id: "local-" + currentProfileId + "-" + Date.now(),');

const indentationReplacements = [
  ["                           type=\"button\"", "                          type=\"button\""],
  ["                           onClick={() => void remove(item.listingId)}", "                          onClick={() => void remove(item.listingId)}"],
  ["                           disabled={removingIds.has(item.listingId)}", "                          disabled={removingIds.has(item.listingId)}"],
  ["                           aria-busy={removingIds.has(item.listingId)}", "                          aria-busy={removingIds.has(item.listingId)}"],
  ["                           className=\"grid h-9", "                          className=\"grid h-9"],
  ["             type=\"button\"", "            type=\"button\""],
  ["             onClick={onRemove}", "            onClick={onRemove}"],
  ["             disabled={removeDisabled}", "            disabled={removeDisabled}"],
  ["             aria-busy={removeDisabled}", "            aria-busy={removeDisabled}"],
  ["             className=\"grid h-9", "            className=\"grid h-9"],
];
for (const [before, after] of indentationReplacements) {
  source = source.split(before).join(after);
}

await writeFile(path, source);
await rm("scripts/fix-saved-items-generator.mjs", { force: true });
