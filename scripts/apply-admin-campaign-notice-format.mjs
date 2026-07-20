import { readFile, rm, writeFile } from "node:fs/promises";

const path = "src/routes/admin.campaigns.tsx";
const source = await readFile(path, "utf8");
const before = `      setNotice(
        text("تم تغيير حالة الحملة وتسجيل السبب.", "Campaign status changed and audited."),
      );`;
const after = `      setNotice(text("تم تغيير حالة الحملة وتسجيل السبب.", "Campaign status changed and audited."));`;
const matches = source.split(before).length - 1;
if (matches !== 1) throw new Error(`Expected one notice formatting match, found ${matches}.`);
await writeFile(path, source.replace(before, after));
await rm("scripts/apply-admin-campaign-notice-format.mjs", { force: true });
