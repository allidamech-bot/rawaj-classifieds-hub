import { readFile, rm, writeFile } from "node:fs/promises";

const path = "scripts/apply-profile-seller-actions-integrity.mjs";
let source = await readFile(path, "utf8");

function replaceGeneratorBlock(label, replacement) {
  const labelIndex = source.indexOf(`"${label}"`);
  if (labelIndex < 0) throw new Error(`Missing generator label: ${label}`);
  const start = source.lastIndexOf("source = replaceOnce(", labelIndex);
  const end = source.indexOf("\n  );", labelIndex);
  if (start < 0 || end < 0) throw new Error(`Could not resolve generator block: ${label}`);
  source = source.slice(0, start) + replacement + source.slice(end + 5);
}

const oldBlock = `  source = replaceOnce(
    source,
    \`<button type="button" onClick={handleLogout}>\\n                   <LogOut className="h-4 w-4" />\\n                   {text("خروج", "Log out")}\\n                 </button>\`,
    \`<button type="button" onClick={handleLogout} disabled={loggingOut} aria-busy={loggingOut}>\\n                   <LogOut className="h-4 w-4" />\\n                   {loggingOut ? text("جارٍ الخروج", "Logging out") : text("خروج", "Log out")}\\n                 </button>\`,
    "profile logout UI state",
  );`;
const count = source.split(oldBlock).length - 1;
if (count !== 1) throw new Error(`Expected one profile logout generator block, found ${count}`);
source = source.replace(
  oldBlock,
  `  source = replaceRegexOnce(
    source,
    /<button type="button" onClick=\\{handleLogout\\}>\\s*<LogOut className="h-4 w-4" \\/>\\s*\\{text\\("خروج", "Log out"\\)\\}\\s*<\\/button>/,
    \`<button type="button" onClick={handleLogout} disabled={loggingOut} aria-busy={loggingOut}>\n                  <LogOut className="h-4 w-4" />\n                  {loggingOut ? text("جارٍ الخروج", "Logging out") : text("خروج", "Log out")}\n                </button>\`,
    "profile logout UI state",
  );`,
);

replaceGeneratorBlock(
  "profile password form busy state",
  `source = replaceRegexOnce(
    source,
    /onSubmit=\\{\\(event\\) => void handleChangePassword\\(event\\)\\}\\s+className=/,
    \`onSubmit={(event) => void handleChangePassword(event)}\n                aria-busy={passwordSaving}\n                className=\`,
    "profile password form busy state",
  );`,
);

replaceGeneratorBlock(
  "seller rating disabled state",
  `source = replaceRegexOnce(
    source,
    /aria-pressed=\\{rating === value\\}\\s+onClick=/,
    \`aria-pressed={rating === value}\n                  disabled={saving}\n                  onClick=\`,
    "seller rating disabled state",
  );`,
);

await writeFile(path, source);
await rm("scripts/fix-profile-seller-generator.mjs", { force: true });
