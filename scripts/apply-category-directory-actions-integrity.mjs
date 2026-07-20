import { readFile, rm, writeFile } from "node:fs/promises";

const path = "src/routes/categories.tsx";
let source = await readFile(path, "utf8");
const pattern = /    async function load\(\) \{[\s\S]*?\n    \}\n\n    void load\(\);/;
const matches = [...source.matchAll(new RegExp(pattern.source, "g"))];
if (matches.length !== 1) throw new Error(`Expected one category load function, found ${matches.length}`);
source = source.replace(
  pattern,
  `    async function load() {
      setLoading(true);
      setFetchError(null);
      try {
        const [taxonomyResult, categoriesResult, subcategoriesResult] = await Promise.all([
          fetchPublicTaxonomyNodes(),
          fetchPublicCategories(),
          fetchPublicSubcategories(),
        ]);
        if (cancelled) return;

        if (categoriesResult.ok) setCategories(categoriesResult.data);
        if (subcategoriesResult.ok) setSubcategories(subcategoriesResult.data);

        if (taxonomyResult.ok) {
          setTaxonomyNodes(taxonomyResult.data);
          setTaxonomyAvailable(true);
        } else if (taxonomyResult.error.code === "schema_missing") {
          setTaxonomyNodes([]);
          setTaxonomyAvailable(false);
          if (!categoriesResult.ok) setFetchError(categoriesResult.error);
          else if (!subcategoriesResult.ok) setFetchError(subcategoriesResult.error);
        } else {
          setFetchError(taxonomyResult.error);
        }
      } catch (caught) {
        if (cancelled) return;
        setFetchError({
          code: "unknown",
          message:
            caught instanceof Error
              ? caught.message
              : text("تعذر تحميل الأقسام.", "Could not load categories."),
          operation: "categories_retry_load",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();`,
);
source = source.replace("  }, [loadAttempt]);", "  }, [loadAttempt, text]);");
await writeFile(path, source);
await rm("scripts/apply-category-directory-actions-integrity.mjs", { force: true });
