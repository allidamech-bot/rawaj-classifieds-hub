import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

const filePath = "src/routes/add-listing.tsx";
let source = await readFile(filePath, "utf8");

replaceOnce(
  "dynamic field component import",
  'import { ListingTaxonomySelector } from "@/features/listing-studio/ListingTaxonomySelector";\n',
  'import { DynamicListingFields } from "@/features/listing-studio/DynamicListingFields";\nimport { ListingTaxonomySelector } from "@/features/listing-studio/ListingTaxonomySelector";\n',
);

replaceOnce(
  "dynamic API imports",
  'import type { LocationNodeType } from "@/lib/api/location-taxonomy";\n',
  'import type { LocationNodeType } from "@/lib/api/location-taxonomy";\nimport { replaceOwnerListingAttributes } from "@/lib/api/listing-attributes";\nimport {\n  fetchPublishedLeafSchema,\n  type PublishedLeafSchema,\n} from "@/lib/api/taxonomy-metadata";\n',
);

replaceOnce(
  "dynamic field helper imports",
  'import { calculateListingQuality, listingQualityCheckLabel } from "@/lib/listing-quality";\n',
  'import {\n  dynamicFieldReviewRows,\n  normalizeDynamicAttributesForWrite,\n  validateDynamicListingFields,\n  type DynamicListingValues,\n} from "@/lib/dynamic-listing-fields";\nimport { calculateListingQuality, listingQualityCheckLabel } from "@/lib/listing-quality";\n',
);

replaceOnce(
  "dynamic listing state",
  '  const [categoryDetails, setCategoryDetails] = useState<CategorySpecificDetails>({});\n',
  '  const [categoryDetails, setCategoryDetails] = useState<CategorySpecificDetails>({});\n  const [dynamicSchema, setDynamicSchema] = useState<PublishedLeafSchema | null>(null);\n  const [dynamicValues, setDynamicValues] = useState<DynamicListingValues>({});\n  const [dynamicSchemaLoading, setDynamicSchemaLoading] = useState(false);\n  const [dynamicSchemaError, setDynamicSchemaError] = useState<string | null>(null);\n',
);

replaceOnce(
  "dynamic schema request ref",
  '  const setupRequestIdRef = useRef(0);\n',
  '  const setupRequestIdRef = useRef(0);\n  const dynamicSchemaRequestIdRef = useRef(0);\n',
);

replaceOnce(
  "dynamic derived state",
  `  const categoryFieldKind = resolveCategoryFieldKind(selectedTaxonomyNode, category);
  const showGlobalCondition = categoryUsesGlobalCondition(categoryFieldKind);
  const requiresPreciseLocation = categoryRequiresPreciseLocation(categoryFieldKind);
  const taxonomySelectionReady =
    taxonomyNodes.length > 0 ? Boolean(selectedTaxonomyNode?.isLeaf) : Boolean(categoryId);
  const preciseLocationSelected =
    Boolean(district) ||
    (Boolean(locationNodeId) &&
      locationNodeType !== "" &&
      locationNodeType !== "country" &&
      locationNodeType !== "governorate");
  const selectedTaxonomyPath = useMemo(
    () => getTaxonomyPath(buildTaxonomyIndex(taxonomyNodes), selectedTaxonomyNode),
    [selectedTaxonomyNode, taxonomyNodes],
  );
  const reviewCategoryRows = categoryDetailDisplayRows(
    categoryFieldKind,
    sanitizeCategoryDetails(categoryFieldKind, categoryDetails),
    text,
  ).slice(0, 6);
`,
  `  const categoryFieldKind = resolveCategoryFieldKind(selectedTaxonomyNode, category);
  const dynamicSchemaActive = Boolean(
    dynamicSchema?.found &&
      dynamicSchema.leaf?.id === taxonomyNodeId &&
      dynamicSchema.fields.some((field) => field.displaySurfaces.includes("listing_studio")),
  );
  const showGlobalCondition =
    !dynamicSchemaActive && categoryUsesGlobalCondition(categoryFieldKind);
  const requiresPreciseLocation = categoryRequiresPreciseLocation(categoryFieldKind);
  const taxonomySelectionReady =
    taxonomyNodes.length > 0 ? Boolean(selectedTaxonomyNode?.isLeaf) : Boolean(categoryId);
  const preciseLocationSelected =
    Boolean(district) ||
    (Boolean(locationNodeId) &&
      locationNodeType !== "" &&
      locationNodeType !== "country" &&
      locationNodeType !== "governorate");
  const selectedTaxonomyPath = useMemo(
    () => getTaxonomyPath(buildTaxonomyIndex(taxonomyNodes), selectedTaxonomyNode),
    [selectedTaxonomyNode, taxonomyNodes],
  );
  const normalizedDynamicAttributes = useMemo(
    () =>
      dynamicSchemaActive && dynamicSchema
        ? normalizeDynamicAttributesForWrite(dynamicSchema, dynamicValues)
        : {},
    [dynamicSchema, dynamicSchemaActive, dynamicValues],
  );
  const reviewCategoryRows = (
    dynamicSchemaActive && dynamicSchema
      ? dynamicFieldReviewRows(dynamicSchema, dynamicValues, language)
      : categoryDetailDisplayRows(
          categoryFieldKind,
          sanitizeCategoryDetails(categoryFieldKind, categoryDetails),
          text,
        )
  ).slice(0, 12);
`,
);

