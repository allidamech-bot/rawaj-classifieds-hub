import { readFile, writeFile } from "node:fs/promises";

async function replaceExact(path, before, after, label) {
  const source = await readFile(path, "utf8");
  const matches = source.split(before).length - 1;
  if (matches !== 1) throw new Error(`${label}: expected one match in ${path}, found ${matches}`);
  await writeFile(path, source.replace(before, after));
  console.log(`Applied: ${label}`);
}

await replaceExact(
  "src/lib/api/listings.ts",
  `  filters: { categoryId?: string; sort?: string } & Record<string, unknown> = {},`,
  `  filters: { categoryId?: string; governorateId?: string; sort?: string } & Record<
    string,
    unknown
  > = {},`,
  "governorate filter signature",
);

await replaceExact(
  "src/lib/api/listings.ts",
  `  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);

  const sort = filters.sort ?? "latest";`,
  `  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.governorateId) {
    query = query.eq("governorate_id", filters.governorateId);
  }

  const sort = filters.sort ?? "latest";`,
  "governorate query boundary",
);

await replaceExact(
  "src/routes/categories.tsx",
  `          <Link
            to="/listings"
            search={{ category: category.id }}
            className="group flex items-center gap-3 p-3.5 transition hover:bg-muted-surface/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:items-start sm:p-4"
          >`,
  `          <Link
            to="/categories/$slug"
            params={{ slug: category.slug }}
            className="group flex items-center gap-3 p-3.5 transition hover:bg-muted-surface/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:items-start sm:p-4"
          >`,
  "legacy category canonical link",
);

const packagePath = "package.json";
const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
packageJson.scripts["test:launch-readiness-batch-6"] =
  "node --test scripts/launch-readiness-batch-6.test.mjs";
if (!packageJson.scripts.check.includes("test:launch-readiness-batch-6")) {
  packageJson.scripts.check = packageJson.scripts.check.replace(
    "npm run test:launch-readiness-batch-5 && npm run test:activity-center",
    "npm run test:launch-readiness-batch-5 && npm run test:launch-readiness-batch-6 && npm run test:activity-center",
  );
}
if (!packageJson.scripts.check.includes("test:launch-readiness-batch-6")) {
  throw new Error("Could not wire Batch 6 into the local check command");
}
await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
console.log("Applied: Batch 6 package scripts");
