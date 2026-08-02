import fs from "node:fs";

const file = "src/routes/categories.tsx";
const source = fs.readFileSync(file, "utf8");

const before = `        if (taxonomyResult.ok) {
          setTaxonomyNodes(taxonomyResult.data);
          setTaxonomyAvailable(true);
        } else if (taxonomyResult.error.code === "schema_missing") {
          setTaxonomyNodes([]);
          setTaxonomyAvailable(false);
          if (!categoriesResult.ok) setFetchError(categoriesResult.error);
          else if (!subcategoriesResult.ok) setFetchError(subcategoriesResult.error);
        } else {
          setFetchError(taxonomyResult.error);
        }`;

const after = `        if (taxonomyResult.ok && taxonomyResult.data.length > 0) {
          setTaxonomyNodes(taxonomyResult.data);
          setTaxonomyAvailable(true);
        } else if (taxonomyResult.ok || taxonomyResult.error.code === "schema_missing") {
          setTaxonomyNodes([]);
          setTaxonomyAvailable(false);
          if (!categoriesResult.ok) setFetchError(categoriesResult.error);
          else if (!subcategoriesResult.ok) setFetchError(subcategoriesResult.error);
        } else {
          setFetchError(taxonomyResult.error);
        }`;

if (source.includes(after)) {
  console.log("Saudi empty-taxonomy retry fallback is already applied.");
  process.exit(0);
}

if (!source.includes(before)) {
  throw new Error("Could not locate categories retry taxonomy block.");
}

fs.writeFileSync(file, source.replace(before, after));
console.log("Applied Saudi empty-taxonomy retry fallback.");