replaceOnce(
  "quality dynamic compatibility",
  `        categoryFieldKind,
        categoryDetails,
        condition,
`,
  `        categoryFieldKind: dynamicSchemaActive ? "general" : categoryFieldKind,
        categoryDetails: dynamicSchemaActive ? {} : categoryDetails,
        condition,
`,
);

replaceOnce(
  "quality dependencies",
  `      categoryDetails,
      categoryFieldKind,
      categoryId,
`,
  `      categoryDetails,
      categoryFieldKind,
      categoryId,
      dynamicSchemaActive,
`,
);

replaceOnce(
  "published schema loading effect",
  `  useEffect(() => {
    taxonomyNodeIdRef.current = taxonomyNodeId;
  }, [taxonomyNodeId]);

  useEffect(() => {
    if (!showGlobalCondition && condition !== "not_applicable") {
`,
  `  useEffect(() => {
    taxonomyNodeIdRef.current = taxonomyNodeId;
  }, [taxonomyNodeId]);

  useEffect(() => {
    const requestId = ++dynamicSchemaRequestIdRef.current;
    setDynamicSchema(null);
    setDynamicValues({});
    setDynamicSchemaError(null);

    if (!taxonomyNodeId || !selectedTaxonomyNode?.isLeaf) {
      setDynamicSchemaLoading(false);
      return;
    }

    setDynamicSchemaLoading(true);
    void fetchPublishedLeafSchema(taxonomyNodeId).then((result) => {
      if (requestId !== dynamicSchemaRequestIdRef.current) return;
      setDynamicSchemaLoading(false);

      if (!result.ok) {
        if (result.error.code !== "schema_missing") {
          setDynamicSchemaError(result.error.message);
        }
        return;
      }

      if (!result.data.found || result.data.leaf?.id !== taxonomyNodeId) return;

      const defaults = Object.fromEntries(
        result.data.fields
          .filter((field) => field.defaultValue !== null && field.defaultValue !== undefined)
          .map((field) => [field.key, field.defaultValue]),
      );
      setDynamicSchema(result.data);
      setDynamicValues(defaults);
    });

    return () => {
      dynamicSchemaRequestIdRef.current += 1;
    };
  }, [selectedTaxonomyNode?.isLeaf, taxonomyNodeId]);

  useEffect(() => {
    if (!showGlobalCondition && condition !== "not_applicable") {
`,
);

