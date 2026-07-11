import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  if (!source.includes(before)) {
    throw new Error(`Missing implementation anchor in ${path}: ${before.slice(0, 80)}`);
  }
  await writeFile(path, source.replace(before, after));
}

await replaceOnce(
  "src/routes/categories.tsx",
  `import type {
  ClassifiedCategory,
  ClassifiedsError,
  ClassifiedSubcategory,
  TaxonomyNode,
} from "@/lib/classifieds-types";`,
  `import type {
  ClassifiedCategory,
  ClassifiedSubcategory,
  TaxonomyNode,
} from "@/lib/classifieds-types";`,
);

await replaceOnce(
  "src/routes/categories.tsx",
  `export const Route = createFileRoute("/categories")({
  validateSearch: categoriesSearchSchema,
  head: () =>
    createSeo({
      title: "الأقسام | RAWAJ / رواج",
      description: "دليل أقسام رواج لاختيار القسم المناسب قبل تصفح نتائج الإعلانات المعتمدة.",
      path: "/categories",
    }),
  component: CategoriesPage,
});`,
  `export const Route = createFileRoute("/categories")({
  validateSearch: categoriesSearchSchema,
  loader: async () => {
    const [taxonomyResult, categoriesResult, subcategoriesResult] = await Promise.all([
      fetchPublicTaxonomyNodes(),
      fetchPublicCategories(),
      fetchPublicSubcategories(),
    ]);

    let fetchError = !categoriesResult.ok
      ? categoriesResult.error
      : !subcategoriesResult.ok
        ? subcategoriesResult.error
        : null;

    if (!taxonomyResult.ok && taxonomyResult.error.code !== "schema_missing") {
      fetchError = taxonomyResult.error;
    }

    return {
      taxonomyNodes: taxonomyResult.ok ? taxonomyResult.data : [],
      taxonomyAvailable: taxonomyResult.ok,
      categories: categoriesResult.ok ? categoriesResult.data : [],
      subcategories: subcategoriesResult.ok ? subcategoriesResult.data : [],
      fetchError,
    };
  },
  head: () =>
    createSeo({
      title: "الأقسام | RAWAJ / رواج",
      description: "دليل أقسام رواج لاختيار القسم المناسب قبل تصفح نتائج الإعلانات المعتمدة.",
      path: "/categories",
    }),
  component: CategoriesPage,
});`,
);

await replaceOnce(
  "src/routes/categories.tsx",
  `  const { language, text } = useUiPreferences();
  const [taxonomyNodes, setTaxonomyNodes] = useState<TaxonomyNode[]>([]);
  const [taxonomyAvailable, setTaxonomyAvailable] = useState(false);
  const [categories, setCategories] = useState<ClassifiedCategory[]>([]);
  const [subcategories, setSubcategories] = useState<ClassifiedSubcategory[]>([]);
  const [query, setQuery] = useState(search.q ?? "");
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<ClassifiedsError | null>(null);`,
  `  const { language, text } = useUiPreferences();
  const { taxonomyNodes, taxonomyAvailable, categories, subcategories, fetchError } =
    Route.useLoaderData();
  const [query, setQuery] = useState(search.q ?? "");`,
);

await replaceOnce(
  "src/routes/categories.tsx",
  `  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setFetchError(null);

      const [taxonomyResult, categoriesResult, subcategoriesResult] = await Promise.all([
        fetchPublicTaxonomyNodes(),
        fetchPublicCategories(),
        fetchPublicSubcategories(),
      ]);
      if (cancelled) return;

      if (!categoriesResult.ok) {
        setFetchError(categoriesResult.error);
      } else if (!subcategoriesResult.ok) {
        setFetchError(subcategoriesResult.error);
      } else {
        setCategories(categoriesResult.data);
        setSubcategories(subcategoriesResult.data);
      }

      if (taxonomyResult.ok) {
        setTaxonomyNodes(taxonomyResult.data);
        setTaxonomyAvailable(true);
      } else if (taxonomyResult.error.code === "schema_missing") {
        setTaxonomyNodes([]);
        setTaxonomyAvailable(false);
      } else {
        setFetchError(taxonomyResult.error);
      }

      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

`,
  "",
);

await replaceOnce(
  "src/routes/categories.tsx",
  `        {loading ? (
          <Panel title={text("جاري تحميل الأقسام", "Loading categories")} />
        ) : fetchError ? (`,
  `        {fetchError ? (`,
);

await replaceOnce(
  "src/routes/offers.tsx",
  `import { useEffect, useState } from "react";
`,
  "",
);

await replaceOnce(
  "src/routes/offers.tsx",
  `import type { ClassifiedsError } from "@/lib/classifieds-types";
`,
  "",
);

await replaceOnce(
  "src/routes/offers.tsx",
  `export const Route = createFileRoute("/offers")({
  head: () =>
    createSeo({
      title: "العروض الحقيقية | RAWAJ / رواج",
      description:
        "إعلانات انخفض سعرها فعلياً على رواج، مع السعر السابق والجديد ونسبة التخفيض وتاريخ الانخفاض.",
      path: "/offers",
    }),
  component: OffersPage,
});`,
  `export const Route = createFileRoute("/offers")({
  loader: async () => {
    const result = await fetchActivePriceDropOffers(30);
    return result.ok ? { offers: result.data, error: null } : { offers: [], error: result.error };
  },
  head: () =>
    createSeo({
      title: "العروض الحقيقية | RAWAJ / رواج",
      description:
        "إعلانات انخفض سعرها فعلياً على رواج، مع السعر السابق والجديد ونسبة التخفيض وتاريخ الانخفاض.",
      path: "/offers",
    }),
  component: OffersPage,
});`,
);

await replaceOnce(
  "src/routes/offers.tsx",
  `  const { text } = useUiPreferences();
  const [offers, setOffers] = useState<ListingPriceDropOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ClassifiedsError | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const result = await fetchActivePriceDropOffers(30);
      if (cancelled) return;
      if (result.ok) setOffers(result.data);
      else {
        setOffers([]);
        setError(result.error);
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);`,
  `  const { text } = useUiPreferences();
  const { offers, error } = Route.useLoaderData();`,
);

await replaceOnce(
  "src/routes/offers.tsx",
  `            {loading ? (
              <OffersState
                title={text("جاري تحميل التخفيضات الحقيقية", "Loading real price drops")}
                body={text(
                  "يتم التحقق من أحدث الأسعار العامة الآن.",
                  "Checking the latest public prices now.",
                )}
              />
            ) : error ? (`,
  `            {error ? (`,
);

const packagePath = "package.json";
const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
packageJson.scripts["test:categories-offers-ssr"] =
  "node --test scripts/categories-offers-ssr.test.mjs";
const checkMarker = "npm run test:home-ssr && npm run lint";
if (!packageJson.scripts.check.includes(checkMarker)) {
  throw new Error("Missing package check anchor");
}
packageJson.scripts.check = packageJson.scripts.check.replace(
  checkMarker,
  "npm run test:home-ssr && npm run test:categories-offers-ssr && npm run lint",
);
await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
