from pathlib import Path

path = Path("src/routes/add-listing.tsx")
text = path.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one anchor, found {count}")
    text = text.replace(old, new, 1)


replace_once(
    'type ImageUploadState = "pending" | "uploading" | "uploaded" | "failed";\n',
    'type ImageUploadState = "pending" | "uploading" | "uploaded" | "failed";\n'
    'type AutosaveState = "idle" | "dirty" | "saving" | "saved" | "failed";\n',
    "autosave state type",
)

replace_once(
    '  const [draftListing, setDraftListing] = useState<ClassifiedListing | null>(null);\n'
    '  const [selectedImages, setSelectedImages] = useState<UploadImageEntry[]>([]);',
    '  const [draftListing, setDraftListing] = useState<ClassifiedListing | null>(null);\n'
    '  const [autosaveState, setAutosaveState] = useState<AutosaveState>("idle");\n'
    '  const [lastAutosavedAt, setLastAutosavedAt] = useState<string | null>(null);\n'
    '  const [autosaveError, setAutosaveError] = useState<string | null>(null);\n'
    '  const [selectedImages, setSelectedImages] = useState<UploadImageEntry[]>([]);',
    "autosave state hooks",
)

replace_once(
    '  const staleUploadCleanupRef = useRef<Map<string, StaleUploadCleanupRecord>>(new Map());\n',
    '  const staleUploadCleanupRef = useRef<Map<string, StaleUploadCleanupRecord>>(new Map());\n'
    '  const draftListingRef = useRef<ClassifiedListing | null>(null);\n'
    '  const autosaveTimerRef = useRef<number | null>(null);\n'
    '  const autosaveRequestIdRef = useRef(0);\n'
    '  const autosaveQueueRef = useRef<Promise<void>>(Promise.resolve());\n'
    '  const lastAutosaveSignatureRef = useRef("");\n',
    "autosave refs",
)

replace_once(
    '  useEffect(() => {\n'
    '    selectedImagesRef.current = selectedImages;\n'
    '  }, [selectedImages]);\n',
    '  useEffect(() => {\n'
    '    selectedImagesRef.current = selectedImages;\n'
    '  }, [selectedImages]);\n\n'
    '  useEffect(() => {\n'
    '    draftListingRef.current = draftListing;\n'
    '  }, [draftListing]);\n\n'
    '  useEffect(\n'
    '    () => () => {\n'
    '      if (autosaveTimerRef.current !== null) {\n'
    '        window.clearTimeout(autosaveTimerRef.current);\n'
    '      }\n'
    '    },\n'
    '    [],\n'
    '  );\n',
    "autosave ref effects",
)

old_payload_anchor = '''  function buildCurrentListingPayload(details: Record<string, unknown>) {
    return {
      categoryId,
      governorateId,
      title: title.trim(),
      description: description.trim(),
      price: normalizedPrice ? Number(normalizedPrice) : null,
      priceType,
      condition,
      districtAr: locationNodeId ? `@${locationNodeId}` : district,
      contactName: contactName.trim() || null,
      contactOptions: contact,
      details,
    };
  }

  useEffect(() => {
    let cancelled = false;
'''

new_payload_anchor = '''  function buildCurrentListingPayload(details: Record<string, unknown>) {
    return {
      categoryId,
      governorateId,
      title: title.trim(),
      description: description.trim(),
      price: normalizedPrice ? Number(normalizedPrice) : null,
      priceType,
      condition,
      districtAr: locationNodeId ? `@${locationNodeId}` : district,
      contactName: contactName.trim() || null,
      contactOptions: contact,
      details,
    };
  }

  const autosavePayload = useMemo(() => {
    const normalizedPhone = normalizeContactValue(phone);
    const normalizedWhatsapp = normalizeContactValue(whatsapp);
    const details = mergeCategoryDetails(
      {
        ...(contact.phone && isSafePhoneValue(normalizedPhone) ? { phone: normalizedPhone } : {}),
        ...(contact.whatsapp && isSafePhoneValue(normalizedWhatsapp)
          ? { whatsapp: normalizedWhatsapp }
          : {}),
      },
      categoryFieldKind,
      categoryDetails,
    );

    return {
      categoryId,
      governorateId,
      title: title.trim(),
      description: description.trim(),
      price: normalizedPrice ? Number(normalizedPrice) : null,
      priceType,
      condition,
      districtAr: locationNodeId ? `@${locationNodeId}` : district,
      contactName: contactName.trim() || null,
      contactOptions: contact,
      details,
    };
  }, [
    categoryId,
    governorateId,
    title,
    description,
    normalizedPrice,
    priceType,
    condition,
    locationNodeId,
    district,
    contactName,
    contact,
    phone,
    whatsapp,
    categoryFieldKind,
    categoryDetails,
  ]);

  useEffect(() => {
    const profileId = auth.profile?.id ?? null;
    const currentDraft = draftListingRef.current;
    const hasMinimumDraftData =
      auth.status === "signedIn" &&
      Boolean(profileId) &&
      autosavePayload.categoryId.trim().length > 0 &&
      autosavePayload.governorateId.trim().length > 0 &&
      autosavePayload.title.length >= 4;

    if (
      !hasMinimumDraftData ||
      submittingRef.current ||
      (currentDraft !== null && currentDraft.status !== "draft")
    ) {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      if (currentDraft?.status !== "draft") setAutosaveState("idle");
      return;
    }

    const signature = JSON.stringify(autosavePayload);
    if (signature === lastAutosaveSignatureRef.current) {
      setAutosaveState("saved");
      return;
    }

    setAutosaveState("dirty");
    setAutosaveError(null);
    const requestId = ++autosaveRequestIdRef.current;

    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      const queuedSave = autosaveQueueRef.current.then(async () => {
        if (requestId !== autosaveRequestIdRef.current || submittingRef.current) return;

        setAutosaveState("saving");
        const draft = draftListingRef.current;
        if (draft && draft.status !== "draft") return;

        const result = draft
          ? await updateOwnerListing(profileId, draft.id, autosavePayload)
          : await createOwnerDraftListing(profileId, autosavePayload);

        if (result.ok) {
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
      });

      autosaveQueueRef.current = queuedSave.catch((error: unknown) => {
        if (requestId !== autosaveRequestIdRef.current || submittingRef.current) return;
        setAutosaveState("failed");
        setAutosaveError(error instanceof Error ? error.message : "");
      });
    }, 1000);

    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [auth.status, auth.profile?.id, autosavePayload]);

  useEffect(() => {
    let cancelled = false;
'''
replace_once(old_payload_anchor, new_payload_anchor, "autosave payload and effect")

