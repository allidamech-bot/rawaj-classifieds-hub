import { readFile, rm, writeFile } from "node:fs/promises";

const path = "scripts/apply-listing-detail-actions-integrity.mjs";
let source = await readFile(path, "utf8");

function replaceGeneratorBlock(label, replacement) {
  const labelIndex = source.indexOf(`"${label}"`);
  if (labelIndex < 0) throw new Error(`Missing generator label: ${label}`);
  const start = source.lastIndexOf("source = replaceOnce(", labelIndex);
  const endMarker = source.indexOf("\n  );", labelIndex);
  if (start < 0 || endMarker < 0) throw new Error(`Could not resolve generator block: ${label}`);
  source = source.slice(0, start) + replacement + source.slice(endMarker + 5);
}

const returnToPattern = '      void navigate({ to: "/login", search: { returnTo: `/listings/${id}` } });';
const returnToCount = source.split(returnToPattern).length - 1;
if (returnToCount !== 3) throw new Error(`Expected three returnTo interpolation matches, found ${returnToCount}`);
source = source.split(returnToPattern).join('      void navigate({ to: "/login", search: { returnTo: "/listings/" + id } });');

const alertNamePattern = '        nameAr: `نتائج مشابهة بسعر ${listing.price}`,';
const alertNameCount = source.split(alertNamePattern).length - 1;
if (alertNameCount !== 1) throw new Error(`Expected one price alert interpolation match, found ${alertNameCount}`);
source = source.replace(alertNamePattern, '        nameAr: "نتائج مشابهة بسعر " + listing.price,');

const indentationReplacements = [
  ["                 alertBusy={alertBusy}", "                alertBusy={alertBusy}"],
  ["                 alertCreated={alertCreated}", "                alertCreated={alertCreated}"],
  ["                 reportBusy={reportBusy}", "                reportBusy={reportBusy}"],
  ["                 canMessage={!isOwner}", "                canMessage={!isOwner}"],
  ["                 messageBusy={messageBusy}", "                messageBusy={messageBusy}"],
  ["                 onMessage={messageSeller}", "                onMessage={messageSeller}"],
  ["         onMessage={() => void messageSeller()}", "        onMessage={() => void messageSeller()}"],
  ["         onOffer={() => void messageSeller()}", "        onOffer={() => void messageSeller()}"],
  ["         messageBusy={messageBusy}", "        messageBusy={messageBusy}"],
];
for (const [before, after] of indentationReplacements) {
  source = source.split(before).join(after);
}

replaceGeneratorBlock(
  "media favorite disabled",
  `source = replaceRegexOnce(
    source,
    /onClick=\\{onToggleFavorite\\}\\s+aria-pressed=\\{favorite\\}/,
    \`onClick={onToggleFavorite}\n                  disabled={favoriteBusy}\n                  aria-busy={favoriteBusy}\n                  aria-pressed={favorite}\`,
    "media favorite disabled",
  );`,
);
replaceGeneratorBlock(
  "safety report disabled",
  `source = replaceRegexOnce(
    source,
    /<button\\s+type="button"\\s+onClick=\\{onReport\\}\\s+data-tone="report">\\s*<Flag aria-hidden="true" \\/>\\s*\\{text\\("إبلاغ عن الإعلان", "Report listing"\\)\\}\\s*<\\/button>/,
    \`<button\n            type="button"\n            onClick={onReport}\n            disabled={reportBusy}\n            aria-busy={reportBusy}\n            data-tone="report"\n          >\n            <Flag aria-hidden="true" />\n            {reportBusy\n              ? text("جارٍ إرسال البلاغ", "Sending report")\n              : text("إبلاغ عن الإعلان", "Report listing")}\n          </button>\`,
    "safety report disabled",
  );`,
);
replaceGeneratorBlock(
  "seller message disabled",
  `source = replaceRegexOnce(
    source,
    /<button type="button" onClick=\\{onMessage\\}>\\s*<MessageCircle aria-hidden="true" \\/>\\s*\\{text\\("مراسلة", "Message"\\)\\}\\s*<\\/button>/,
    \`<button type="button" onClick={onMessage} disabled={messageBusy} aria-busy={messageBusy}>\n            <MessageCircle aria-hidden="true" />\n            {messageBusy ? text("جارٍ الفتح", "Opening") : text("مراسلة", "Message")}\n          </button>\`,
    "seller message disabled",
  );`,
);
replaceGeneratorBlock(
  "dock message disabled",
  `source = replaceRegexOnce(
    source,
    /<button type="button" onClick=\\{onMessage\\} className="rawaj-contact-dock__primary">[\\s\\S]*?<\\/button>\\s*<button type="button" onClick=\\{onOffer\\} className="rawaj-contact-dock__offer">[\\s\\S]*?<\\/button>/,
    \`<button\n              type="button"\n              onClick={onMessage}\n              disabled={messageBusy}\n              aria-busy={messageBusy}\n              className="rawaj-contact-dock__primary"\n            >\n              <MessageCircle aria-hidden="true" />\n              {messageBusy ? text("جارٍ الفتح", "Opening") : text("مراسلة", "Message")}\n            </button>\n            <button\n              type="button"\n              onClick={onOffer}\n              disabled={messageBusy}\n              aria-busy={messageBusy}\n              className="rawaj-contact-dock__offer"\n            >\n              <Tag aria-hidden="true" />\n              {messageBusy ? text("جارٍ الفتح", "Opening") : text("قدّم عرضًا", "Make an offer")}\n            </button>\`,
    "dock message disabled",
  );`,
);

await writeFile(path, source);
await rm("scripts/fix-listing-detail-generator.mjs", { force: true });
