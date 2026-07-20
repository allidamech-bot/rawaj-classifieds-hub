import { readFile, rm, writeFile } from "node:fs/promises";

const path = "scripts/apply-profile-seller-actions-integrity.mjs";
let source = await readFile(path, "utf8");

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

await writeFile(path, source);
await rm("scripts/fix-profile-seller-generator.mjs", { force: true });