replace_once(
    '    submittingRef.current = true;\n'
    '    setSubmitting(true);\n'
    '    setSubmitMessage(null);',
    '    autosaveRequestIdRef.current += 1;\n'
    '    if (autosaveTimerRef.current !== null) {\n'
    '      window.clearTimeout(autosaveTimerRef.current);\n'
    '      autosaveTimerRef.current = null;\n'
    '    }\n'
    '    submittingRef.current = true;\n'
    '    setSubmitting(true);\n'
    '    setAutosaveState("idle");\n'
    '    await autosaveQueueRef.current;\n'
    '    setSubmitMessage(null);',
    "submit autosave coordination",
)

replace_once(
    '      const payload = buildCurrentListingPayload(details);\n'
    '      const result = draftListing\n'
    '        ? await updateOwnerListing(auth.profile?.id ?? null, draftListing.id, payload)\n'
    '        : await createOwnerDraftListing(auth.profile?.id ?? null, payload);',
    '      const payload = buildCurrentListingPayload(details);\n'
    '      const currentDraft = draftListingRef.current;\n'
    '      const result = currentDraft\n'
    '        ? await updateOwnerListing(auth.profile?.id ?? null, currentDraft.id, payload)\n'
    '        : await createOwnerDraftListing(auth.profile?.id ?? null, payload);',
    "submit current draft ref",
)

replace_once(
    '      setDraftListing(listingDraft);\n'
    '      setCreatedListingId(listingDraft.id);',
    '      draftListingRef.current = listingDraft;\n'
    '      setDraftListing(listingDraft);\n'
    '      setCreatedListingId(listingDraft.id);',
    "submit draft ref sync",
)

replace_once(
    '      setDraftListing(submitResult.data);\n\n'
    '      setSubmitMessage(',
    '      draftListingRef.current = submitResult.data;\n'
    '      setDraftListing(submitResult.data);\n'
    '      lastAutosaveSignatureRef.current = "";\n'
    '      setAutosaveState("idle");\n\n'
    '      setSubmitMessage(',
    "review submission autosave reset",
)

replace_once(
    '        <ListingStudioSteps steps={steps.map((label) => ({ label }))} current={step} />\n\n'
    '        {loading ? (',
    '        <ListingStudioSteps steps={steps.map((label) => ({ label }))} current={step} />\n\n'
    '        {autosaveState !== "idle" && (\n'
    '          <div\n'
    '            aria-live="polite"\n'
    '            data-autosave-state={autosaveState}\n'
    '            className={`mb-4 rounded-[1rem] border px-3 py-2 text-xs font-semibold ${\n'
    '              autosaveState === "failed"\n'
    '                ? "border-destructive/20 bg-destructive/8 text-destructive"\n'
    '                : "border-border/70 bg-card/85 text-muted-foreground"\n'
    '            }`}\n'
    '          >\n'
    '            {autosaveState === "dirty" && text("تغييرات بانتظار الحفظ", "Changes waiting to save")}\n'
    '            {autosaveState === "saving" && text("جارٍ حفظ المسودة…", "Saving draft…")}\n'
    '            {autosaveState === "saved" && text("تم حفظ المسودة", "Draft saved")}\n'
    '            {autosaveState === "failed" && (\n'
    '              <span>{autosaveError || text("فشل حفظ المسودة تلقائياً", "Autosave failed")}</span>\n'
    '            )}\n'
    '            {autosaveState === "saved" && lastAutosavedAt && (\n'
    '              <span className="ms-2 font-normal opacity-75">\n'
    '                · {text("آخر حفظ", "Last saved")} {" "}\n'
    '                {new Intl.DateTimeFormat(language === "ar" ? "ar-SY" : "en-US", {\n'
    '                  hour: "2-digit",\n'
    '                  minute: "2-digit",\n'
    '                }).format(new Date(lastAutosavedAt))}\n'
    '              </span>\n'
    '            )}\n'
    '          </div>\n'
    '        )}\n\n'
    '        {loading ? (',
    "autosave status UI",
)

path.write_text(text, encoding="utf-8")
print("Applied Listing Studio autosave codemod successfully")
