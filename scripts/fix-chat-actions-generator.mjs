import { readFile, rm, writeFile } from "node:fs/promises";

const path = "scripts/apply-chat-actions-integrity.mjs";
let source = await readFile(path, "utf8");

function replaceGeneratorBlock(label, replacement) {
  const labelIndex = source.indexOf(`"${label}"`);
  if (labelIndex < 0) throw new Error(`Missing generator label: ${label}`);
  const start = source.lastIndexOf("replaceOnce(", labelIndex);
  const endMarker = source.indexOf("\n);", labelIndex);
  if (start < 0 || endMarker < 0) throw new Error(`Could not resolve generator block: ${label}`);
  source = source.slice(0, start) + replacement + source.slice(endMarker + 3);
}

const resetBlockPattern = /replaceOnce\(\s*'    setBlockReason\(""\);\\n    setNotice\(""\);',\s*'    setBlockReason\(""\);\\n    setBlocking\(false\);\\n    setNotice\(""\);',\s*"chat account reset blocking",\s*\);/;
const resetMatches = [...source.matchAll(new RegExp(resetBlockPattern.source, "g"))];
if (resetMatches.length !== 1) {
  throw new Error(`Expected one reset generator block, found ${resetMatches.length}`);
}
source = source.replace(
  resetBlockPattern,
  `{
  const before = '    setBlockReason("");\\n    setNotice("");';
  const after = '    setBlockReason("");\\n    setBlocking(false);\\n    setNotice("");';
  const count = source.split(before).length - 1;
  if (count !== 2) throw new Error(\`chat reset blocking: expected two matches, found \${count}\`);
  source = source.split(before).join(after);
}`,
);

replaceGeneratorBlock(
  "chat block button disabled",
  `replaceRegexOnce(
  /onClick=\\{\\(\\) => void handleBlock\\(\\)\\}\\s+aria-label=\\{text\\("حظر المستخدم", "Block user"\\)\\}\\s+className=/,
  \`onClick={() => void handleBlock()}\n                      disabled={blocking}\n                      aria-busy={blocking}\n                      aria-label={text("حظر المستخدم", "Block user")}\n                      className=\`,
  "chat block button disabled",
);`,
);
replaceGeneratorBlock(
  "chat block button label",
  `replaceRegexOnce(
  /\\{text\\("حظر", "Block"\\)\\}\\s+<\\/button>/,
  \`{blocking ? text("جارٍ الحظر", "Blocking") : text("حظر", "Block")}\n                    </button>\`,
  "chat block button label",
);`,
);
replaceGeneratorBlock(
  "chat block reason disabled",
  `replaceRegexOnce(
  /value=\\{blockReason\\}\\s+onChange=\\{\\(event\\) => setBlockReason\\(event\\.target\\.value\\)\\}\\s+maxLength=\\{300\\}/,
  \`value={blockReason}\n                    onChange={(event) => setBlockReason(event.target.value)}\n                    disabled={blocking}\n                    maxLength={300}\`,
  "chat block reason disabled",
);`,
);
replaceGeneratorBlock(
  "chat composer busy state",
  `replaceRegexOnce(
  /<form\\s+onSubmit=\\{\\(event\\) => void handleSend\\(event\\)\\}\\s+className=/,
  \`<form\n                  onSubmit={(event) => void handleSend(event)}\n                  aria-busy={sending}\n                  className=\`,
  "chat composer busy state",
);`,
);

await writeFile(path, source);
await rm("scripts/fix-chat-actions-generator.mjs", { force: true });
