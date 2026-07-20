import { readFile, rm, writeFile } from "node:fs/promises";

const path = "scripts/apply-chat-actions-integrity.mjs";
let source = await readFile(path, "utf8");

const resetBlock = `replaceOnce(
  '    setBlockReason("");\n    setNotice("");',
  '    setBlockReason("");\n    setBlocking(false);\n    setNotice("");',
  "chat account reset blocking",
);`;
const resetCount = source.split(resetBlock).length - 1;
if (resetCount !== 1) throw new Error(`Expected one reset generator block, found ${resetCount}`);
source = source.replace(
  resetBlock,
  `{
  const before = '    setBlockReason("");\\n    setNotice("");';
  const after = '    setBlockReason("");\\n    setBlocking(false);\\n    setNotice("");';
  const count = source.split(before).length - 1;
  if (count !== 2) throw new Error(\`chat reset blocking: expected two matches, found \${count}\`);
  source = source.split(before).join(after);
}`,
);

const indentationReplacements = [
  ["                       onClick={() => void handleBlock()}", "                      onClick={() => void handleBlock()}"],
  ["                       disabled={blocking}", "                      disabled={blocking}"],
  ["                       aria-busy={blocking}", "                      aria-busy={blocking}"],
  ["                       aria-label={text(\"حظر المستخدم\", \"Block user\")}", "                      aria-label={text(\"حظر المستخدم\", \"Block user\")}"],
  ["                       className=", "                      className="],
  ["                       {text(\"حظر\", \"Block\")}", "                      {text(\"حظر\", \"Block\")}"],
  ["                       {blocking ? text(\"جارٍ الحظر\", \"Blocking\") : text(\"حظر\", \"Block\")}", "                      {blocking ? text(\"جارٍ الحظر\", \"Blocking\") : text(\"حظر\", \"Block\")}"],
  ["                     </button>", "                    </button>"],
  ["                     value={blockReason}", "                    value={blockReason}"],
  ["                     onChange={(event) => setBlockReason(event.target.value)}", "                    onChange={(event) => setBlockReason(event.target.value)}"],
  ["                     disabled={blocking}", "                    disabled={blocking}"],
  ["                     maxLength={300}", "                    maxLength={300}"],
  ["                 <form", "                <form"],
  ["                   onSubmit={(event) => void handleSend(event)}", "                  onSubmit={(event) => void handleSend(event)}"],
  ["                   aria-busy={sending}", "                  aria-busy={sending}"],
  ["                   className=", "                  className="],
];
for (const [before, after] of indentationReplacements) {
  source = source.split(before).join(after);
}

await writeFile(path, source);
await rm("scripts/fix-chat-actions-generator.mjs", { force: true });
