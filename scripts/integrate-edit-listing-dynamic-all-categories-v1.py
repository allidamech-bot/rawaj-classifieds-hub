from pathlib import Path
import re

path = Path("src/routes/profile/listings.$id.tsx")
source = path.read_text(encoding="utf-8")


def replace_once(label: str, old: str, new: str) -> None:
    global source
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one marker, found {count}")
    source = source.replace(old, new, 1)


replace_once(
    "dynamic field component import",
    'import { ListingTaxonomySelector } from "@/features/listing-studio/ListingTaxonomySelector";\n',
    'import { DynamicListingFields } from "@/features/listing-studio/DynamicListingFields";\n'
    'import { ListingTaxonomySelector } from "@/features/listing-studio/ListingTaxonomySelector";\n',
)

replace_once(
    "governed attribute imports",
    'import { fetchLocationPath, type LocationNodeType } from "@/lib/api/location-taxonomy";\n',
    'import { fetchLocationPath, type LocationNodeType } from "@/lib/api/location-taxonomy";\n'
    'import {\n'
    '  fetchOwnerListingAttributes,\n'
    '  replaceOwnerListingAttributes,\n'
    '  type ListingAttributeCompleteness,\n'
    '} from "@/lib/api/listing-attributes";\n'
    'import {\n'
    '  fetchPublishedLeafSchema,\n'
    '  type PublishedLeafSchema,\n'
    '} from "@/lib/api/taxonomy-metadata";\n',
)

replace_once(
    "dynamic helper imports",
    'import { calculateListingQuality, listingQualityCheckLabel } from "@/lib/listing-quality";\n',
    'import {\n'
    '  normalizeDynamicAttributesForWrite,\n'
    '  sanitizeDynamicListingValues,\n'
    '  validateDynamicListingFields,\n'
    '  type DynamicListingValues,\n'
    '} from "@/lib/dynamic-listing-fields";\n'
    'import { calculateListingQuality, listingQualityCheckLabel } from "@/lib/listing-quality";\n',
)

replace_once(
    "dynamic refs",
    '  const taxonomyAssignmentRequiredRef = useRef(false);\n',
    '  const taxonomyAssignmentRequiredRef = useRef(false);\n'
    '  const dynamicSchemaRequestIdRef = useRef(0);\n'
    '  const initialDynamicValuesRef = useRef<Record<string, unknown>>({});\n',
)

replace_once(
    "dynamic states",
    '  const [categoryDetails, setCategoryDetails] = useState<CategorySpecificDetails>({});\n',
    '  const [categoryDetails, setCategoryDetails] = useState<CategorySpecificDetails>({});\n'
    '  const [dynamicSchema, setDynamicSchema] = useState<PublishedLeafSchema | null>(null);\n'
    '  const [dynamicValues, setDynamicValues] = useState<DynamicListingValues>({});\n'
    '  const [dynamicFieldErrors, setDynamicFieldErrors] = useState<Record<string, string>>({});\n'
    '  const [dynamicSchemaLoading, setDynamicSchemaLoading] = useState(false);\n'
    '  const [dynamicSchemaError, setDynamicSchemaError] = useState<string | null>(null);\n',
)

replace_once(
    "dynamic derived state",
    '''  const categoryFieldKind = resolveCategoryFieldKind(selectedTaxonomyNode, category, listing);
  const showGlobalCondition = categoryUsesGlobalCondition(categoryFieldKind);
  const requiresPreciseLocation = categoryRequiresPreciseLocation(categoryFieldKind);
''',
    '''  const categoryFieldKind = resolveCategoryFieldKind(selectedTaxonomyNode, category, listing);
  const dynamicSchemaActive = Boolean(
    dynamicSchema?.found &&
      dynamicSchema.leaf?.id === taxonomyNodeId &&
      dynamicSchema.fields.some((field) => field.displaySurfaces.includes("listing_studio")),
  );
  const dynamicSchemaUsesListingCondition = Boolean(
    dynamicSchemaActive &&
      dynamicSchema?.fields.some((field) => field.key === "listing_condition"),
  );
  const normalizedDynamicAttributes = useMemo(
    () =>
      dynamicSchemaActive && dynamicSchema
        ? normalizeDynamicAttributesForWrite(dynamicSchema, dynamicValues)
        : {},
    [dynamicSchema, dynamicSchemaActive, dynamicValues],
  );
  const showGlobalCondition =
    !dynamicSchemaActive && categoryUsesGlobalCondition(categoryFieldKind);
  const requiresPreciseLocation = categoryRequiresPreciseLocation(categoryFieldKind);
''',
)

