import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Camera, RefreshCw, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import {
  ListingStudioCompletionCard,
  ListingStudioHero,
  ListingStudioMessage,
  ListingStudioPreview,
  ListingStudioQualityPanel,
  ListingStudioSection,
  ListingStudioTrustStrip,
} from "@/features/listing-studio/listing-studio";
import { CanonicalLocationSelector } from "@/features/locations/CanonicalLocationSelector";
import { DynamicListingFields } from "@/features/listing-studio/DynamicListingFields";
import { ListingTaxonomySelector } from "@/features/listing-studio/ListingTaxonomySelector";
import {
  categoryRequiresPreciseLocation,
  categoryUsesGlobalCondition,
  mergeCategoryDetails,
  readCategoryDetails,
  resolveCategoryFieldKind,
  sanitizeCategoryDetails,
  type CategoryFieldKind,
  type CategorySpecificDetails,
} from "@/lib/category-fields";
import { fetchLocationPath, type LocationNodeType } from "@/lib/api/location-taxonomy";
import {
  fetchOwnerListingAttributes,
  replaceOwnerListingAttributes,
  type ListingAttributeCompleteness,
} from "@/lib/api/listing-attributes";
import { fetchPublishedLeafSchema, type PublishedLeafSchema } from "@/lib/api/taxonomy-metadata";
import {
  checkListingContentSafety,
  isSafePhoneValue,
  normalizeContactValue,
} from "@/lib/content-safety";
import {
  normalizeDynamicAttributesForWrite,
  sanitizeDynamicListingValues,
  validateDynamicListingFields,
  type DynamicListingValues,
} from "@/lib/dynamic-listing-fields";
import { calculateListingQuality, listingQualityCheckLabel } from "@/lib/listing-quality";
import {
  assignOwnerListingTaxonomy,
  deleteListingImage,
  deleteOwnerListing,
  fetchListingImages,
  fetchOwnerListingTaxonomyAssignment,
  isOwnerDeletableStatus,
  reorderListingImages,
  fetchOwnerListingDetail,
  fetchPublicCategories,
  fetchPublicGovernorates,
  fetchPublicSubcategories,
  fetchPublicTaxonomyNodes,
  submitOwnerListingForReview,
  updateOwnerListing,
  uploadListingImage,
} from "@/lib/classifieds-api";
import type {
  ClassifiedCategory,
  ClassifiedGovernorate,
  ClassifiedListing,
  ClassifiedsError,
  ClassifiedSubcategory,
  ListingCondition,
  ListingImage,
  TaxonomyNode,
  UpdateListingPayload,
} from "@/lib/classifieds-types";
import { categoryName, governorateName } from "@/lib/i18n";
import { fetchListingLocationNodeId } from "@/lib/api/listing-location-read";
import { listingStatusLabel } from "@/lib/status-labels";
import { resolveTaxonomyListingSearch } from "@/lib/taxonomy";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";
import type { PriceType } from "@/types";

type EditImageUploadState = "pending" | "uploading" | "failed";

interface EditUploadImageEntry {
  id: string;
  file: File;
  state: EditImageUploadState;
  error?: string;
  url: string;
}

interface EditListingFormValues {
  categoryId: string;
  subcategoryId: string | null;
  taxonomyNodeId: string;
  governorateId: string;
  title: string;
  description: string;
  price: number | null;
  priceType: PriceType;
  condition: ListingCondition;
  districtAr: string | null;
  locationNodeId: string;
  contactName: string;
  contactOptions: Record<"phone" | "whatsapp", boolean>;
  phone: string;
  whatsapp: string;
  categoryKind: CategoryFieldKind;
  categoryDetails: CategorySpecificDetails;
}

interface EditListingSnapshot extends EditListingFormValues {
  details: Record<string, unknown>;
}

const MAX_IMAGES = 6;