replaceOnce(
  "dynamic validation",
  `    const errors = buildStepErrors({
      step: currentStep,
      categoryId,
      taxonomyNodeId,
      taxonomyNodesLength: taxonomyNodes.length,
      selectedTaxonomyNodeIsLeaf: selectedTaxonomyNode?.isLeaf ?? false,
      title,
      description,
      price: normalizedPrice,
      priceType,
      governorateId,
      locationNodeId,
      preciseLocationSelected,
      categoryFieldKind,
      categoryDetails,
      contact,
      phone,
      whatsapp,
    });
    setFieldErrors(errors.fields);
`,
  `    const errors = buildStepErrors({
      step: currentStep,
      categoryId,
      taxonomyNodeId,
      taxonomyNodesLength: taxonomyNodes.length,
      selectedTaxonomyNodeIsLeaf: selectedTaxonomyNode?.isLeaf ?? false,
      title,
      description,
      price: normalizedPrice,
      priceType,
      governorateId,
      locationNodeId,
      preciseLocationSelected,
      categoryFieldKind: dynamicSchemaActive ? "general" : categoryFieldKind,
      categoryDetails: dynamicSchemaActive ? {} : categoryDetails,
      contact,
      phone,
      whatsapp,
    });

    if ((currentStep === 1 || currentStep === 3) && dynamicSchemaLoading) {
      const loadingMessage = text(
        "انتظر حتى يكتمل تحميل حقول التصنيف.",
        "Wait for the category fields to finish loading.",
      );
      errors.fields.dynamicSchema = loadingMessage;
      errors.summary.push(loadingMessage);
    }

    if ((currentStep === 1 || currentStep === 3) && dynamicSchemaActive && dynamicSchema) {
      const dynamicErrors = validateDynamicListingFields(dynamicSchema, dynamicValues, language);
      Object.assign(errors.fields, dynamicErrors.fields);
      for (const message of dynamicErrors.summary) {
        if (!errors.summary.includes(message)) errors.summary.push(message);
      }
    }

    setFieldErrors(errors.fields);
`,
);

replaceOnce(
  "reset dynamic selection state",
  `    taxonomyNodeIdRef.current = node.id;
    setTaxonomyNodeId(node.id);
`,
  `    taxonomyNodeIdRef.current = node.id;
    setDynamicSchema(null);
    setDynamicValues({});
    setDynamicSchemaError(null);
    setTaxonomyNodeId(node.id);
`,
);

replaceOnce(
  "reset dynamic legacy selection state",
  `    taxonomyNodeIdRef.current = "";
    setCategoryId(nextCategory.id);
`,
  `    taxonomyNodeIdRef.current = "";
    setDynamicSchema(null);
    setDynamicValues({});
    setDynamicSchemaError(null);
    setCategoryId(nextCategory.id);
`,
);

replaceOnce(
  "dynamic value handler",
  `  function handleCategoryDetailsChange(nextDetails: CategorySpecificDetails) {
    setCategoryDetails(nextDetails);
    if (categoryFieldKind === "vehicles" || categoryFieldKind === "electronics") {
      setCondition(categoryDetailsGlobalCondition(categoryFieldKind, nextDetails));
    }
  }

  function buildCurrentListingPayload(details: Record<string, unknown>) {
`,
  `  function handleCategoryDetailsChange(nextDetails: CategorySpecificDetails) {
    setCategoryDetails(nextDetails);
    if (categoryFieldKind === "vehicles" || categoryFieldKind === "electronics") {
      setCondition(categoryDetailsGlobalCondition(categoryFieldKind, nextDetails));
    }
  }

  function handleDynamicValuesChange(nextValues: DynamicListingValues) {
    setDynamicValues(nextValues);
    if (!dynamicSchema?.fields.some((field) => field.key === "listing_condition")) return;
    const nextCondition = dynamicListingCondition(nextValues.listing_condition);
    if (nextCondition !== condition) setCondition(nextCondition);
  }

  function buildCurrentListingPayload(details: Record<string, unknown>) {
`,
);