replace_once(
    "quality dynamic compatibility",
    '''        categoryFieldKind,
        categoryDetails,
        condition,
''',
    '''        categoryFieldKind: dynamicSchemaActive ? "general" : categoryFieldKind,
        categoryDetails: dynamicSchemaActive ? {} : categoryDetails,
        condition,
''',
)

replace_once(
    "quality dynamic dependency",
    '''      categoryDetails,
      categoryFieldKind,
      categoryId,
''',
    '''      categoryDetails,
      categoryFieldKind,
      categoryId,
      dynamicSchemaActive,
''',
)

replace_once(
    "dynamic hydration effects",
    '''  useEffect(() => {
    selectedImagesRef.current = selectedImages;
  }, [selectedImages]);
''',
    '''  useEffect(() => {
    const requestId = ++dynamicSchemaRequestIdRef.current;
    setDynamicSchema(null);
    setDynamicValues({});
    setDynamicFieldErrors({});
    setDynamicSchemaError(null);
    initialDynamicValuesRef.current = {};

    if (!listing?.id || !taxonomyNodeId || !selectedTaxonomyNode?.isLeaf || !auth.profile?.id) {
      setDynamicSchemaLoading(false);
      return;
    }

    setDynamicSchemaLoading(true);
    void Promise.all([
      fetchPublishedLeafSchema(taxonomyNodeId),
      fetchOwnerListingAttributes(auth.profile.id, listing.id),
    ]).then(([schemaResult, attributeResult]) => {
      if (requestId !== dynamicSchemaRequestIdRef.current) return;
      setDynamicSchemaLoading(false);

      if (!schemaResult.ok) {
        if (schemaResult.error.code !== "schema_missing") {
          setDynamicSchemaError(schemaResult.error.message);
        }
        return;
      }
      if (!schemaResult.data.found || schemaResult.data.leaf?.id !== taxonomyNodeId) return;

      const defaults = Object.fromEntries(
        schemaResult.data.fields
          .filter((field) => field.defaultValue !== null && field.defaultValue !== undefined)
          .map((field) => [field.key, field.defaultValue]),
      );
      const storedValues =
        attributeResult.ok && attributeResult.data.taxonomyNodeId === taxonomyNodeId
          ? attributeResult.data.values
          : {};
      if (!attributeResult.ok && attributeResult.error.code !== "schema_missing") {
        setDynamicSchemaError(attributeResult.error.message);
      }

      const hydratedValues = sanitizeDynamicListingValues(schemaResult.data, {
        ...defaults,
        ...storedValues,
      });
      setDynamicSchema(schemaResult.data);
      setDynamicValues(hydratedValues);
      initialDynamicValuesRef.current = normalizeDynamicAttributesForWrite(
        schemaResult.data,
        hydratedValues,
      );

      if (schemaResult.data.fields.some((field) => field.key === "listing_condition")) {
        setCondition(dynamicListingCondition(hydratedValues.listing_condition));
      }
    });

    return () => {
      dynamicSchemaRequestIdRef.current += 1;
    };
  }, [auth.profile?.id, listing?.id, selectedTaxonomyNode?.isLeaf, taxonomyNodeId]);

  useEffect(() => {
    if (
      !showGlobalCondition &&
      !dynamicSchemaUsesListingCondition &&
      condition !== "not_applicable"
    ) {
      setCondition("not_applicable");
    }
  }, [condition, dynamicSchemaUsesListingCondition, showGlobalCondition]);

  useEffect(() => {
    selectedImagesRef.current = selectedImages;
  }, [selectedImages]);
''',
)

