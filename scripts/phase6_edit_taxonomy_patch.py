from pathlib import Path


def replace_once(path: str, old: str, new: str):
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"Missing expected block in {path}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1))


path = "src/routes/profile/listings.$id.tsx"

replace_once(
    path,
    'import { CanonicalLocationSelector } from "@/features/locations/CanonicalLocationSelector";\n',
    'import { CanonicalLocationSelector } from "@/features/locations/CanonicalLocationSelector";\nimport { ListingTaxonomySelector } from "@/features/listing-studio/ListingTaxonomySelector";\n',
)

replace_once(
    path,
    "  deleteListingImage,\n  deleteOwnerListing,\n  fetchListingImages,",
    "  assignOwnerListingTaxonomy,\n  deleteListingImage,\n  deleteOwnerListing,\n  fetchListingImages,\n  fetchOwnerListingTaxonomyAssignment,",
)

replace_once(
    path,
    "  fetchPublicGovernorates,\n  fetchPublicSubcategories,",
    "  fetchPublicGovernorates,\n  fetchPublicSubcategories,\n  fetchPublicTaxonomyNodes,",
)

replace_once(
    path,
    "  ListingCondition,\n  ListingImage,\n} from \"@/lib/classifieds-types\";",
    "  ListingCondition,\n  ListingImage,\n  TaxonomyNode,\n} from \"@/lib/classifieds-types\";",
)

replace_once(
    path,
    'import { listingStatusLabel } from "@/lib/status-labels";\n',
    'import { listingStatusLabel } from "@/lib/status-labels";\nimport { resolveTaxonomyListingSearch } from "@/lib/taxonomy";\n',
)

replace_once(
    path,
    "  const [subcategories, setSubcategories] = useState<ClassifiedSubcategory[]>([]);\n  const [saving, setSaving] = useState(false);",
    "  const [subcategories, setSubcategories] = useState<ClassifiedSubcategory[]>([]);\n  const [taxonomyNodes, setTaxonomyNodes] = useState<TaxonomyNode[]>([]);\n  const [saving, setSaving] = useState(false);",
)

replace_once(
    path,
    '  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);\n  const [governorateId, setGovernorateId] = useState("");',
    '  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);\n  const [taxonomyNodeId, setTaxonomyNodeId] = useState("");\n  const [governorateId, setGovernorateId] = useState("");',
)

replace_once(
    path,
    "  const category = categories.find((item) => item.id === categoryId);\n  const categoryFieldKind = detectCategoryFieldKind(category, listing);",
    "  const category = categories.find((item) => item.id === categoryId);\n  const selectedTaxonomyNode = taxonomyNodes.find((item) => item.id === taxonomyNodeId);\n  const categoryFieldKind = detectCategoryFieldKind(category, listing);",
)

replace_once(
    path,
    "      Boolean(categoryId),\n      title.trim().length >= 8,",
    "      taxonomyNodes.length > 0 ? Boolean(selectedTaxonomyNode?.isLeaf) : Boolean(categoryId),\n      title.trim().length >= 8,",
)

replace_once(
    path,
    "      const [listingResult, locationResult, refsResult] = await Promise.all([\n        fetchOwnerListingDetail(profileId, id),\n        fetchListingLocationNodeId(profileId, id),\n        Promise.all([\n          fetchPublicCategories(),\n          fetchPublicGovernorates(),\n          fetchPublicSubcategories(),\n        ]),\n      ]);",
    "      const [listingResult, locationResult, taxonomyAssignmentResult, refsResult] = await Promise.all([\n        fetchOwnerListingDetail(profileId, id),\n        fetchListingLocationNodeId(profileId, id),\n        fetchOwnerListingTaxonomyAssignment(profileId, id),\n        Promise.all([\n          fetchPublicCategories(),\n          fetchPublicGovernorates(),\n          fetchPublicSubcategories(),\n          fetchPublicTaxonomyNodes(),\n        ]),\n      ]);",
)

replace_once(
    path,
    "      setSubcategories(refsResult[2].data);\n\n      setTitle(listingResult.data.title);",
    "      setSubcategories(refsResult[2].data);\n      if (refsResult[3].ok) setTaxonomyNodes(refsResult[3].data);\n\n      const fallbackTaxonomyNodeId = readDetailString(listingResult.data.details, \"_taxonomy_node_id\");\n      setTaxonomyNodeId(\n        taxonomyAssignmentResult.ok\n          ? (taxonomyAssignmentResult.data?.taxonomyNodeId ?? fallbackTaxonomyNodeId)\n          : fallbackTaxonomyNodeId,\n      );\n\n      setTitle(listingResult.data.title);",
)

replace_once(
    path,
    "    const result = await updateOwnerListing(auth.profile?.id ?? null, listing.id, {",
    "    const details = { ...validation.details };\n    if (taxonomyNodeId) details._taxonomy_node_id = taxonomyNodeId;\n    else delete details._taxonomy_node_id;\n\n    const result = await updateOwnerListing(auth.profile?.id ?? null, listing.id, {",
)