replaceOnce(
  "autosave dynamic details",
  `    const details = mergeCategoryDetails(
      {
        ...(taxonomyNodeId ? { _taxonomy_node_id: taxonomyNodeId } : {}),
        ...(contact.phone && isSafePhoneValue(normalizedPhone) ? { phone: normalizedPhone } : {}),
        ...(contact.whatsapp && isSafePhoneValue(normalizedWhatsapp)
          ? { whatsapp: normalizedWhatsapp }
          : {}),
      },
      categoryFieldKind,
      categoryDetails,
    );
`,
  `    const compatibilityDetails = {
      ...(taxonomyNodeId ? { _taxonomy_node_id: taxonomyNodeId } : {}),
      ...(contact.phone && isSafePhoneValue(normalizedPhone) ? { phone: normalizedPhone } : {}),
      ...(contact.whatsapp && isSafePhoneValue(normalizedWhatsapp)
        ? { whatsapp: normalizedWhatsapp }
        : {}),
    };
    const details = dynamicSchemaActive
      ? compatibilityDetails
      : mergeCategoryDetails(compatibilityDetails, categoryFieldKind, categoryDetails);
`,
);

replaceOnce(
  "autosave payload dependencies",
  `    categoryFieldKind,
    categoryDetails,
  ]);
`,
  `    categoryFieldKind,
    categoryDetails,
    dynamicSchemaActive,
  ]);
`,
);

replaceOnce(
  "autosave signature",
  `    const signature = JSON.stringify(autosavePayload);
`,
  `    const signature = JSON.stringify({
      listing: autosavePayload,
      attributes: dynamicSchemaActive ? normalizedDynamicAttributes : null,
    });
`,
);

replaceOnce(
  "autosave loading guard",
  `      Boolean(profileId) &&
      taxonomySelectionReady &&
`,
  `      Boolean(profileId) &&
      !dynamicSchemaLoading &&
      taxonomySelectionReady &&
`,
);

replaceOnce(
  "autosave governed attribute write",
  `        if (result.ok) {
          if (taxonomyNodeId && taxonomyNodeIdRef.current === taxonomyNodeId) {
            const taxonomyResult = await assignOwnerListingTaxonomy(
              profileId,
              result.data.id,
              taxonomyNodeId,
            );
            if (!taxonomyResult.ok && taxonomyResult.error.code !== "schema_missing") {
              setAutosaveState("failed");
              setAutosaveError(taxonomyResult.error.message);
              return;
            }
          }
          draftListingRef.current = result.data;
          setDraftListing(result.data);
          setCreatedListingId(result.data.id);
        }

        if (requestId !== autosaveRequestIdRef.current || submittingRef.current) return;

        if (!result.ok) {
          setAutosaveState("failed");
          setAutosaveError(result.error.message);
          return;
        }

        lastAutosaveSignatureRef.current = signature;
        setLastAutosavedAt(result.data.updatedAt || new Date().toISOString());
        setAutosaveState("saved");
        setAutosaveError(null);
`,
  `        if (!result.ok) {
          if (requestId !== autosaveRequestIdRef.current || submittingRef.current) return;
          setAutosaveState("failed");
          setAutosaveError(result.error.message);
          return;
        }

        let persistedDraft = result.data;
        if (taxonomyNodeId && taxonomyNodeIdRef.current === taxonomyNodeId) {
          const taxonomyResult = await assignOwnerListingTaxonomy(
            profileId,
            persistedDraft.id,
            taxonomyNodeId,
          );
          if (!taxonomyResult.ok && taxonomyResult.error.code !== "schema_missing") {
            setAutosaveState("failed");
            setAutosaveError(taxonomyResult.error.message);
            return;
          }
        }

        if (
          dynamicSchemaActive &&
          dynamicSchema &&
          taxonomyNodeIdRef.current === taxonomyNodeId
        ) {
          const attributeResult = await replaceOwnerListingAttributes(
            profileId,
            persistedDraft.id,
            persistedDraft.updatedAt,
            normalizedDynamicAttributes,
          );
          if (!attributeResult.ok) {
            setAutosaveState("failed");
            setAutosaveError(attributeResult.error.message);
            return;
          }
          persistedDraft = {
            ...persistedDraft,
            updatedAt: attributeResult.data.updatedAt,
          };
        }

        if (requestId !== autosaveRequestIdRef.current || submittingRef.current) return;

        draftListingRef.current = persistedDraft;
        setDraftListing(persistedDraft);
        setCreatedListingId(persistedDraft.id);
        lastAutosaveSignatureRef.current = signature;
        setLastAutosavedAt(persistedDraft.updatedAt || new Date().toISOString());
        setAutosaveState("saved");
        setAutosaveError(null);
`,
);

