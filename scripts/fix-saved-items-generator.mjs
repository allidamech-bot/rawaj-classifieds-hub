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

const unavailableButtonBlock = `  source = replaceOnce(
    source,
    \`                           type="button"\\n                           onClick={() => void remove(item.listingId)}\\n                           className="grid h-9 w-9 place-items-center rounded-full bg-muted-surface text-destructive"\`,
    \`                           type="button"\\n                           onClick={() => void remove(item.listingId)}\\n                           disabled={removingIds.has(item.listingId)}\\n                           aria-busy={removingIds.has(item.listingId)}\\n                           className="grid h-9 w-9 place-items-center rounded-full bg-muted-surface text-destructive disabled:cursor-wait disabled:opacity-50"\`,
    "unavailable favorite remove disabled",
  );`;
const unavailableCount = source.split(unavailableButtonBlock).length - 1;
if (unavailableCount !== 1) {
  throw new Error(`Expected one unavailable favorite generator block, found ${unavailableCount}`);
}
source = source.replace(
  unavailableButtonBlock,
  `  source = replaceRegexOnce(
    source,
    /type="button"\\s+onClick=\\{\\(\\) => void remove\\(item\\.listingId\\)\\}\\s+className="grid h-9 w-9 place-items-center rounded-full bg-muted-surface text-destructive"/,
    \`type="button"\n                          onClick={() => void remove(item.listingId)}\n                          disabled={removingIds.has(item.listingId)}\n                          aria-busy={removingIds.has(item.listingId)}\n                          className="grid h-9 w-9 place-items-center rounded-full bg-muted-surface text-destructive disabled:cursor-wait disabled:opacity-50"\`,
    "unavailable favorite remove disabled",
  );`,
);

const rowButtonBlock = `  source = replaceOnce(
    source,
    \`             type="button"\\n             onClick={onRemove}\\n             className="grid h-9 w-9 place-items-center rounded-full bg-muted-surface text-destructive"\`,
    \`             type="button"\\n             onClick={onRemove}\\n             disabled={removeDisabled}\\n             aria-busy={removeDisabled}\\n             className="grid h-9 w-9 place-items-center rounded-full bg-muted-surface text-destructive disabled:cursor-wait disabled:opacity-50"\`,
    "search row remove disabled button",
  );`;
const rowCount = source.split(rowButtonBlock).length - 1;
if (rowCount !== 1) throw new Error(`Expected one search row generator block, found ${rowCount}`);
source = source.replace(
  rowButtonBlock,
  `  source = replaceRegexOnce(
    source,
    /type="button"\\s+onClick=\\{onRemove\\}\\s+className="grid h-9 w-9 place-items-center rounded-full bg-muted-surface text-destructive"/,
    \`type="button"\n            onClick={onRemove}\n            disabled={removeDisabled}\n            aria-busy={removeDisabled}\n            className="grid h-9 w-9 place-items-center rounded-full bg-muted-surface text-destructive disabled:cursor-wait disabled:opacity-50"\`,
    "search row remove disabled button",
  );`,
);

await writeFile(path, source);
await rm("scripts/fix-saved-items-generator.mjs", { force: true });