replace_once(
    "taxonomy dynamic reset",
    '''    taxonomyNodeIdRef.current = node.id;
    taxonomyAssignmentRequiredRef.current = node.id !== taxonomyAssignmentBaseRef.current;
    setTaxonomyNodeId(node.id);
''',
    '''    taxonomyNodeIdRef.current = node.id;
    taxonomyAssignmentRequiredRef.current = node.id !== taxonomyAssignmentBaseRef.current;
    setDynamicSchema(null);
    setDynamicValues({});
    setDynamicFieldErrors({});
    setDynamicSchemaError(null);
    setTaxonomyNodeId(node.id);
''',
)

replace_once(
    "legacy selection dynamic reset",
    '''    setCategoryId(nextCategoryId);
    setSubcategoryId(null);
''',
    '''    setDynamicSchema(null);
    setDynamicValues({});
    setDynamicFieldErrors({});
    setDynamicSchemaError(null);
    setCategoryId(nextCategoryId);
    setSubcategoryId(null);
''',
)

replace_once(
    "dynamic values handler",
    '''  async function persistCapturedChanges(
''',
    '''  function handleDynamicValuesChange(nextValues: DynamicListingValues) {
    setDynamicValues(nextValues);
    setDynamicFieldErrors({});
    if (!dynamicSchemaUsesListingCondition) return;
    const nextCondition = dynamicListingCondition(nextValues.listing_condition);
    if (nextCondition !== condition) setCondition(nextCondition);
  }

  async function persistCapturedChanges(
''',
)

persist_pattern = re.compile(
    r'''  async function persistCapturedChanges\([\s\S]*?\n  \}\n\n  const handleSave = useCallback'''
)
persist_replacement = '''  async function persistCapturedChanges(
    captured: EditListingFormValues,
    contentFlags: string[],
  ): Promise<
    | {
        ok: true;
        listing: ClassifiedListing;
        changed: boolean;
        completeness?: ListingAttributeCompleteness;
      }
    | { ok: false; message: string; taxonomyFailure?: boolean; attributeFailure?: boolean }
  > {
    const initialSnapshot = initialSnapshotRef.current;
    if (!initialSnapshot || !listing) {
      return { ok: false, message: text("تعذر حفظ التعديلات.", "Could not save changes.") };
    }

    const capturedTaxonomyNodeId = captured.taxonomyNodeId;
    const taxonomyChanged =
      taxonomyAssignmentRequiredRef.current &&
      Boolean(capturedTaxonomyNodeId) &&
      capturedTaxonomyNodeId === taxonomyNodeIdRef.current;
    const attributesChanged =
      dynamicSchemaActive &&
      !sameValue(normalizedDynamicAttributes, initialDynamicValuesRef.current);
    const patch = buildChangedListingPatch(initialSnapshot, captured, contentFlags);
    const hasChangedFields = Object.keys(patch).length > 0;
    let savedListing = listing;
    let completeness: ListingAttributeCompleteness | undefined;

    if (hasChangedFields) {
      const updateResult = await updateOwnerListing(auth.profile?.id ?? null, listing.id, patch);
      if (!updateResult.ok) return { ok: false, message: updateResult.error.message };
      savedListing = updateResult.data;
    }

    if (taxonomyChanged) {
      const taxonomyResult = await assignOwnerListingTaxonomy(
        auth.profile?.id ?? null,
        savedListing.id,
        capturedTaxonomyNodeId,
      );
      if (!taxonomyResult.ok && taxonomyResult.error.code !== "schema_missing") {
        return { ok: false, message: taxonomyResult.error.message, taxonomyFailure: true };
      }
      taxonomyAssignmentBaseRef.current = capturedTaxonomyNodeId;
      taxonomyAssignmentRequiredRef.current = taxonomyNodeIdRef.current !== capturedTaxonomyNodeId;
    }

    if (dynamicSchemaActive && dynamicSchema && (attributesChanged || taxonomyChanged)) {
      const attributeResult = await replaceOwnerListingAttributes(
        auth.profile?.id ?? null,
        savedListing.id,
        savedListing.updatedAt,
        normalizedDynamicAttributes,
      );
      if (!attributeResult.ok) {
        return {
          ok: false,
          message: attributeResult.error.message,
          attributeFailure: true,
        };
      }
      savedListing = {
        ...savedListing,
        updatedAt: attributeResult.data.updatedAt,
      };
      completeness = attributeResult.data.completeness;
      initialDynamicValuesRef.current = { ...normalizedDynamicAttributes };
    }

    const changed = hasChangedFields || taxonomyChanged || attributesChanged;
    if (changed) {
      setListing(savedListing);
      initialSnapshotRef.current = {
        ...captured,
        details: { ...savedListing.details },
      };
    }

    return { ok: true, listing: savedListing, changed, completeness };
  }

  const handleSave = useCallback'''
