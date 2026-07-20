import { readFile, rm, writeFile } from "node:fs/promises";

const path = "scripts/apply-trust-actions-integrity.mjs";
let source = await readFile(path, "utf8");

function replaceGeneratorBlock(label, replacement) {
  const labelIndex = source.indexOf(`"${label}"`);
  if (labelIndex < 0) throw new Error(`Missing generator label: ${label}`);
  const start = source.lastIndexOf("source = replaceOnce(", labelIndex);
  const end = source.indexOf("\n  );", labelIndex);
  if (start < 0 || end < 0) throw new Error(`Could not resolve generator block: ${label}`);
  source = source.slice(0, start) + replacement + source.slice(end + 5);
}

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

replaceGeneratorBlock(
  "promotion form busy state",
  `source = replaceRegexOnce(
    source,
    /onSubmit=\\{\\(event\\) => void submit\\(event\\)\\}\\s+className=/,
    \`onSubmit={(event) => void submit(event)}\n              aria-busy={saving}\n              className=\`,
    "promotion form busy state",
  );`,
);

await writeFile(path, source);
await rm("scripts/fix-trust-actions-generator.mjs", { force: true });