replaceOnce(
  "autosave dynamic dependencies",
  `    autosavePayload,
    locationNodeId,
    taxonomyNodeId,
`,
  `    autosavePayload,
    dynamicSchema,
    dynamicSchemaActive,
    dynamicSchemaLoading,
    locationNodeId,
    normalizedDynamicAttributes,
    taxonomyNodeId,
`,
);

replaceOnce(
  "submit dynamic details",
  `      const details = mergeCategoryDetails(
        {
          ...(canonicalTaxonomyNodeId ? { _taxonomy_node_id: canonicalTaxonomyNodeId } : {}),
          ...(contact.phone ? { phone: normalizedPhone } : {}),
          ...(contact.whatsapp ? { whatsapp: normalizedWhatsapp } : {}),
          ...(contentCheck.flags.length > 0 ? { content_flags: contentCheck.flags } : {}),
        },
        categoryFieldKind,
        categoryDetails,
      );
`,
  `      const compatibilityDetails = {
        ...(canonicalTaxonomyNodeId ? { _taxonomy_node_id: canonicalTaxonomyNodeId } : {}),
        ...(contact.phone ? { phone: normalizedPhone } : {}),
        ...(contact.whatsapp ? { whatsapp: normalizedWhatsapp } : {}),
        ...(contentCheck.flags.length > 0 ? { content_flags: contentCheck.flags } : {}),
      };
      const details = dynamicSchemaActive
        ? compatibilityDetails
        : mergeCategoryDetails(compatibilityDetails, categoryFieldKind, categoryDetails);
`,
);

replaceOnce(
  "submit governed attribute write",
  `      const listingDraft = result.data;

      if (canonicalTaxonomyNodeId) {
        const taxonomyResult = await assignOwnerListingTaxonomy(
          auth.profile?.id ?? null,
          listingDraft.id,
          canonicalTaxonomyNodeId,
        );
        if (!taxonomyResult.ok && taxonomyResult.error.code !== "schema_missing") {
          setSubmitMessage(taxonomyResult.error.message);
          return;
        }
      }

      draftListingRef.current = listingDraft;
      setDraftListing(listingDraft);
      setCreatedListingId(listingDraft.id);
`,
  `      let listingDraft = result.data;

      if (canonicalTaxonomyNodeId) {
        const taxonomyResult = await assignOwnerListingTaxonomy(
          auth.profile?.id ?? null,
          listingDraft.id,
          canonicalTaxonomyNodeId,
        );
        if (!taxonomyResult.ok && taxonomyResult.error.code !== "schema_missing") {
          setSubmitMessage(taxonomyResult.error.message);
          return;
        }
      }

      if (dynamicSchemaActive && dynamicSchema) {
        const attributeResult = await replaceOwnerListingAttributes(
          auth.profile?.id ?? null,
          listingDraft.id,
          listingDraft.updatedAt,
          normalizedDynamicAttributes,
        );
        if (!attributeResult.ok) {
          setSubmitMessage(
            text(
              `تم حفظ الإعلان كمسودة، لكن تعذر حفظ حقول التصنيف: ${attributeResult.error.message}`,
              `The listing was saved as a draft, but category fields could not be saved: ${attributeResult.error.message}`,
            ),
          );
          return;
        }

        listingDraft = {
          ...listingDraft,
          updatedAt: attributeResult.data.updatedAt,
        };

        if (!attributeResult.data.completeness.complete) {
          draftListingRef.current = listingDraft;
          setDraftListing(listingDraft);
          setCreatedListingId(listingDraft.id);
          const missingLabels = attributeResult.data.completeness.missingRequiredFields
            .map((field) => (language === "en" ? field.labelEn || field.labelAr : field.labelAr))
            .join(language === "ar" ? "، " : ", ");
          setSubmitMessage(
            text(
              `تم حفظ الإعلان كمسودة. أكمل الحقول المطلوبة قبل الإرسال: ${missingLabels}`,
              `The listing was saved as a draft. Complete the required fields before submission: ${missingLabels}`,
            ),
          );
          return;
        }
      }

      draftListingRef.current = listingDraft;
      setDraftListing(listingDraft);
      setCreatedListingId(listingDraft.id);
`,
);