source, count = persist_pattern.subn(persist_replacement, source, count=1)
if count != 1:
    raise SystemExit(f"persist function replacement count: {count}")

replace_once(
    "save loading guard",
    '''    try {
      const captured = captureCurrentFormValues();
      const validation = validateEditListing({
        values: captured,
''',
    '''    try {
      if (dynamicSchemaLoading) {
        setSavingError(
          text(
            "انتظر حتى يكتمل تحميل حقول التصنيف.",
            "Wait for the category fields to finish loading.",
          ),
        );
        return;
      }

      const captured = captureCurrentFormValues();
      const validationValues = dynamicSchemaActive
        ? { ...captured, categoryKind: "general" as const, categoryDetails: {} }
        : captured;
      const validation = validateEditListing({
        values: validationValues,
''',
)

replace_once(
    "save attribute failure message",
    '''          result.taxonomyFailure
            ? text(
                "تم حفظ التعديلات، لكن تعذر تحديث التصنيف.",
                "Changes were saved, but taxonomy could not be updated.",
              )
            : result.message,
''',
    '''          result.taxonomyFailure
            ? text(
                "تم حفظ التعديلات، لكن تعذر تحديث التصنيف.",
                "Changes were saved, but taxonomy could not be updated.",
              )
            : result.attributeFailure
              ? text(
                  "تم حفظ التعديلات الأساسية، لكن تعذر حفظ حقول التصنيف المنظمة.",
                  "Base changes were saved, but governed category fields could not be saved.",
                )
              : result.message,
''',
)

replace_once(
    "resubmit dynamic validation",
    '''    try {
      const captured = captureCurrentFormValues();
      const validation = validateEditListing({
        values: captured,
''',
    '''    try {
      if (dynamicSchemaLoading) {
        setSavingError(
          text(
            "انتظر حتى يكتمل تحميل حقول التصنيف.",
            "Wait for the category fields to finish loading.",
          ),
        );
        return;
      }

      const captured = captureCurrentFormValues();
      const validationValues = dynamicSchemaActive
        ? { ...captured, categoryKind: "general" as const, categoryDetails: {} }
        : captured;
      const validation = validateEditListing({
        values: validationValues,
''',
)

replace_once(
    "resubmit generic field errors",
    '''      if (!validation.ok) {
        setSavingError(validation.message);
        return;
      }

      const saveResult = await persistCapturedChanges(captured, validation.contentFlags);
''',
    '''      if (!validation.ok) {
        setSavingError(validation.message);
        return;
      }

      if (dynamicSchemaActive && dynamicSchema) {
        const dynamicValidation = validateDynamicListingFields(
          dynamicSchema,
          dynamicValues,
          language,
        );
        setDynamicFieldErrors(dynamicValidation.fields);
        if (!dynamicValidation.ok) {
          setSavingError(
            dynamicValidation.summary[0] ??
              text(
                "أكمل الحقول المطلوبة الخاصة بالتصنيف.",
                "Complete the required category fields.",
              ),
          );
          return;
        }
      }

      const saveResult = await persistCapturedChanges(captured, validation.contentFlags);
''',
)