function fileFingerprint(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export const Route = createFileRoute("/profile/listings/$id")({
  head: () => ({
    meta: [{ title: "تعديل الإعلان | رَوَاج" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: ManageListingPage,
});

function ManageListingPage() {
  const { id } = Route.useParams();
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const navigate = Route.useNavigate();
  const [loading, setLoading] = useState(true);
  const [setupError, setSetupError] = useState<ClassifiedsError | null>(null);
  const [listing, setListing] = useState<ClassifiedListing | null>(null);
  const [categories, setCategories] = useState<ClassifiedCategory[]>([]);
  const [governorates, setGovernorates] = useState<ClassifiedGovernorate[]>([]);
  const [subcategories, setSubcategories] = useState<ClassifiedSubcategory[]>([]);
  const [taxonomyNodes, setTaxonomyNodes] = useState<TaxonomyNode[]>([]);
  const [taxonomyCompatibilityMessage, setTaxonomyCompatibilityMessage] = useState<string | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [savingError, setSavingError] = useState<string | null>(null);
  const [savingSuccess, setSavingSuccess] = useState<string | null>(null);
  const [resubmitting, setResubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [images, setImages] = useState<ListingImage[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<EditUploadImageEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const selectedImagesRef = useRef<EditUploadImageEntry[]>([]);
  const imagesRef = useRef<ListingImage[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imagesError, setImagesError] = useState<string | null>(null);
  const [reorderingImages, setReorderingImages] = useState(false);
  const setupRequestIdRef = useRef(0);
  const imagesRequestIdRef = useRef(0);
  const saveInFlightRef = useRef(false);
  const resubmitInFlightRef = useRef(false);
  const deleteInFlightRef = useRef(false);
  const uploadAllInFlightRef = useRef(false);
  const imageReorderInFlightRef = useRef(false);
  const imageDeleteInFlightRef = useRef<Set<string>>(new Set());
  const initialSnapshotRef = useRef<EditListingSnapshot | null>(null);
  const taxonomyNodeIdRef = useRef("");
  const taxonomyAssignmentBaseRef = useRef("");
  const taxonomyAssignmentRequiredRef = useRef(false);
  const dynamicSchemaRequestIdRef = useRef(0);
  const initialDynamicValuesRef = useRef<Record<string, unknown>>({});

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [taxonomyNodeId, setTaxonomyNodeId] = useState("");
  const [taxonomyNavigationNodeId, setTaxonomyNavigationNodeId] = useState("");
  const [governorateId, setGovernorateId] = useState("");
  const [district, setDistrict] = useState("");
  const [locationNodeId, setLocationNodeId] = useState("");
  const [locationNodeType, setLocationNodeType] = useState<LocationNodeType | "">("");
  const [price, setPrice] = useState("");
  const [priceType, setPriceType] = useState<PriceType>("fixed");
  const [condition, setCondition] = useState<ListingCondition>("not_applicable");
  const [contactName, setContactName] = useState("");
  const [contact, setContact] = useState({ phone: true, whatsapp: false });
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [categoryDetails, setCategoryDetails] = useState<CategorySpecificDetails>({});
  const [dynamicSchema, setDynamicSchema] = useState<PublishedLeafSchema | null>(null);
  const [dynamicValues, setDynamicValues] = useState<DynamicListingValues>({});
  const [dynamicFieldErrors, setDynamicFieldErrors] = useState<Record<string, string>>({});
  const [dynamicSchemaLoading, setDynamicSchemaLoading] = useState(false);
  const [dynamicSchemaError, setDynamicSchemaError] = useState<string | null>(null);

  const category = categories.find((item) => item.id === categoryId);
  const selectedTaxonomyNode = taxonomyNodes.find((item) => item.id === taxonomyNodeId);
  const categoryFieldKind = resolveCategoryFieldKind(selectedTaxonomyNode, category, listing);
  const dynamicSchemaActive = Boolean(
    dynamicSchema?.found &&
    dynamicSchema.leaf?.id === taxonomyNodeId &&
    dynamicSchema.fields.some((field) => field.displaySurfaces.includes("listing_studio")),
  );
  const dynamicSchemaUsesListingCondition = Boolean(
    dynamicSchemaActive && dynamicSchema?.fields.some((field) => field.key === "listing_condition"),
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
  const preciseLocationSelected =
    (Boolean(district) && !district.startsWith("@")) ||
    (Boolean(locationNodeId) &&
      locationNodeType !== "" &&
      locationNodeType !== "country" &&
      locationNodeType !== "governorate");
  const governorate = governorates.find((item) => item.id === governorateId);
  const currentSubcategories = useMemo(
    () => subcategories.filter((item) => item.categoryId === categoryId),
    [subcategories, categoryId],
  );

  const isEditable =
    listing?.status === "draft" || listing?.status === "rejected" || listing?.status === "approved";
  const isPendingReview = listing?.status === "pending_review";
  const isResubmittable = listing?.status === "draft" || listing?.status === "rejected";
  const isDeletable = Boolean(listing && isOwnerDeletableStatus(listing.status));
  const quality = useMemo(
    () =>
      calculateListingQuality({
        categoryReady:
          taxonomyNodes.length > 0 ? Boolean(selectedTaxonomyNode?.isLeaf) : Boolean(categoryId),
        title,
        description,
        imageCount:
          images.length + selectedImages.filter((entry) => entry.state !== "failed").length,
        priceReady: priceType !== "fixed" || Number(price) > 0,
        locationReady:
          (Boolean(locationNodeId) || Boolean(governorateId)) &&
          (!requiresPreciseLocation || preciseLocationSelected),
        categoryFieldKind: dynamicSchemaActive ? "general" : categoryFieldKind,
        categoryDetails: dynamicSchemaActive ? {} : categoryDetails,
        condition,
      }),
    [
      categoryDetails,
      categoryFieldKind,
      categoryId,
      dynamicSchemaActive,
      condition,
      description,
      district,
      governorateId,
      images.length,
      locationNodeId,
      preciseLocationSelected,
      requiresPreciseLocation,
      price,
      priceType,
      selectedImages,
      selectedTaxonomyNode?.isLeaf,
      taxonomyNodes.length,
      title,
    ],
  );
  const studioScore = quality.score;

  const loadSetup = useCallback(async () => {
    if (auth.status !== "signedIn" || !auth.profile?.id) return;
    const profileId = auth.profile.id;
    const requestId = ++setupRequestIdRef.current;
    setLoading(true);
    setSetupError(null);

    const [listingResult, locationResult, taxonomyAssignmentResult, refsResult] = await Promise.all(
      [
        fetchOwnerListingDetail(profileId, id),
        fetchListingLocationNodeId(profileId, id),
        fetchOwnerListingTaxonomyAssignment(profileId, id),
        Promise.all([
          fetchPublicCategories(),
          fetchPublicGovernorates(),
          fetchPublicSubcategories(),
          fetchPublicTaxonomyNodes(),
        ]),
      ],
    );

    if (requestId !== setupRequestIdRef.current) return;
    if (!refsResult[0].ok) {
      setLoading(false);
      setSetupError(refsResult[0].error);
      return;
    }
    if (!refsResult[1].ok) {
      setLoading(false);
      setSetupError(refsResult[1].error);
      return;
    }
    if (!refsResult[2].ok) {
      setLoading(false);
      setSetupError(refsResult[2].error);
      return;
    }
    if (!listingResult.ok) {
      setLoading(false);
      setSetupError(listingResult.error);
      return;
    }

    const loadedListing = listingResult.data;
    const loadedCategories = refsResult[0].data;
    const loadedTaxonomyNodes = refsResult[3].ok ? refsResult[3].data : [];
    const legacyTaxonomyNodeId = readDetailString(loadedListing.details, "_taxonomy_node_id");
    const fallbackTaxonomyNodeId = legacyTaxonomyNodeId;
    const canonicalOrFallbackTaxonomyNodeId = taxonomyAssignmentResult.ok
      ? (taxonomyAssignmentResult.data?.taxonomyNodeId ?? fallbackTaxonomyNodeId)
      : fallbackTaxonomyNodeId;
    const canonicalTaxonomyNodeId = taxonomyAssignmentResult.ok
      ? (taxonomyAssignmentResult.data?.taxonomyNodeId ?? "")
      : "";
    const hydratedTaxonomyNodeId = refsResult[3].ok
      ? resolveHydratedTaxonomyNodeId({
          taxonomyNodes: loadedTaxonomyNodes,
          canonicalTaxonomyNodeId,
          legacyTaxonomyNodeId,
          categoryId: loadedListing.categoryId,
          subcategoryId: loadedListing.subcategoryId,
        })
      : canonicalOrFallbackTaxonomyNodeId;
    const loadedLocationNodeId = locationResult.ok ? (locationResult.data ?? "") : "";
    let loadedLocationNodeType: LocationNodeType | "" = "";
    if (loadedLocationNodeId) {
      const pathResult = await fetchLocationPath(loadedLocationNodeId);
      if (requestId !== setupRequestIdRef.current) return;
      if (pathResult.ok) {
        loadedLocationNodeType = pathResult.data.at(-1)?.nodeType ?? "";
      }
    }
    const loadedContact =
      Object.keys(loadedListing.contactOptions || {}).length > 0
        ? {
            phone: Boolean(loadedListing.contactOptions.phone),
            whatsapp: Boolean(loadedListing.contactOptions.whatsapp),
          }
        : { phone: true, whatsapp: false };
    const loadedCategoryDetails = readCategoryDetails(loadedListing.details);
    const loadedCategory = loadedCategories.find((item) => item.id === loadedListing.categoryId);
    const loadedTaxonomyNode = loadedTaxonomyNodes.find(
      (item) => item.id === hydratedTaxonomyNodeId,
    );
    const loadedKind = resolveCategoryFieldKind(loadedTaxonomyNode, loadedCategory, loadedListing);
    const loadedValues: EditListingFormValues = {
      categoryId: loadedListing.categoryId,
      subcategoryId: loadedListing.subcategoryId,
      taxonomyNodeId: hydratedTaxonomyNodeId,
      governorateId: loadedListing.governorateId,
      title: loadedListing.title,
      description: loadedListing.description,
      price: loadedListing.price,
      priceType: loadedListing.priceType,
      condition: loadedListing.condition,
      districtAr: loadedLocationNodeId ? `@${loadedLocationNodeId}` : loadedListing.districtAr,
      locationNodeId: loadedLocationNodeId,
      contactName: loadedListing.contactName ?? "",
      contactOptions: loadedContact,
      phone: normalizeContactValue(readDetailString(loadedListing.details, "phone")),
      whatsapp: normalizeContactValue(readDetailString(loadedListing.details, "whatsapp")),
      categoryKind: loadedKind,
      categoryDetails: loadedCategoryDetails,
    };

    setListing(loadedListing);
    setCategories(loadedCategories);
    setGovernorates(refsResult[1].data);
    setSubcategories(refsResult[2].data);
    setTaxonomyNodes(loadedTaxonomyNodes);
    setTaxonomyCompatibilityMessage(
      refsResult[3].ok
        ? null
        : text(
            "تعذر تحميل التصنيف؛ تم الحفاظ على بيانات الإعلان القديمة.",
            "Taxonomy could not be loaded; the listing's existing data was preserved.",
          ),
    );
    setTaxonomyNodeId(hydratedTaxonomyNodeId);
    setTaxonomyNavigationNodeId(hydratedTaxonomyNodeId);
    taxonomyNodeIdRef.current = hydratedTaxonomyNodeId;
    taxonomyAssignmentBaseRef.current = canonicalTaxonomyNodeId || legacyTaxonomyNodeId;
    taxonomyAssignmentRequiredRef.current = false;
    setTitle(loadedValues.title);
    setDescription(loadedValues.description);
    setCategoryId(loadedValues.categoryId);
    setSubcategoryId(loadedValues.subcategoryId);
    setGovernorateId(loadedValues.governorateId);
    setDistrict(loadedListing.districtAr ?? "");
    setLocationNodeId(loadedValues.locationNodeId);
    setLocationNodeType(loadedLocationNodeType);
    setPrice(loadedValues.price?.toString() ?? "");
    setPriceType(loadedValues.priceType);
    setCondition(loadedValues.condition);
    setContactName(loadedValues.contactName);
    setPhone(loadedValues.phone);
    setWhatsapp(loadedValues.whatsapp);
    setCategoryDetails(loadedValues.categoryDetails);
    setContact(loadedValues.contactOptions);
    initialSnapshotRef.current = {
      ...loadedValues,
      details: { ...loadedListing.details },
    };
    setLoading(false);
  }, [auth.profile?.id, auth.status, id, text]);

  useEffect(() => {
    setupRequestIdRef.current += 1;
    setListing(null);
    setSetupError(null);
    void loadSetup();
    return () => {
      setupRequestIdRef.current += 1;
    };
  }, [loadSetup]);

  useEffect(() => {
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

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(
    () => () => {
      selectedImagesRef.current.forEach((entry) => URL.revokeObjectURL(entry.url));
    },
    [],
  );

  const loadImages = useCallback(async () => {
    if (!auth.profile?.id) return;
    const requestId = ++imagesRequestIdRef.current;
    setImagesLoading(true);
    setImagesError(null);
    const result = await fetchListingImages(id);
    if (requestId !== imagesRequestIdRef.current) return;
    setImagesLoading(false);
    if (!result.ok) {
      setImagesError(result.error.message);
      return;
    }
    imagesRef.current = result.data;
    setImages(result.data);
  }, [auth.profile?.id, id]);

  const refreshListingAfterMediaMutation = useCallback(async () => {
    if (!auth.profile?.id) return null;
    const result = await fetchOwnerListingDetail(auth.profile.id, id);
    if (!result.ok) {
      setUploadError(result.error.message);
      return null;
    }
    setListing(result.data);
    return result.data;
  }, [auth.profile?.id, id]);

  function captureCurrentFormValues(): EditListingFormValues {
    return {
      categoryId,
      subcategoryId,
      taxonomyNodeId: taxonomyNodeIdRef.current,
      governorateId,
      title: title.trim(),
      description: description.trim(),
      price: price.trim() === "" ? null : Number(price),
      priceType,
      condition,
      districtAr: locationNodeId ? `@${locationNodeId}` : district.trim() || null,
      locationNodeId,
      contactName: contactName.trim(),
      contactOptions: { ...contact },
      phone: normalizeContactValue(phone),
      whatsapp: normalizeContactValue(whatsapp),
      categoryKind: categoryFieldKind,
      categoryDetails: { ...categoryDetails },
    };
  }

  function handleTaxonomySelection(node: TaxonomyNode, path: TaxonomyNode[]) {
    setTaxonomyNavigationNodeId(node.id);
    if (!isEditable || !node.isLeaf) return;

    const previousKind = categoryFieldKind;
    const search = resolveTaxonomyListingSearch(node, path);
    const nextCategoryId = search.category ?? categoryId;
    const nextCategory = categories.find((item) => item.id === nextCategoryId);
    const nextKind = resolveCategoryFieldKind(node, nextCategory, listing);

    taxonomyNodeIdRef.current = node.id;
    taxonomyAssignmentRequiredRef.current = node.id !== taxonomyAssignmentBaseRef.current;
    setDynamicSchema(null);
    setDynamicValues({});
    setDynamicFieldErrors({});
    setDynamicSchemaError(null);
    setTaxonomyNodeId(node.id);
    setCategoryId(nextCategoryId);
    setSubcategoryId(search.taxonomyLegacySubcategoryId ?? null);
    if (previousKind !== nextKind) {
      setCategoryDetails((current) => sanitizeCategoryDetails(nextKind, current));
    }
    if (!categoryUsesGlobalCondition(nextKind)) setCondition("not_applicable");
  }

  function handleLegacyCategorySelection(nextCategoryId: string) {
    const previousKind = categoryFieldKind;
    const nextCategory = categories.find((item) => item.id === nextCategoryId);
    const nextKind = resolveCategoryFieldKind(undefined, nextCategory, listing);
    setDynamicSchema(null);
    setDynamicValues({});
    setDynamicFieldErrors({});
    setDynamicSchemaError(null);
    setCategoryId(nextCategoryId);
    setSubcategoryId(null);
    if (previousKind !== nextKind) {
      setCategoryDetails((current) => sanitizeCategoryDetails(nextKind, current));
    }
    if (!categoryUsesGlobalCondition(nextKind)) setCondition("not_applicable");
  }

  function handleDynamicValuesChange(nextValues: DynamicListingValues) {
    setDynamicValues(nextValues);
    setDynamicFieldErrors({});
    if (!dynamicSchemaUsesListingCondition) return;
    const nextCondition = dynamicListingCondition(nextValues.listing_condition);
    if (nextCondition !== condition) setCondition(nextCondition);
  }

  async function persistCapturedChanges(
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
    const needsApprovedDraftTransition =
      listing.status === "approved" && (hasChangedFields || taxonomyChanged || attributesChanged);
    let savedListing = listing;
    let completeness: ListingAttributeCompleteness | undefined;

    if (hasChangedFields || needsApprovedDraftTransition) {
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

  const handleSave = useCallback(async () => {
    if (!listing || !isEditable || saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    setSaving(true);
    setSavingError(null);
    setSavingSuccess(null);
    try {
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
        taxonomyNodes,
        existingDetails: initialSnapshotRef.current?.details ?? listing.details,
        requireComplete: false,
        requiresPreciseLocation,
        preciseLocationSelected,
        text,
      });
      if (!validation.ok) {
        setSavingError(validation.message);
        return;
      }

      const result = await persistCapturedChanges(captured, validation.contentFlags);
      if (!result.ok) {
        setSavingError(
          result.taxonomyFailure
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
        );
        return;
      }
      if (!result.changed) {
        setSavingSuccess(text("لا توجد تغييرات للحفظ.", "No changes to save."));
        return;
      }
      setSavingSuccess(
        listing.status === "draft"
          ? text(
              "تم حفظ التعديلات. الإعلان ما زال مسودة.",
              "Changes saved. The listing is still a draft.",
            )
          : text("تم حفظ التعديلات.", "Changes saved."),
      );
    } catch (error) {
      setSavingError(
        error instanceof Error
          ? error.message
          : text("تعذر حفظ التعديلات. حاول مرة أخرى.", "Could not save changes. Try again."),
      );
    } finally {
      setSaving(false);
      saveInFlightRef.current = false;
    }
  }, [
    listing,
    isEditable,
    taxonomyNodes,
    requiresPreciseLocation,
    preciseLocationSelected,
    text,
    categoryId,
    subcategoryId,
    governorateId,
    title,
    description,
    price,
    priceType,
    condition,
    district,
    locationNodeId,
    contactName,
    contact,
    phone,
    whatsapp,
    categoryFieldKind,
    categoryDetails,
  ]);

  const handleResubmit = useCallback(async () => {
    if (!listing || !isResubmittable || resubmitInFlightRef.current) return;
    resubmitInFlightRef.current = true;
    setResubmitting(true);
    setSavingError(null);
    setSavingSuccess(null);
    try {
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
        taxonomyNodes,
        existingDetails: initialSnapshotRef.current?.details ?? listing.details,
        requireComplete: true,
        requiresPreciseLocation,
        preciseLocationSelected,
        text,
      });
      if (!validation.ok) {
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
        if (dynamicValidation.summary.length > 0) {
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
      if (!saveResult.ok) {
        setSavingError(
          saveResult.taxonomyFailure
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
        );
        return;
      }

      if (saveResult.completeness && !saveResult.completeness.complete) {
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
        auth.profile?.id ?? null,
        saveResult.listing.id,
      );
      if (!submitResult.ok) {
        setListing(saveResult.listing);
        setSavingError(submitResult.error.message);
        return;
      }
      setListing(submitResult.data);
      setSavingSuccess(text("تم إعادة إرسال الإعلان للمراجعة.", "Listing resubmitted for review."));
    } catch (error) {
      setSavingError(
        error instanceof Error
          ? error.message
          : text(
              "تعذر إعادة إرسال الإعلان للمراجعة. حاول مرة أخرى.",
              "Could not resubmit the listing for review. Try again.",
            ),
      );
    } finally {
      setResubmitting(false);
      resubmitInFlightRef.current = false;
    }
  }, [
    listing,
    isResubmittable,
    auth.profile?.id,
    taxonomyNodes,
    requiresPreciseLocation,
    preciseLocationSelected,
    text,
    categoryId,
    subcategoryId,
    governorateId,
    title,
    description,
    price,
    priceType,
    condition,
    district,
    locationNodeId,
    contactName,
    contact,
    phone,
    whatsapp,
    categoryFieldKind,
    categoryDetails,
  ]);

  const handleDelete = useCallback(async () => {
    if (!listing || !isDeletable || deleteInFlightRef.current) return;
    if (!confirm(text("حذف الإعلان نهائياً؟", "Delete this listing permanently?"))) return;

    deleteInFlightRef.current = true;
    setDeleting(true);
    setSavingError(null);
    try {
      const result = await deleteOwnerListing(auth.profile?.id ?? null, listing.id);
      if (!result.ok) {
        setSavingError(result.error.message);
        return;
      }
      await navigate({ to: "/profile" });
    } catch (error) {
      setSavingError(
        error instanceof Error
          ? error.message
          : text("تعذر حذف الإعلان. حاول مرة أخرى.", "Could not delete the listing. Try again."),
      );
    } finally {
      deleteInFlightRef.current = false;
      setDeleting(false);
    }
  }, [listing, isDeletable, auth.profile?.id, navigate, text]);

  useEffect(() => {
    if (!listing) return;
    void loadImages();
    return () => {
      imagesRequestIdRef.current += 1;
    };
  }, [listing, loadImages]);

  useEffect(() => {
    if (!saving) saveInFlightRef.current = false;
  }, [saving]);

  useEffect(() => {
    if (!resubmitting) resubmitInFlightRef.current = false;
  }, [resubmitting]);

  useEffect(() => {
    if (!deleting) deleteInFlightRef.current = false;
  }, [deleting]);

  useEffect(() => {
    if (!uploading) uploadAllInFlightRef.current = false;
  }, [uploading]);

  function handleImageSelection(files: FileList | null) {
    const nextFiles = Array.from(files ?? []);
    const current = selectedImagesRef.current;
    const capacity = Math.max(0, MAX_IMAGES - imagesRef.current.length - current.length);
    const existing = new Set(current.map((entry) => fileFingerprint(entry.file)));
    const unique = nextFiles
      .filter(
        (file, index, files) =>
          !existing.has(fileFingerprint(file)) &&
          files.findIndex((item) => fileFingerprint(item) === fileFingerprint(file)) === index,
      )
      .slice(0, capacity)
      .map((file) => ({
        id: `${fileFingerprint(file)}-${crypto.randomUUID()}`,
        file,
        state: "pending" as const,
        url: URL.createObjectURL(file),
      }));
    const next = [...current, ...unique];
    selectedImagesRef.current = next;
    setSelectedImages(next);
    if (imagesRef.current.length + current.length + nextFiles.length > MAX_IMAGES) {
      setUploadError(text("الحد الأقصى 6 صور للإعلان.", "A listing can have up to 6 photos."));
    } else {
      setUploadError(null);
    }
    if (unique.length > 0) queueMicrotask(() => void handleUploadImages());
  }

  function removeSelectedImage(entryId: string) {
    const entry = selectedImagesRef.current.find((item) => item.id === entryId);
    if (!entry || entry.state === "uploading") return;
    URL.revokeObjectURL(entry.url);
    const next = selectedImagesRef.current.filter((item) => item.id !== entryId);
    selectedImagesRef.current = next;
    setSelectedImages(next);
  }

  function moveSelectedPendingImage(entryId: string, direction: -1 | 1) {
    if (uploading || reorderingImages) return;
    const current = selectedImagesRef.current;
    const index = current.findIndex((item) => item.id === entryId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= current.length) return;
    const next = [...current];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    selectedImagesRef.current = next;
    setSelectedImages(next);
  }

  function clearSelectedImages() {
    selectedImagesRef.current.forEach((entry) => URL.revokeObjectURL(entry.url));
    selectedImagesRef.current = [];
    setSelectedImages([]);
    setUploadError(null);
  }

  async function uploadSelectedImage(entryId: string) {
    if (!listing) return;
    const entry = selectedImagesRef.current.find((item) => item.id === entryId);
    if (!entry || entry.state === "uploading") return;
    const uploadingEntries = selectedImagesRef.current.map((item) =>
      item.id === entryId ? { ...item, state: "uploading" as const, error: undefined } : item,
    );
    selectedImagesRef.current = uploadingEntries;
    setSelectedImages(uploadingEntries);
    const result = await uploadListingImage({
      userId: auth.profile?.id ?? null,
      listing,
      file: entry.file,
      sortOrder: imagesRef.current.length,
      altAr: title.trim() || listing.title,
    });
    const latest = selectedImagesRef.current.find((item) => item.id === entryId);
    if (!latest) return;
    if (!result.ok) {
      const failed = selectedImagesRef.current.map((item) =>
        item.id === entryId
          ? { ...item, state: "failed" as const, error: result.error.message }
          : item,
      );
      selectedImagesRef.current = failed;
      setSelectedImages(failed);
      setUploadError(result.error.message);
      return;
    }
    const nextImages = [...imagesRef.current, result.data];
    imagesRef.current = nextImages;
    setImages(nextImages);
    URL.revokeObjectURL(latest.url);
    const remaining = selectedImagesRef.current.filter((item) => item.id !== entryId);
    selectedImagesRef.current = remaining;
    setSelectedImages(remaining);
    await refreshListingAfterMediaMutation();
  }

  async function retrySelectedImage(entryId: string) {
    const retryEntries = selectedImagesRef.current.map((item) =>
      item.id === entryId ? { ...item, state: "pending" as const, error: undefined } : item,
    );
    selectedImagesRef.current = retryEntries;
    setSelectedImages(retryEntries);
    await handleUploadImages();
  }

  async function handleUploadImages() {
    if (!listing || selectedImagesRef.current.length === 0 || uploadAllInFlightRef.current) return;
    uploadAllInFlightRef.current = true;
    setUploading(true);
    setUploadError(null);
    try {
      const pendingEntries = selectedImagesRef.current.filter((entry) => entry.state === "pending");
      for (const entry of pendingEntries) {
        await uploadSelectedImage(entry.id);
      }
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : text("تعذر رفع الصور. حاول مرة أخرى.", "Could not upload photos. Try again."),
      );
    } finally {
      uploadAllInFlightRef.current = false;
      setUploading(false);
    }
  }

  async function moveExistingImage(imageId: string, direction: -1 | 1) {
    if (!listing || !isEditable || imagesLoading || uploading || imageReorderInFlightRef.current) {
      return;
    }
    const current = imagesRef.current;
    const index = current.findIndex((image) => image.id === imageId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= current.length) return;

    imageReorderInFlightRef.current = true;
    const previous = [...current];
    const next = [...current];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    imagesRef.current = next;
    setImages(next);
    setReorderingImages(true);
    setUploadError(null);

    try {
      const result = await reorderListingImages(
        auth.profile?.id ?? null,
        listing.id,
        next.map((image, sortOrder) => ({ id: image.id, sortOrder })),
      );
      if (!result.ok) {
        imagesRef.current = previous;
        setImages(previous);
        setUploadError(result.error.message);
        return;
      }
      imagesRef.current = result.data;
      setImages(result.data);
      await refreshListingAfterMediaMutation();
    } catch (error) {
      imagesRef.current = previous;
      setImages(previous);
      setUploadError(
        error instanceof Error
          ? error.message
          : text("تعذر ترتيب الصور. حاول مرة أخرى.", "Could not reorder photos. Try again."),
      );
    } finally {
      imageReorderInFlightRef.current = false;
      setReorderingImages(false);
    }
  }

  function handleDeleteImage(image: ListingImage) {
    if (!listing || imageDeleteInFlightRef.current.size > 0) return;
    const currentListing = listing;
    imageDeleteInFlightRef.current.add(image.id);
    setImagesLoading(true);
    setUploadError(null);
    void (async () => {
      try {
        const result = await deleteListingImage(auth.profile?.id ?? null, currentListing.id, image);
        if (!result.ok) {
          setUploadError(result.error.message);
          return;
        }
        const nextImages = imagesRef.current.filter((item) => item.id !== image.id);
        imagesRef.current = nextImages;
        setImages(nextImages);
        await refreshListingAfterMediaMutation();
      } catch (error) {
        setUploadError(
          error instanceof Error
            ? error.message
            : text("تعذر حذف الصورة. حاول مرة أخرى.", "Could not delete the photo. Try again."),
        );
      } finally {
        imageDeleteInFlightRef.current.delete(image.id);
        setImagesLoading(false);
      }
    })();
  }

  if (loading) {
    return (
      <>
        <PageHeader title={text("تعديل الإعلان", "Edit listing")} />
        <main className="container-wide mobile-page-bottom pt-10">
          <div className="rounded-2xl bg-card p-10 text-center text-sm text-muted-foreground hairline">
            {text("جارٍ تحميل بيانات الإعلان.", "Loading listing data.")}
          </div>
        </main>
      </>
    );
  }

  if (setupError || !listing) {
    return (
      <>
        <PageHeader title={text("تعديل الإعلان", "Edit listing")} />
        <main className="container-wide mobile-page-bottom pt-10">
          <div className="rawaj-surface rounded-[1.5rem] p-10 text-center">
            <p className="text-sm font-semibold text-foreground">
              {text("الإعلان غير متاح", "Listing unavailable")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {setupError?.message ??
                text("تعذر تحميل هذا الإعلان.", "Could not load this listing.")}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => void loadSetup()}
                className="rawaj-button-primary px-4 py-2"
              >
                {text("إعادة المحاولة", "Try again")}
              </button>
              <Link to="/profile" className="rawaj-chip px-4 py-2">
                {text("العودة لحسابي", "Back to my account")}
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <PageHeader title={text("تعديل الإعلان", "Edit listing")} back to="/profile" />
      <main className="rawaj-listing-studio-v2 rawaj-listing-studio-v3 rawaj-listing-studio-v2--manage container-wide mobile-page-bottom pb-8 pt-3 sm:pt-5">
        <ListingStudioHero
          eyebrow={text("إدارة الإعلان", "Listing management")}
          title={title || text("تعديل الإعلان", "Edit listing")}
          description={text(
            "حدّث المعلومات والصور، راقب حالة الإعلان، ثم احفظه أو أعد إرساله للمراجعة عندما يصبح جاهزاً.",
            "Update information and photos, track listing status, then save or resubmit when it is ready.",
          )}
          status={
            <>
              <span>{listingStatusLabel(listing.status, language, true)}</span>
              <span>
                {categoryName(listing.categoryId, listing.categoryNameAr ?? undefined, language)}
              </span>
            </>
          }
          actions={
            <>
              {listing.status === "approved" ? (
                <Link to="/listings/$id" params={{ id: listing.id }}>
                  {text("عرض الإعلان العام", "View public listing")}
                </Link>
              ) : null}
              <Link to="/profile/listings">{text("إعلاناتي", "My listings")}</Link>
            </>
          }
        />
        <ListingStudioTrustStrip text={text} />

        {isPendingReview && (
          <div className="mb-4">
            <ListingStudioMessage tone="warning">
              {text(
                "هذا الإعلان قيد المراجعة ولا يمكن تعديله الآن. بعد قرار الإدارة سيظهر للعامة عند الموافقة، أو يمكنك تعديل سبب الرفض ثم إعادة إرساله إذا رُفض.",
                "This listing is under review and cannot be edited now. After the admin decision it will become public if approved, or you can address the rejection and resubmit if rejected.",
              )}
            </ListingStudioMessage>
          </div>
        )}

        {listing.status === "approved" && (
          <div className="mb-4">
            <ListingStudioMessage tone="warning">
              {text(
                "عند حفظ أي تعديل أو تغيير صورة، سيتحول الإعلان إلى مسودة خاصة ويختفي مؤقتاً من الموقع. بعد الانتهاء اضغط «إعادة إرسال للمراجعة» ليعود للنشر بعد موافقة الإدارة.",
                "Saving any change or modifying a photo moves this listing to a private draft and temporarily removes it from the public site. When finished, choose “Resubmit for review” so it can be published again after approval.",
              )}
            </ListingStudioMessage>
          </div>
        )}

        {listing.status === "draft" && (
          <div className="mb-4">
            <ListingStudioMessage tone="warning">
              {text(
                "حفظ التعديلات يبقي الإعلان كمسودة خاصة ولا يرسله للمراجعة. عند اكتمال المعلومات اضغط «إعادة إرسال للمراجعة»؛ بعدها يتوقف التعديل حتى قرار الإدارة.",
                "Saving changes keeps this listing as a private draft and does not submit it for review. When ready, choose “Resubmit for review”; editing then pauses until the admin decision.",
              )}
            </ListingStudioMessage>
          </div>
        )}

        {listing.status === "rejected" && (
          <div className="mb-4">
            <ListingStudioMessage tone="warning">
              {text(
                "تعديل الإعلان المرفوض لا يعيده تلقائياً للمراجعة. أصلح سبب الرفض، احفظ تعديلاتك عند الحاجة، ثم اضغط «إعادة إرسال للمراجعة» عندما يصبح جاهزاً.",
                "Editing a rejected listing does not automatically resubmit it. Fix the rejection reason, save changes as needed, then choose “Resubmit for review” when ready.",
              )}
            </ListingStudioMessage>
          </div>
        )}

        {listing.rejectionReason && (
          <div className="mb-4">
            <ListingStudioMessage tone="danger">{listing.rejectionReason}</ListingStudioMessage>
          </div>
        )}

        {savingSuccess && (
          <div className="mb-4">
            <ListingStudioMessage tone="success">{savingSuccess}</ListingStudioMessage>
          </div>
        )}
        {savingError && (
          <div className="mb-4">
            <ListingStudioMessage tone="danger">{savingError}</ListingStudioMessage>
          </div>
        )}
        {taxonomyCompatibilityMessage && (
          <div className="mb-4">
            <ListingStudioMessage tone="warning">
              {taxonomyCompatibilityMessage}
            </ListingStudioMessage>
          </div>
        )}
        {imagesError && (
          <div className="mb-4">
            <ListingStudioMessage tone="danger">
              <span>{imagesError}</span>{" "}
              <button type="button" onClick={() => void loadImages()} className="underline">
                {text("إعادة تحميل الصور", "Retry photos")}
              </button>
            </ListingStudioMessage>
          </div>
        )}

        <div className="rawaj-studio-shell" data-mode="manage">
          <div className="rawaj-studio-shell__content">
            <ListingStudioSection title={text("ماذا تبيع؟", "What are you selling?")}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={text("عنوان الإعلان", "Listing title")}>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="input"
                    disabled={!isEditable}
                  />
                </Field>
                {showGlobalCondition && (
                  <Field label={text("الحالة", "Condition")}>
                    <select
                      value={condition}
                      onChange={(e) => setCondition(e.target.value as ListingCondition)}
                      className="input"
                      disabled={!isEditable}
                    >
                      <option value="not_applicable">{text("غير محدد", "Not specified")}</option>
                      <option value="new">{text("جديد", "New")}</option>
                      <option value="like_new">{text("شبه جديد", "Like new")}</option>
                      <option value="used">{text("مستعمل", "Used")}</option>
                      <option value="for_parts">{text("للقطع", "For parts")}</option>
                    </select>
                  </Field>
                )}
              </div>
              <Field label={text("الوصف", "Description")} className="mt-3">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="input resize-none"
                  disabled={!isEditable}
                />
              </Field>
              {dynamicSchemaLoading ? (
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
                      setCondition(legacyCategoryCondition(categoryFieldKind, nextDetails));
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
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={text("السعر", "Price")}>
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    type="number"
                    className="input"
                    disabled={!isEditable}
                  />
                </Field>
                <Field label={text("نوع السعر", "Price type")}>
                  <select
                    value={priceType}
                    onChange={(e) => setPriceType(e.target.value as PriceType)}
                    className="input"
                    disabled={!isEditable}
                  >
                    <option value="fixed">{text("ثابت", "Fixed")}</option>
                    <option value="negotiable">{text("قابل للتفاوض", "Negotiable")}</option>
                    <option value="contact">{text("عند التواصل", "On contact")}</option>
                    <option value="free">{text("مجاني", "Free")}</option>
                    <option value="exchange">{text("للمبادلة", "Exchange")}</option>
                  </select>
                </Field>
              </div>
            </ListingStudioSection>

            <ListingStudioSection title={text("القسم والموقع", "Category and location")}>
              {taxonomyNodes.length > 0 ? (
                <div className={!isEditable ? "pointer-events-none opacity-70" : ""}>
                  <ListingTaxonomySelector
                    nodes={taxonomyNodes}
                    selectedNodeId={taxonomyNavigationNodeId}
                    language={language}
                    text={text}
                    onSelect={handleTaxonomySelection}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label={text("القسم", "Category")}>
                    <select
                      value={categoryId}
                      onChange={(e) => handleLegacyCategorySelection(e.target.value)}
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
                </div>
              )}
              <div className="mt-3">
                <Field label={text("الموقع", "Location")}>
                  <CanonicalLocationSelector
                    value={locationNodeId || null}
                    disabled={!isEditable}
                    onChange={(id, node) => {
                      setLocationNodeId(id ?? "");
                      setLocationNodeType(node?.nodeType ?? "");
                      if (node?.legacyGovernorateId) {
                        setGovernorateId(node.legacyGovernorateId);
                      }
                      setDistrict(node?.legacyDistrictAr ?? "");
                    }}
                  />
                </Field>
                {!locationNodeId && district ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {text("الموقع القديم المحفوظ: ", "Saved legacy location: ")}
                    {district}
                  </p>
                ) : null}
              </div>
            </ListingStudioSection>

            <ListingStudioSection title={text("التواصل", "Contact")}>
              <Field label={text("اسم التواصل", "Contact name")}>
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="input"
                  disabled={!isEditable}
                />
              </Field>
              {contact.phone && (
                <Field label={text("رقم الهاتف", "Phone number")}>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                    autoComplete="tel"
                    className="input"
                    disabled={!isEditable}
                    placeholder="+963 ..."
                  />
                </Field>
              )}
              {contact.whatsapp && (
                <Field label={text("رقم واتساب", "WhatsApp number")}>
                  <input
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    inputMode="tel"
                    autoComplete="tel"
                    className="input"
                    disabled={!isEditable}
                    placeholder="+963 ..."
                  />
                </Field>
              )}
              <div className="mt-3 space-y-2">
                {[
                  { key: "phone" as const, label: text("اتصال هاتفي", "Phone call") },
                  { key: "whatsapp" as const, label: text("واتساب", "WhatsApp") },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between rounded-[1rem] border border-border/70 bg-card/80 p-3.5 transition hover:border-gold/35"
                  >
                    <div>
                      <div className="text-sm font-semibold">{item.label}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {text(
                          "تُستخدم وفق إعدادات الخصوصية والمراجعة.",
                          "Used according to privacy and review settings.",
                        )}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={contact[item.key]}
                      onChange={(e) =>
                        setContact((value) => {
                          if (item.key === "phone" && !e.target.checked) setPhone("");
                          if (item.key === "whatsapp" && !e.target.checked) setWhatsapp("");
                          return { ...value, [item.key]: e.target.checked };
                        })
                      }
                      disabled={!isEditable}
                      className="h-4 w-4 accent-primary"
                    />
                  </label>
                ))}
              </div>
            </ListingStudioSection>

            <ListingStudioSection title={text("الصور والتفاصيل", "Photos and details")}>
              <div className="rawaj-studio-media-grid">
                {images.map((image, index) => (
                  <div key={image.id} className="rawaj-studio-media-card p-1">
                    {image.publicUrl ? (
                      <img
                        src={image.publicUrl}
                        alt={image.altAr ?? listing.title}
                        loading="lazy"
                        decoding="async"
                        className="aspect-[4/3] w-full rounded-lg object-cover"
                      />
                    ) : (
                      <div className="aspect-[4/3] w-full rounded-lg bg-card" />
                    )}
                    {index === 0 && (
                      <span className="absolute start-2 top-2 rounded-full bg-primary/90 px-2.5 py-1 text-[9px] font-semibold text-primary-foreground shadow-soft backdrop-blur">
                        {text("الصورة الرئيسية", "Primary")}
                      </span>
                    )}
                    {isEditable && images.length > 1 && (
                      <div className="mt-1 grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          disabled={index === 0 || imagesLoading || uploading || reorderingImages}
                          onClick={() => void moveExistingImage(image.id, -1)}
                          className="rawaj-chip min-h-9 justify-center px-2 disabled:opacity-35"
                          aria-label={text("تحريك الصورة للأمام", "Move photo earlier")}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={
                            index === images.length - 1 ||
                            imagesLoading ||
                            uploading ||
                            reorderingImages
                          }
                          onClick={() => void moveExistingImage(image.id, 1)}
                          className="rawaj-chip min-h-9 justify-center px-2 disabled:opacity-35"
                          aria-label={text("تحريك الصورة للخلف", "Move photo later")}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    {isEditable && (
                      <button
                        type="button"
                        disabled={imagesLoading || uploading || reorderingImages}
                        onClick={() => handleDeleteImage(image)}
                        className="absolute end-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-card/90 text-destructive shadow-soft backdrop-blur transition hover:bg-destructive hover:text-destructive-foreground"
                        aria-label={text("حذف الصورة", "Delete photo")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {isEditable && (
                  <label className="rawaj-studio-media-picker min-h-[9rem]">
                    <Camera className="h-6 w-6" />
                    <span className="mt-1 text-[10px] font-bold">
                      {text("إضافة صور", "Add photos")}
                    </span>
                    <span className="text-[9px]">
                      {text("JPG · PNG · WebP · 5MB", "JPG · PNG · WebP · 5MB")}
                    </span>
                    <input
                      type="file"
                      multiple
                      disabled={uploading || imagesLoading}
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(e) => {
                        handleImageSelection(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
              {selectedImages.length > 0 && (
                <div className="mt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold">
                      {text("صور مختارة", "Selected photos")} ({selectedImages.length})
                    </p>
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={clearSelectedImages}
                      className="rawaj-chip px-3 py-1.5 font-semibold text-muted-foreground disabled:opacity-50"
                    >
                      {text("تفريغ الاختيار", "Clear selection")}
                    </button>
                  </div>
                  <div className="rawaj-studio-media-grid mt-2">
                    {selectedImages.map((preview, index) => (
                      <div
                        key={preview.id}
                        className="overflow-hidden rounded-[1rem] border border-border/70 bg-card text-[10px] shadow-soft"
                      >
                        <div className="relative">
                          <img
                            src={preview.url}
                            alt={preview.file.name}
                            loading="lazy"
                            decoding="async"
                            className="aspect-[4/3] w-full object-cover"
                          />
                          <button
                            type="button"
                            disabled={preview.state === "uploading"}
                            onClick={() => removeSelectedImage(preview.id)}
                            className="absolute end-2 top-2 grid min-h-11 min-w-11 place-items-center rounded-xl bg-card/90 text-destructive shadow-soft disabled:opacity-50"
                            aria-label={text("إزالة الصورة المختارة", "Remove selected photo")}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="p-2">
                          <div className="mb-2 flex gap-1">
                            <button
                              type="button"
                              disabled={index === 0 || uploading || preview.state === "uploading"}
                              onClick={() => moveSelectedPendingImage(preview.id, -1)}
                              className="rawaj-icon-button h-8 w-8 disabled:opacity-35"
                              aria-label={text("تحريك الصورة للأمام", "Move photo earlier")}
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={
                                index === selectedImages.length - 1 ||
                                uploading ||
                                preview.state === "uploading"
                              }
                              onClick={() => moveSelectedPendingImage(preview.id, 1)}
                              className="rawaj-icon-button h-8 w-8 disabled:opacity-35"
                              aria-label={text("تحريك الصورة للخلف", "Move photo later")}
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <p className="truncate font-bold">{preview.file.name}</p>
                          <p className="text-muted-foreground">
                            {(preview.file.size / 1024 / 1024).toFixed(1)} MB
                          </p>
                          {preview.state === "uploading" ? (
                            <p className="mt-1 font-bold text-primary">
                              {text("جارٍ رفع هذه الصورة", "Uploading this photo")}
                            </p>
                          ) : null}
                          {preview.state === "failed" ? (
                            <div className="mt-2">
                              <p className="line-clamp-2 text-destructive">{preview.error}</p>
                              <button
                                type="button"
                                onClick={() => void retrySelectedImage(preview.id)}
                                className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-xl bg-destructive/10 px-3 py-2 font-bold text-destructive"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                                {text("إعادة المحاولة", "Retry")}
                              </button>
                            </div>
                          ) : null}
                          {index === 0 && preview.state === "pending" ? (
                            <p className="mt-1 font-bold text-gold">
                              {text("سيتم رفعها تلقائياً", "Uploading automatically")}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      disabled={uploading || imagesLoading}
                      onClick={handleUploadImages}
                      className="rawaj-button-primary rounded-[0.9rem] px-3 py-2 text-[10px] disabled:opacity-50"
                    >
                      {uploading
                        ? text("جارٍ الرفع...", "Uploading...")
                        : text("رفع الصور", "Upload photos")}
                    </button>
                  </div>
                </div>
              )}
              {uploadError && (
                <div className="mt-2">
                  <ListingStudioMessage tone="danger">{uploadError}</ListingStudioMessage>
                </div>
              )}
            </ListingStudioSection>
          </div>

          <aside className="rawaj-studio-shell__aside">
            <ListingStudioCompletionCard
              score={studioScore}
              ready={quality.ready}
              title={
                isEditable
                  ? text("راجع التعديلات قبل الحفظ", "Review changes before saving")
                  : text("الإعلان للعرض فقط الآن", "Listing is view-only right now")
              }
              body={
                isEditable
                  ? text(
                      "المعاينة تتحدث مع بيانات الإعلان.",
                      "The preview updates with listing data.",
                    )
                  : text(
                      "حالة الإعلان الحالية تمنع التعديل.",
                      "The current status prevents editing.",
                    )
              }
              text={text}
            />
            <ListingStudioPreview
              imageUrl={images[0]?.publicUrl ?? selectedImages[0]?.url}
              title={title}
              category={category ? categoryName(category.id, category.nameAr, language) : ""}
              price={
                priceType === "free"
                  ? text("مجاني", "Free")
                  : priceType === "contact"
                    ? text("عند التواصل", "On contact")
                    : price
                      ? `${price} SYP`
                      : ""
              }
              location={
                district ||
                (governorate ? governorateName(governorate.id, governorate.nameAr, language) : "")
              }
              imageCount={images.length + selectedImages.length}
              text={text}
            />
            <ListingStudioQualityPanel
              score={studioScore}
              checks={quality.checks.map((check) => ({
                label: listingQualityCheckLabel(check.key, text),
                done: check.done,
              }))}
              text={text}
            />
            <ListingStudioSection title={text("إجراءات", "Actions")}>
              <div className="space-y-2">
                {isEditable && (
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      disabled={saving || uploading || selectedImages.length > 0}
                      onClick={handleSave}
                      className="w-full rounded-[1rem] bg-emerald-trust px-3 py-3 text-xs font-semibold text-emerald-trust-foreground shadow-soft transition hover:brightness-[0.98] disabled:opacity-50"
                    >
                      {saving
                        ? text("جارٍ الحفظ...", "Saving...")
                        : text("حفظ التعديلات", "Save changes")}
                    </button>
                    <p className="px-1 text-[10px] leading-4 text-muted-foreground">
                      {text(
                        "يحفظ فقط؛ لا يرسل الإعلان للمراجعة.",
                        "Saves only; does not submit the listing for review.",
                      )}
                    </p>
                  </div>
                )}
                {isResubmittable && (
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      disabled={resubmitting || uploading || selectedImages.length > 0}
                      onClick={handleResubmit}
                      className="rawaj-button-primary w-full rounded-[1rem] px-3 py-3 disabled:opacity-50"
                    >
                      {resubmitting
                        ? text("جارٍ الإرسال...", "Submitting...")
                        : text("إعادة إرسال للمراجعة", "Resubmit for review")}
                    </button>
                    <p className="px-1 text-[10px] leading-4 text-muted-foreground">
                      {text(
                        "ينقل الإعلان إلى قيد المراجعة ويوقف التعديل حتى القرار.",
                        "Moves the listing into review and pauses editing until a decision.",
                      )}
                    </p>
                  </div>
                )}
                {isDeletable && (
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={handleDelete}
                    className="w-full rounded-[1rem] border border-destructive/15 bg-card/80 px-3 py-3 text-xs font-semibold text-destructive transition hover:bg-destructive/5 disabled:opacity-50"
                  >
                    {deleting
                      ? text("جارٍ الحذف...", "Deleting...")
                      : text("حذف الإعلان", "Delete listing")}
                  </button>
                )}
                {listing.status === "approved" && (
                  <p className="rounded-[1rem] border border-border/65 bg-card-warm/65 p-3.5 text-[11px] leading-5 text-muted-foreground">
                    {text(
                      "لا يمكن تعديل إعلان معتمد حالياً.",
                      "Approved listings cannot be edited currently.",
                    )}
                  </p>
                )}
              </div>
            </ListingStudioSection>
            <ListingStudioSection title={text("معلومات", "Info")}>
              <dl className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{text("رقم الإعلان", "Listing ID")}</dt>
                  <dd className="font-mono font-semibold">{listing.id}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{text("أنشئ", "Created")}</dt>
                  <dd className="font-semibold">
                    {new Date(listing.createdAt).toLocaleDateString(
                      language === "ar" ? "ar-SY" : "en-US",
                      {
                        dateStyle: "short",
                      },
                    )}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{text("محدث", "Updated")}</dt>
                  <dd className="font-semibold">
                    {new Date(listing.updatedAt).toLocaleDateString(
                      language === "ar" ? "ar-SY" : "en-US",
                      {
                        dateStyle: "short",
                      },
                    )}
                  </dd>
                </div>
              </dl>
            </ListingStudioSection>
          </aside>
        </div>
      </main>
      <style>{`.input{width:100%;min-height:2.75rem;border-radius:1rem;background:color-mix(in srgb,var(--card) 88%,transparent);border:1px solid var(--border);padding:.68rem .8rem;font-size:.875rem;color:var(--foreground);outline:none;transition:border-color .18s ease,box-shadow .18s ease,background .18s ease}.input:focus{border-color:var(--brand-orange);background:var(--card);box-shadow:0 0 0 3px color-mix(in srgb,var(--brand-orange) 12%,transparent)}.input:disabled{opacity:.62;cursor:not-allowed}`}</style>
    </>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`mb-3 block ${className ?? ""}`}>
      <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function CategorySpecificFields({
  kind,
  values,
  disabled,
  onChange,
  text,
}: {
  kind: CategoryFieldKind;
  values: CategorySpecificDetails;
  disabled: boolean;
  onChange: (value: CategorySpecificDetails) => void;
  text: (ar: string, en: string) => string;
}) {
  const patch = (next: Partial<CategorySpecificDetails>) => onChange({ ...values, ...next });

  if (kind === "real_estate") {
    return (
      <div className="mt-4 rounded-[1.15rem] border border-border/60 bg-card-warm/65 p-3.5">
        <h4 className="mb-3 text-xs font-semibold text-primary">
          {text("تفاصيل العقار", "Real estate details")}
        </h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={text("نوع العقار", "Property type")}>
            <select
              disabled={disabled}
              value={values.property_type ?? ""}
              onChange={(event) => patch({ property_type: event.target.value || undefined })}
              className="input"
            >
              <option value="">{text("اختياري", "Optional")}</option>
              <option value="apartment">{text("شقة", "Apartment")}</option>
              <option value="house">{text("منزل", "House")}</option>
              <option value="villa">{text("فيلا", "Villa")}</option>
              <option value="land">{text("أرض", "Land")}</option>
              <option value="shop">{text("محل", "Shop")}</option>
              <option value="office">{text("مكتب", "Office")}</option>
              <option value="warehouse">{text("مستودع", "Warehouse")}</option>
              <option value="other">{text("أخرى", "Other")}</option>
            </select>
          </Field>
          <Field label={text("الغرض", "Purpose")}>
            <select
              disabled={disabled}
              value={values.listing_purpose ?? ""}
              onChange={(event) => patch({ listing_purpose: event.target.value || undefined })}
              className="input"
            >
              <option value="">{text("اختياري", "Optional")}</option>
              <option value="sale">{text("بيع", "Sale")}</option>
              <option value="rent">{text("إيجار", "Rent")}</option>
            </select>
          </Field>
          <NumberField
            label={text("غرف النوم", "Bedrooms")}
            value={values.bedrooms}
            disabled={disabled}
            onChange={(bedrooms) => patch({ bedrooms })}
            min={0}
            max={30}
          />
          <NumberField
            label={text("الحمامات", "Bathrooms")}
            value={values.bathrooms}
            disabled={disabled}
            onChange={(bathrooms) => patch({ bathrooms })}
            min={0}
            max={30}
          />
          <NumberField
            label={text("المساحة م²", "Area sqm")}
            value={values.area_sqm}
            disabled={disabled}
            onChange={(area_sqm) => patch({ area_sqm })}
            min={1}
            max={100000}
          />
          <NumberField
            label={text("الطابق", "Floor")}
            value={values.floor}
            disabled={disabled}
            onChange={(floor) => patch({ floor })}
            min={-5}
            max={200}
          />
          <CheckboxField
            label={text("مفروش", "Furnished")}
            checked={values.furnished ?? false}
            disabled={disabled}
            onChange={(furnished) => patch({ furnished })}
          />
          <CheckboxField
            label={text("موقف سيارة", "Parking")}
            checked={values.parking ?? false}
            disabled={disabled}
            onChange={(parking) => patch({ parking })}
          />
        </div>
      </div>
    );
  }

  if (kind === "vehicles") {
    return (
      <div className="mt-4 rounded-[1.15rem] border border-border/60 bg-card-warm/65 p-3.5">
        <h4 className="mb-3 text-xs font-semibold text-primary">
          {text("تفاصيل السيارة", "Vehicle details")}
        </h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={text("الشركة", "Make")}>
            <input
              disabled={disabled}
              value={values.make ?? ""}
              onChange={(event) => patch({ make: event.target.value })}
              maxLength={60}
              className="input"
            />
          </Field>
          <Field label={text("الطراز", "Model")}>
            <input
              disabled={disabled}
              value={values.model ?? ""}
              onChange={(event) => patch({ model: event.target.value })}
              maxLength={60}
              className="input"
            />
          </Field>
          <NumberField
            label={text("السنة", "Year")}
            value={values.year}
            disabled={disabled}
            onChange={(year) => patch({ year })}
            min={1900}
            max={new Date().getFullYear() + 1}
          />
          <NumberField
            label={text("المسافة كم", "Mileage km")}
            value={values.mileage_km}
            disabled={disabled}
            onChange={(mileage_km) => patch({ mileage_km })}
            min={0}
            max={2000000}
          />
          <Field label={text("الوقود", "Fuel")}>
            <select
              disabled={disabled}
              value={values.fuel_type ?? ""}
              onChange={(event) => patch({ fuel_type: event.target.value || undefined })}
              className="input"
            >
              <option value="">{text("اختياري", "Optional")}</option>
              <option value="gasoline">{text("بنزين", "Gasoline")}</option>
              <option value="diesel">{text("ديزل", "Diesel")}</option>
              <option value="hybrid">{text("هايبرد", "Hybrid")}</option>
              <option value="electric">{text("كهرباء", "Electric")}</option>
              <option value="other">{text("أخرى", "Other")}</option>
            </select>
          </Field>
          <Field label={text("ناقل الحركة", "Transmission")}>
            <select
              disabled={disabled}
              value={values.transmission ?? ""}
              onChange={(event) => patch({ transmission: event.target.value || undefined })}
              className="input"
            >
              <option value="">{text("اختياري", "Optional")}</option>
              <option value="automatic">{text("أوتوماتيك", "Automatic")}</option>
              <option value="manual">{text("يدوي", "Manual")}</option>
            </select>
          </Field>
          <Field label={text("حالة السيارة", "Vehicle condition")}>
            <select
              disabled={disabled}
              value={values.vehicle_condition ?? ""}
              onChange={(event) => patch({ vehicle_condition: event.target.value || undefined })}
              className="input"
            >
              <option value="">{text("اختياري", "Optional")}</option>
              <option value="new">{text("جديدة", "New")}</option>
              <option value="used">{text("مستعملة", "Used")}</option>
            </select>
          </Field>
          <Field label={text("اللون", "Color")}>
            <input
              disabled={disabled}
              value={values.color ?? ""}
              onChange={(event) => patch({ color: event.target.value })}
              maxLength={40}
              className="input"
            />
          </Field>
        </div>
      </div>
    );
  }

  return null;
}

function NumberField({
  label,
  value,
  disabled,
  onChange,
  min,
  max,
}: {
  label: string;
  value?: number;
  disabled: boolean;
  onChange: (value: number | undefined) => void;
  min: number;
  max: number;
}) {
  return (
    <Field label={label}>
      <input
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value ? Number(event.target.value) : undefined)}
        type="number"
        min={min}
        max={max}
        className="input"
      />
    </Field>
  );
}

function CheckboxField({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-[1rem] border border-border/70 bg-card/80 px-3 py-2.5 text-xs font-semibold">
      {label}
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-primary"
      />
    </label>
  );
}

function dynamicListingCondition(value: unknown): ListingCondition {
  if (value === "new") return "new";
  if (value === "like_new") return "like_new";
  if (value === "good" || value === "fair") return "used";
  if (value === "for_parts") return "for_parts";
  return "not_applicable";
}

function legacyCategoryCondition(
  kind: CategoryFieldKind,
  details: CategorySpecificDetails,
): ListingCondition {
  const value = kind === "vehicles" ? details.vehicle_condition : details.condition;
  if (value === "new") return "new";
  if (value === "excellent" || value === "good") return "like_new";
  if (value === "needs_work") return "for_parts";
  if (value === "used") return "used";
  return "not_applicable";
}

function readDetailString(details: Record<string, unknown>, key: string) {
  const value = details[key];
  return typeof value === "string" ? value : "";
}

function resolveHydratedTaxonomyNodeId({
  taxonomyNodes,
  canonicalTaxonomyNodeId,
  legacyTaxonomyNodeId,
  categoryId,
  subcategoryId,
}: {
  taxonomyNodes: TaxonomyNode[];
  canonicalTaxonomyNodeId: string;
  legacyTaxonomyNodeId: string;
  categoryId: string;
  subcategoryId: string | null;
}) {
  const byId = new Map(taxonomyNodes.map((node) => [node.id, node]));
  for (const candidate of [canonicalTaxonomyNodeId, legacyTaxonomyNodeId]) {
    if (candidate && byId.get(candidate)?.isLeaf) return candidate;
  }

  const compatibleLeaves = taxonomyNodes.filter(
    (node) =>
      node.isLeaf &&
      node.legacyCategoryId === categoryId &&
      (!subcategoryId || node.legacySubcategoryId === subcategoryId),
  );
  if (subcategoryId) return compatibleLeaves[0]?.id ?? "";
  return compatibleLeaves.length === 1 ? compatibleLeaves[0].id : "";
}

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildChangedListingPatch(
  initial: EditListingSnapshot,
  current: EditListingFormValues,
  contentFlags: string[],
): UpdateListingPayload {
  const patch: UpdateListingPayload = {};
  const taxonomyChanged =
    Boolean(current.taxonomyNodeId) && current.taxonomyNodeId !== initial.taxonomyNodeId;
  const categoryChanged = current.categoryId !== initial.categoryId;

  if (categoryChanged) patch.categoryId = current.categoryId;
  if ((categoryChanged || taxonomyChanged) && current.subcategoryId !== initial.subcategoryId) {
    patch.subcategoryId = current.subcategoryId;
  }
  if (current.governorateId !== initial.governorateId) {
    patch.governorateId = current.governorateId;
  }
  if (current.title !== initial.title) patch.title = current.title;
  if (current.description !== initial.description) patch.description = current.description;
  if (current.price !== initial.price) patch.price = current.price;
  if (current.priceType !== initial.priceType) patch.priceType = current.priceType;
  if (current.condition !== initial.condition) patch.condition = current.condition;
  if (current.districtAr !== initial.districtAr) patch.districtAr = current.districtAr;
  if (current.contactName !== initial.contactName) {
    patch.contactName = current.contactName || null;
  }
  if (!sameValue(current.contactOptions, initial.contactOptions)) {
    patch.contactOptions = current.contactOptions;
  }

  const contactDetailsChanged =
    current.phone !== initial.phone ||
    current.whatsapp !== initial.whatsapp ||
    !sameValue(current.contactOptions, initial.contactOptions);
  const categoryDetailsChanged =
    current.categoryKind !== initial.categoryKind ||
    !sameValue(current.categoryDetails, initial.categoryDetails);
  const previousFlags = Array.isArray(initial.details.content_flags)
    ? initial.details.content_flags
    : [];
  const contentFlagsChanged = !sameValue(previousFlags, contentFlags);

  if (contactDetailsChanged || categoryDetailsChanged || taxonomyChanged || contentFlagsChanged) {
    let details = { ...initial.details };
    if (contactDetailsChanged) {
      delete details.phone;
      delete details.whatsapp;
      if (current.contactOptions.phone && current.phone) details.phone = current.phone;
      if (current.contactOptions.whatsapp && current.whatsapp) details.whatsapp = current.whatsapp;
    }
    if (categoryDetailsChanged) {
      details = mergeCategoryDetails(details, current.categoryKind, current.categoryDetails);
    }
    if (taxonomyChanged) details._taxonomy_node_id = current.taxonomyNodeId;
    if (contentFlagsChanged) {
      delete details.content_flags;
      if (contentFlags.length > 0) details.content_flags = contentFlags;
    }
    patch.details = details;
  }

  return patch;
}

function validateEditListing({
  values,
  taxonomyNodes,
  existingDetails,
  requireComplete,
  requiresPreciseLocation,
  preciseLocationSelected,
  text,
}: {
  values: EditListingFormValues;
  taxonomyNodes: TaxonomyNode[];
  existingDetails: Record<string, unknown>;
  requireComplete: boolean;
  requiresPreciseLocation: boolean;
  preciseLocationSelected: boolean;
  text: (ar: string, en: string) => string;
}): { ok: true; contentFlags: string[] } | { ok: false; message: string } {
  const selectedTaxonomyNode = taxonomyNodes.find((node) => node.id === values.taxonomyNodeId);

  if (taxonomyNodes.length > 0 && !selectedTaxonomyNode?.isLeaf) {
    return {
      ok: false,
      message: text("اختر تصنيفًا نهائيًا.", "Choose a final category."),
    };
  }
  if (taxonomyNodes.length === 0 && !values.categoryId) {
    return { ok: false, message: text("اختر القسم.", "Choose a category.") };
  }
  if (values.title.length < (requireComplete ? 10 : 4)) {
    return {
      ok: false,
      message: text("راجع عنوان الإعلان قبل الحفظ.", "Review the listing title before saving."),
    };
  }
  if (!values.governorateId && !values.locationNodeId) {
    return { ok: false, message: text("اختر المحافظة.", "Choose a governorate.") };
  }
  if (values.price !== null && (!Number.isFinite(values.price) || values.price < 0)) {
    return { ok: false, message: text("أدخل سعرًا صحيحًا.", "Enter a valid price.") };
  }
  if (values.contactOptions.phone && !isSafePhoneValue(values.phone)) {
    return {
      ok: false,
      message: text(
        "أدخل رقم هاتف صالحًا قبل حفظ الإعلان.",
        "Enter a valid phone number before saving.",
      ),
    };
  }
  if (values.contactOptions.whatsapp && !isSafePhoneValue(values.whatsapp)) {
    return {
      ok: false,
      message: text(
        "أدخل رقم واتساب صالحًا قبل حفظ الإعلان.",
        "Enter a valid WhatsApp number before saving.",
      ),
    };
  }

  if (requireComplete && values.description.length < 30) {
    return {
      ok: false,
      message: text(
        "الوصف يجب أن يكون 30 حرفًا على الأقل.",
        "Description must be at least 30 characters.",
      ),
    };
  }
  if (
    requireComplete &&
    (values.priceType === "fixed" || values.priceType === "negotiable") &&
    (values.price === null || values.price <= 0)
  ) {
    return {
      ok: false,
      message: text("أدخل سعرًا صحيحًا.", "Enter a valid price."),
    };
  }
  if (requireComplete && requiresPreciseLocation && !preciseLocationSelected) {
    return {
      ok: false,
      message: text("اختر موقعًا أكثر دقة.", "Choose a more precise location."),
    };
  }
  if (requireComplete) {
    const details = values.categoryDetails;
    const missingCategoryDetails =
      (values.categoryKind === "vehicles" &&
        ((!details.car_make && !details.make) ||
          (!details.car_model && !details.model) ||
          !details.year ||
          details.mileage_km === undefined)) ||
      (values.categoryKind === "real_estate" &&
        (!details.property_type || !details.listing_purpose || !details.area_sqm)) ||
      (values.categoryKind === "jobs" && (!details.job_type || !details.employment_type)) ||
      (values.categoryKind === "services" && !details.service_type) ||
      (values.categoryKind === "electronics" &&
        (!details.electronics_brand || !details.electronics_model));
    if (missingCategoryDetails) {
      return {
        ok: false,
        message: text("أكمل الحقول المطلوبة للقسم.", "Complete the required category fields."),
      };
    }
  }

  const contentCheck = checkListingContentSafety([
    values.title,
    values.description,
    values.contactName,
    existingDetails,
  ]);
  if (contentCheck.blocked) {
    return {
      ok: false,
      message:
        contentCheck.messageAr ??
        text("راجع نص الإعلان قبل الحفظ.", "Review the listing text before saving."),
    };
  }

  return { ok: true, contentFlags: contentCheck.flags };
}
