import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  const first = source.indexOf(before);
  if (first === -1) throw new Error(`Missing expected source in ${path}: ${before.slice(0, 120)}`);
  if (source.indexOf(before, first + before.length) !== -1) {
    throw new Error(`Expected one match in ${path}: ${before.slice(0, 120)}`);
  }
  await writeFile(path, source.slice(0, first) + after + source.slice(first + before.length));
}

await replaceOnce(
  "src/lib/api/listings.ts",
  `  filters: { categoryId?: string; sort?: string } & Record<string, unknown> = {},
`,
  `  filters: { categoryId?: string; governorateId?: string; sort?: string } & Record<
    string,
    unknown
  > = {},
`,
);

await replaceOnce(
  "src/lib/api/listings.ts",
  `  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);

  const sort = filters.sort ?? "latest";
`,
  `  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.governorateId) {
    query = query.eq("governorate_id", filters.governorateId);
  }

  const sort = filters.sort ?? "latest";
`,
);

await replaceOnce(
  "src/routes/categories.tsx",
  `            <Link
              to="/listings"
              search={{ category: category.id }}
              className="group flex h-full flex-col gap-4 p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
`,
  `            <Link
              to="/categories/$slug"
              params={{ slug: category.slug }}
              className="group flex h-full flex-col gap-4 p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
`,
);

await replaceOnce(
  "package.json",
  `&& npm run test:launch-readiness-batch-5 && npm run test:activity-center`,
  `&& npm run test:launch-readiness-batch-5 && npm run test:launch-readiness-batch-6 && npm run test:activity-center`,
);

await replaceOnce(
  "package.json",
  `    "test:launch-readiness-batch-5": "node --test scripts/launch-readiness-batch-5.test.mjs",
`,
  `    "test:launch-readiness-batch-5": "node --test scripts/launch-readiness-batch-5.test.mjs",
    "test:launch-readiness-batch-6": "node --test scripts/launch-readiness-batch-6.test.mjs",
`,
);

console.log("Launch readiness Batch 6 patch applied.");
