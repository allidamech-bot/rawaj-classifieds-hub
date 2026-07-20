import { readFile, rm, writeFile } from "node:fs/promises";

const path = "scripts/apply-saved-items-actions-integrity.mjs";
let source = await readFile(path, "utf8");

const replacements = [
  [
    "              `تم العثور على ${scanResult.data.createdNotifications} نتيجة جديدة وإضافتها إلى إشعاراتك.`,",
    '              "تم العثور على " + scanResult.data.createdNotifications + " نتيجة جديدة وإضافتها إلى إشعاراتك.",',
  ],
  [
    "              `${scanResult.data.createdNotifications} new matches were added to your notifications.`,",
    '              scanResult.data.createdNotifications + " new matches were added to your notifications.",',
  ],
  [
    "          id: `local-${currentProfileId}-${Date.now()}` ,",
    '          id: "local-" + currentProfileId + "-" + Date.now(),',
  ],
  [
    "          id: `local-${currentProfileId}-${Date.now()}` ,",
    '          id: "local-" + currentProfileId + "-" + Date.now(),',
  ],
  [
    "          id: `local-${currentProfileId}-${Date.now()}` ,",
    '          id: "local-" + currentProfileId + "-" + Date.now(),',
  ],
];

for (const [before, after] of replacements.slice(0, 2)) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`Expected one interpolation match, found ${count}: ${before}`);
  source = source.replace(before, after);
}

const localPattern = "          id: `local-${currentProfileId}-${Date.now()}`,";
const localCount = source.split(localPattern).length - 1;
if (localCount !== 1) throw new Error(`Expected one local id match, found ${localCount}`);
source = source.replace(localPattern, '          id: "local-" + currentProfileId + "-" + Date.now(),');

await writeFile(path, source);
await rm("scripts/fix-saved-items-generator.mjs", { force: true });
