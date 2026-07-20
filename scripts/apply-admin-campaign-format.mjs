import { readFile, rm, writeFile } from "node:fs/promises";

const path = "src/routes/admin.campaigns.tsx";
const source = await readFile(path, "utf8");
const before = `      targetCategoryIds: [...new Set(
        campaignForm.categoryIdsText
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      )],`;
const after = `      targetCategoryIds: [
        ...new Set(
          campaignForm.categoryIdsText
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ],`;
const matches = source.split(before).length - 1;
if (matches !== 1) {
  throw new Error(`Expected one campaign payload formatting match, found ${matches}.`);
}
await writeFile(path, source.replace(before, after));
await rm("scripts/apply-admin-campaign-format.mjs", { force: true });
