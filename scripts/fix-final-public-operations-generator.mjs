import { readFile, rm, writeFile } from "node:fs/promises";

const path = "scripts/apply-final-public-operations-integrity.mjs";
let source = await readFile(path, "utf8");

function replaceGeneratorBlock(label, replacement) {
  const labelIndex = source.indexOf(`"${label}"`);
  if (labelIndex < 0) throw new Error(`Missing generator label: ${label}`);
  const start = source.lastIndexOf("source = replaceOnce(", labelIndex);
  const end = source.indexOf("\n  );", labelIndex);
  if (start < 0 || end < 0) throw new Error(`Could not resolve generator block: ${label}`);
  source = source.slice(0, start) + replacement + source.slice(end + 5);
}

replaceGeneratorBlock(
  "offers retry binding",
  `source = replaceRegexOnce(
    source,
    /onAction=\\{\\(\\) => void router\\.invalidate\\(\\)\\}\\s*\\/>/,
    \`onAction={() => void retryOffers()}\n                actionDisabled={retrying}\n              />\`,
    "offers retry binding",
  );`,
);

replaceGeneratorBlock(
  "offers state disabled prop",
  `source = replaceRegexOnce(
    source,
    /onAction,\\s*}: \\{\\s*title: string;\\s*body\\?: string;\\s*actionLabel\\?: string;\\s*onAction\\?: \\(\\) => void;\\s*}\\)/,
    \`onAction,\n  actionDisabled = false,\n}: {\n  title: string;\n  body?: string;\n  actionLabel?: string;\n  onAction?: () => void;\n  actionDisabled?: boolean;\n})\`,
    "offers state disabled prop",
  );`,
);

replaceGeneratorBlock(
  "offers retry disabled",
  `source = replaceRegexOnce(
    source,
    /onClick=\\{onAction\\}\\s+className=/,
    \`onClick={onAction}\n          disabled={actionDisabled}\n          aria-busy={actionDisabled}\n          className=\`,
    "offers retry disabled",
  );`,
);

await writeFile(path, source);
await rm("scripts/fix-final-public-operations-generator.mjs", { force: true });