replace_once(
    "resubmit attribute failure message",
    '''          saveResult.taxonomyFailure
            ? text(
                "تم حفظ التعديلات، لكن تعذر تحديث التصنيف.",
                "Changes were saved, but taxonomy could not be updated.",
              )
            : saveResult.message,
''',
    '''          saveResult.taxonomyFailure
            ? text(
                "تم حفظ التعديلات، لكن تعذر تحديث التصنيف.",
                "Changes were saved, but taxonomy could not be updated.",
              )
            : saveResult.attributeFailure
              ? text(
                  "تم حفظ التعديلات الأساسية، لكن تعذر حفظ حقول التصنيف المنظمة.",
                  "Base changes were saved, but governed category fields could not be saved.",
                )
              : saveResult.message,
''',
)

replace_once(
    "resubmit server completeness",
    '''      const submitResult = await submitOwnerListingForReview(
''',
    '''      if (saveResult.completeness && !saveResult.completeness.complete) {
        const missingLabels = saveResult.completeness.missingRequiredFields
          .map((field) => (language === "en" ? field.labelEn || field.labelAr : field.labelAr))
          .join(language === "ar" ? "، " : ", ");
        setSavingError(
          text(
            "أكمل الحقول المطلوبة قبل إعادة الإرسال: " + missingLabels,
            "Complete the required fields before resubmission: " + missingLabels,
          ),
        );
        return;
      }

      const submitResult = await submitOwnerListingForReview(
''',
)

replace_once(
    "dynamic fields UI",
    '''            <CategorySpecificFields
              kind={categoryFieldKind}
              values={categoryDetails}
              disabled={!isEditable}
              text={text}
              onChange={(nextDetails) => {
                setCategoryDetails(nextDetails);
                if (categoryFieldKind === "vehicles" || categoryFieldKind === "electronics") {
                  setCondition(categoryDetailsGlobalCondition(categoryFieldKind, nextDetails));
                }
              }}
            />
''',
    '''            {dynamicSchemaLoading ? (
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
                errors={dynamicFieldErrors}
                disabled={!isEditable || saving || resubmitting}
              />
            ) : (
              <CategorySpecificFields
                kind={categoryFieldKind}
                values={categoryDetails}
                disabled={!isEditable}
                text={text}
                onChange={(nextDetails) => {
                  setCategoryDetails(nextDetails);
                  if (categoryFieldKind === "vehicles" || categoryFieldKind === "electronics") {
                    setCondition(categoryDetailsGlobalCondition(categoryFieldKind, nextDetails));
                  }
                }}
              />
            )}
            {dynamicSchemaError ? (
              <p className="mt-3 rounded-xl border border-warning/20 bg-warning/10 p-3 text-xs leading-5 text-warning-foreground">
                {text(
                  "تعذر تحميل بعض الحقول المنظمة، لذلك تم الحفاظ على نموذج التوافق والبيانات القديمة.",
                  "Some governed fields could not load, so the compatibility form and legacy data were preserved.",
                )}
              </p>
            ) : null}
''',
)

replace_once(
    "dynamic condition helper",
    '''function readDetailString(details: Record<string, unknown>, key: string) {
''',
    '''function dynamicListingCondition(value: unknown): ListingCondition {
  if (value === "new") return "new";
  if (value === "like_new") return "like_new";
  if (value === "good" || value === "fair") return "used";
  if (value === "for_parts") return "for_parts";
  return "not_applicable";
}

function readDetailString(details: Record<string, unknown>, key: string) {
''',
)

required_markers = [
    "<DynamicListingFields",
    "fetchOwnerListingAttributes",
    "replaceOwnerListingAttributes",
    "validateDynamicListingFields",
    "initialDynamicValuesRef",
    "dynamicSchemaUsesListingCondition",
]
for marker in required_markers:
    if marker not in source:
        raise SystemExit(f"missing integrated marker: {marker}")

path.write_text(source, encoding="utf-8")
print("Integrated governed dynamic fields into edit-listing for all taxonomy leaves.")