replaceOnce(
  "dynamic listing fields UI",
  `                    <CategorySpecificFields
                      kind={categoryFieldKind}
                      values={categoryDetails}
                      onChange={handleCategoryDetailsChange}
                      text={text}
                      errors={fieldErrors}
                    />
`,
  `                    {dynamicSchemaLoading ? (
                      <div className="mt-4 rounded-[1.15rem] border border-border/60 bg-card-warm/65 p-4 text-xs text-muted-foreground">
                        {text(
                          "جارٍ تجهيز الحقول الخاصة بالتصنيف...",
                          "Preparing category-specific fields...",
                        )}
                      </div>
                    ) : dynamicSchemaActive && dynamicSchema ? (
                      <DynamicListingFields
                        schema={dynamicSchema}
                        values={dynamicValues}
                        onChange={handleDynamicValuesChange}
                        language={language}
                        text={text}
                        errors={fieldErrors}
                        disabled={submitting}
                      />
                    ) : (
                      <CategorySpecificFields
                        kind={categoryFieldKind}
                        values={categoryDetails}
                        onChange={handleCategoryDetailsChange}
                        text={text}
                        errors={fieldErrors}
                      />
                    )}
                    {dynamicSchemaError ? (
                      <p className="mt-3 rounded-xl border border-warning/20 bg-warning/10 p-3 text-xs leading-5 text-warning-foreground">
                        {text(
                          "تعذر تحميل الحقول المنظمة، لذلك تم تشغيل النموذج المتوافق مؤقتاً. لم يتم فقدان اختيارك.",
                          "Governed fields could not load, so the compatible fallback form is active. Your category selection was preserved.",
                        )}
                      </p>
                    ) : null}
`,
);

replaceOnce(
  "dynamic listing condition helper",
  `function categoryDetailConditionValue(condition: ListingCondition) {
`,
  `function dynamicListingCondition(value: unknown): ListingCondition {
  if (value === "new") return "new";
  if (value === "like_new") return "like_new";
  if (value === "good" || value === "fair") return "used";
  if (value === "for_parts") return "for_parts";
  return "not_applicable";
}

function categoryDetailConditionValue(condition: ListingCondition) {
`,
);

if (!source.includes("<DynamicListingFields")) {
  throw new Error("DynamicListingFields was not integrated.");
}
if (!source.includes("replaceOwnerListingAttributes")) {
  throw new Error("Governed attribute persistence was not integrated.");
}
if (!source.includes("validateDynamicListingFields")) {
  throw new Error("Dynamic field validation was not integrated.");
}
if (!source.includes('categoryFieldKind: dynamicSchemaActive ? "general" : categoryFieldKind')) {
  throw new Error("Legacy category-specific validation was not bypassed for governed schemas.");
}

await writeFile(filePath, source, "utf8");
console.log("Integrated all-category dynamic listing fields into add-listing.tsx.");

function replaceOnce(label, search, replacement) {
  const first = source.indexOf(search);
  if (first === -1) {
    throw new Error(`Missing integration marker: ${label}`);
  }
  const second = source.indexOf(search, first + search.length);
  if (second !== -1) {
    throw new Error(`Integration marker is not unique: ${label}`);
  }
  source = `${source.slice(0, first)}${replacement}${source.slice(first + search.length)}`;
}
