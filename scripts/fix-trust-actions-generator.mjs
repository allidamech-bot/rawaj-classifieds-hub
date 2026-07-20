import { readFile, rm, writeFile } from "node:fs/promises";

const path = "scripts/apply-trust-actions-integrity.mjs";
let source = await readFile(path, "utf8");

const oldBlock = '  source = replaceOnce(source, `               className="mt-3 block`, `               disabled={saving}\\n               className="mt-3 block`, "verification file disabled");';
const count = source.split(oldBlock).length - 1;
if (count !== 1) throw new Error(`Expected one verification file generator block, found ${count}`);
source = source.replace(
  oldBlock,
  `  source = replaceRegexOnce(
    source,
    /type="file"[\\s\\S]*?onChange=\\{\\(event\\) => setDocumentFile\\(event\\.target\\.files\\?\\.\\[0\\] \\?\\? null\\)\\}[\\s\\S]*?className="mt-3 block/,
    (match) => match.replace('className="mt-3 block', 'disabled={saving}\\n               className="mt-3 block'),
    "verification file disabled",
  );`,
);

await writeFile(path, source);
await rm("scripts/fix-trust-actions-generator.mjs", { force: true });