replace_once(
    path,
    "      details: validation.details,\n    });\n\n    setSaving(false);\n    if (result.ok) {\n      setListing(result.data);",
    "      details,\n    });\n\n    if (result.ok && taxonomyNodeId) {\n      const taxonomyResult = await assignOwnerListingTaxonomy(\n        auth.profile?.id ?? null,\n        result.data.id,\n        taxonomyNodeId,\n      );\n      if (!taxonomyResult.ok && taxonomyResult.error.code !== \"schema_missing\") {\n        setSaving(false);\n        setListing(result.data);\n        setSavingError(taxonomyResult.error.message);\n        return;\n      }\n    }\n\n    setSaving(false);\n    if (result.ok) {\n      setListing(result.data);",
)

replace_once(
    path,
    "    subcategoryId,\n    governorateId,",
    "    subcategoryId,\n    taxonomyNodeId,\n    governorateId,",
)

replace_once(
    path,
    "    const saveResult = await updateOwnerListing(auth.profile?.id ?? null, listing.id, {",
    "    const details = { ...validation.details };\n    if (taxonomyNodeId) details._taxonomy_node_id = taxonomyNodeId;\n    else delete details._taxonomy_node_id;\n\n    const saveResult = await updateOwnerListing(auth.profile?.id ?? null, listing.id, {",
)

replace_once(
    path,
    "      details: validation.details,\n    });\n\n    if (!saveResult.ok) {",
    "      details,\n    });\n\n    if (!saveResult.ok) {",
)

replace_once(
    path,
    "    const result = await submitOwnerListingForReview(auth.profile?.id ?? null, saveResult.data.id);",
    "    if (taxonomyNodeId) {\n      const taxonomyResult = await assignOwnerListingTaxonomy(\n        auth.profile?.id ?? null,\n        saveResult.data.id,\n        taxonomyNodeId,\n      );\n      if (!taxonomyResult.ok && taxonomyResult.error.code !== \"schema_missing\") {\n        setResubmitting(false);\n        setListing(saveResult.data);\n        setSavingError(taxonomyResult.error.message);\n        return;\n      }\n    }\n\n    const result = await submitOwnerListingForReview(auth.profile?.id ?? null, saveResult.data.id);",
)

# Replace second dependency occurrence only, after handleResubmit.
file = Path(path)
text = file.read_text()
needle = "    subcategoryId,\n    governorateId,"
first = text.find(needle)
second = text.find(needle, first + 1)
if second == -1:
    raise SystemExit("Missing second resubmit dependency block")
text = text[:second] + text[second:].replace(
    needle,
    "    subcategoryId,\n    taxonomyNodeId,\n    governorateId,",
    1,
)
file.write_text(text)

old_category = '''              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={text("القسم", "Category")}>
                  <select
                    value={categoryId}
                    onChange={(e) => {
                      setCategoryId(e.target.value);
                      setSubcategoryId(null);
                      setCategoryDetails({});
                    }}
                    className="input"
                    disabled={!isEditable}
                  >
                    <option value="">{text("اختر", "Choose")}</option>
                    {categories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {categoryName(item.id, item.nameAr, language)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={text("القسم الفرعي", "Subcategory")}>
                  <select
                    value={subcategoryId ?? ""}
                    onChange={(e) => setSubcategoryId(e.target.value || null)}
                    className="input"
                    disabled={!isEditable || !categoryId}
                  >
                    <option value="">{text("اختر", "Choose")}</option>
                    {currentSubcategories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nameAr}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>'''

new_category = '''              {taxonomyNodes.length > 0 ? (
                <div className={!isEditable ? "pointer-events-none opacity-70" : ""}>
                  <ListingTaxonomySelector
                    nodes={taxonomyNodes}
                    selectedNodeId={taxonomyNodeId}
                    language={language}
                    text={text}
                    onSelect={(node, path) => {
                      if (!isEditable) return;
                      setTaxonomyNodeId(node.id);
                      if (!node.isLeaf) {
                        setCategoryId("");
                        setSubcategoryId(null);
                        setCategoryDetails({});
                        return;
                      }
                      const search = resolveTaxonomyListingSearch(node, path);
                      setCategoryId(search.category ?? "");
                      setSubcategoryId(search.taxonomyLegacySubcategoryId ?? null);
                      setCategoryDetails({});
                    }}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label={text("القسم", "Category")}>
                    <select
                      value={categoryId}
                      onChange={(e) => {
                        setCategoryId(e.target.value);
                        setSubcategoryId(null);
                        setTaxonomyNodeId("");
                        setCategoryDetails({});
                      }}
                      className="input"
                      disabled={!isEditable}
                    >
                      <option value="">{text("اختر", "Choose")}</option>
                      {categories.map((item) => (
                        <option key={item.id} value={item.id}>
                          {categoryName(item.id, item.nameAr, language)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={text("القسم الفرعي", "Subcategory")}>
                    <select
                      value={subcategoryId ?? ""}
                      onChange={(e) => {
                        setSubcategoryId(e.target.value || null);
                        setTaxonomyNodeId("");
                      }}
                      className="input"
                      disabled={!isEditable || !categoryId}
                    >
                      <option value="">{text("اختر", "Choose")}</option>
                      {currentSubcategories.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nameAr}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              )}'''
replace_once(path, old_category, new_category)

replace_once(
    path,
    '{ label: text("القسم محدد", "Category selected"), done: Boolean(categoryId) },',
    '{\n                  label: text("القسم محدد", "Category selected"),\n                  done: taxonomyNodes.length > 0 ? Boolean(selectedTaxonomyNode?.isLeaf) : Boolean(categoryId),\n                },',
)
