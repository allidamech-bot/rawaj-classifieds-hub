import { readFile, writeFile } from "node:fs/promises";

async function updateSource(path, updater) {
  const source = await readFile(path, "utf8");
  const next = updater(source);
  if (next === source) throw new Error(`No structural change applied to ${path}`);
  await writeFile(path, next);
}

await updateSource("src/lib/api/listings.ts", (source) => {
  let next = source.replace(
    /filters:\s*\{\s*categoryId\?: string;\s*sort\?: string\s*\}\s*&\s*Record<string, unknown>\s*=\s*\{\},/,
    `filters: { categoryId?: string; governorateId?: string; sort?: string } & Record<
    string,
    unknown
  > = {},`,
  );
  if (next === source) throw new Error("Public listing filter signature was not found");

  const categoryFilter =
    '  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);';
  if (!next.includes(categoryFilter)) throw new Error("Category query filter was not found");
  next = next.replace(
    categoryFilter,
    `${categoryFilter}
  if (filters.governorateId) {
    query = query.eq("governorate_id", filters.governorateId);
  }`,
  );
  return next;
});

await updateSource("src/routes/categories.tsx", (source) => {
  const legacyLink = /<Link\s+to="\/listings"\s+search=\{\{ category: category\.id \}\}\s+className="group flex h-full flex-col gap-4 p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"\s*>/;
  if (!legacyLink.test(source)) throw new Error("Legacy category result link was not found");
  return source.replace(
    legacyLink,
    `<Link
              to="/categories/$slug"
              params={{ slug: category.slug }}
              className="group flex h-full flex-col gap-4 p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >`,
  );
});

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

console.log("Launch readiness Batch 6 patch applied.");
