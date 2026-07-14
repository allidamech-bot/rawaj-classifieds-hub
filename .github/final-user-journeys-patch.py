from pathlib import Path
import re

ROOT = Path.cwd()


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"missing exact block: {label}")
    return text.replace(old, new, 1)


def sub_once(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"missing regex block: {label}")
    return updated


def patch_more() -> None:
    path = "src/routes/more.tsx"
    text = read(path)
    text = replace_once(
        text,
        'import type { ComponentType, ReactNode } from "react";\nimport { useState } from "react";',
        'import { useRef, useState, type ComponentType, type ReactNode } from "react";',
        "more react imports",
    )
    text = replace_once(
        text,
        "  destructive?: boolean;\n};",
        "  destructive?: boolean;\n  disabled?: boolean;\n};",
        "account row disabled",
    )
    text = replace_once(
        text,
        '  const [logoutError, setLogoutError] = useState("");',
        '  const [logoutError, setLogoutError] = useState("");\n  const [loggingOut, setLoggingOut] = useState(false);\n  const logoutInFlightRef = useRef(false);',
        "logout state",
    )
    text = replace_once(
        text,
        '''  async function handleLogout() {
    setLogoutError("");
    const result = await auth.signOut();
    if (result.error) setLogoutError(result.error);
  }''',
        '''  async function handleLogout() {
    if (logoutInFlightRef.current) return;
    logoutInFlightRef.current = true;
    setLoggingOut(true);
    setLogoutError("");
    try {
      const result = await auth.signOut();
      if (result.error) setLogoutError(result.error);
    } finally {
      logoutInFlightRef.current = false;
      setLoggingOut(false);
    }
  }''',
        "logout guard",
    )
    text = replace_once(
        text,
        '''                  titleAr: "تسجيل الخروج",
                  titleEn: "Log out",
                  hintAr: "الخروج من هذا الحساب",
                  hintEn: "Sign out of this account",
                  icon: LogOut,
                  onClick: handleLogout,
                  destructive: true,''',
        '''                  titleAr: loggingOut ? "جارٍ تسجيل الخروج" : "تسجيل الخروج",
                  titleEn: loggingOut ? "Signing out" : "Log out",
                  hintAr: loggingOut ? "يتم إنهاء الجلسة بأمان" : "الخروج من هذا الحساب",
                  hintEn: loggingOut ? "Ending this session safely" : "Sign out of this account",
                  icon: LogOut,
                  onClick: handleLogout,
                  destructive: true,
                  disabled: loggingOut,''',
        "logout row state",
    )
    text = replace_once(
        text,
        '    "flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-2 py-2.5 text-start transition hover:bg-card/65 active:scale-[0.985]";',
        '    "flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-2 py-2.5 text-start transition hover:bg-card/65 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50";',
        "account row disabled style",
    )
    text = replace_once(
        text,
        '<button type="button" onClick={row.onClick} className={rowClass}>',
        '<button type="button" onClick={row.onClick} disabled={row.disabled} className={rowClass}>',
        "account row disabled prop",
    )
    write(path, text)


def patch_add_listing() -> None:
    path = "src/routes/add-listing.tsx"
    text = read(path)
    text = replace_once(
        text,
        'import { useEffect, useMemo, useRef, useState } from "react";',
        'import { useCallback, useEffect, useMemo, useRef, useState } from "react";',
        "add listing callback import",
    )
    text = replace_once(
        text,
        '  const lastAutosaveSignatureRef = useRef("");',
        '  const lastAutosaveSignatureRef = useRef("");\n  const setupRequestIdRef = useRef(0);',
        "add listing setup request ref",
    )
    text = sub_once(
        text,
        r'''  useEffect\(\(\) => \{\n    let cancelled = false;\n    async function load\(\) \{\n      setLoading\(true\);\n      setSetupError\(null\);\n      const \[categoriesResult, governoratesResult, taxonomyResult\] = await Promise\.all\(\[\n        fetchPublicCategories\(\),\n        fetchPublicGovernorates\(\),\n        fetchPublicTaxonomyNodes\(\),\n      \]\);\n      if \(cancelled\) return;\n      if \(!categoriesResult\.ok\) setSetupError\(categoriesResult\.error\);\n      else if \(!governoratesResult\.ok\) setSetupError\(governoratesResult\.error\);\n      else \{\n        setCategories\(categoriesResult\.data\);\n        setGovernorates\(governoratesResult\.data\);\n        if \(taxonomyResult\.ok\) setTaxonomyNodes\(taxonomyResult\.data\);\n      \}\n      setLoading\(false\);\n    \}\n    void load\(\);\n    return \(\) => \{\n      cancelled = true;\n    \};\n  \}, \[\]\);''',
        '''  const loadSetup = useCallback(async () => {
    const requestId = ++setupRequestIdRef.current;
    setLoading(true);
    setSetupError(null);
    const [categoriesResult, governoratesResult, taxonomyResult] = await Promise.all([
      fetchPublicCategories(),
      fetchPublicGovernorates(),
      fetchPublicTaxonomyNodes(),
    ]);
    if (requestId !== setupRequestIdRef.current) return;
    setLoading(false);
    if (!categoriesResult.ok) {
      setSetupError(categoriesResult.error);
      return;
    }
    if (!governoratesResult.ok) {
      setSetupError(governoratesResult.error);
      return;
    }
    setCategories(categoriesResult.data);
    setGovernorates(governoratesResult.data);
    setTaxonomyNodes(taxonomyResult.ok ? taxonomyResult.data : []);
  }, []);

  useEffect(() => {
    void loadSetup();
    return () => {
      setupRequestIdRef.current += 1;
    };
  }, [loadSetup]);''',
        "add listing setup recovery",
    )
    text = replace_once(
        text,
        '''          <Card title={text("تعذر تجهيز نموذج النشر", "Could not prepare posting form")}>
            <p className="text-sm text-muted-foreground">{setupError.message}</p>
          </Card>''',
        '''          <Card title={text("تعذر تجهيز نموذج النشر", "Could not prepare posting form")}>
            <p className="text-sm text-muted-foreground">{setupError.message}</p>
            <button
              type="button"
              onClick={() => void loadSetup()}
              className="rawaj-button-primary mt-4 px-4 py-2"
            >
              {text("إعادة المحاولة", "Try again")}
            </button>
          </Card>''',
        "add listing setup retry",
    )
    write(path, text)


def patch_manage_listing() -> None:
    path = "src/routes/profile/listings.$id.tsx"
    text = read(path)
    text = replace_once(
        text,
        '  const [uploadError, setUploadError] = useState<string | null>(null);\n  const [reorderingImages, setReorderingImages] = useState(false);',
        '''  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imagesError, setImagesError] = useState<string | null>(null);
  const [reorderingImages, setReorderingImages] = useState(false);
  const setupRequestIdRef = useRef(0);
  const imagesRequestIdRef = useRef(0);
  const saveInFlightRef = useRef(false);
  const resubmitInFlightRef = useRef(false);
  const deleteInFlightRef = useRef(false);
  const uploadAllInFlightRef = useRef(false);''',
        "manage listing recovery refs",
    )
    text = sub_once(
        text,
        r'''  useEffect\(\(\) => \{\n    if \(auth\.status !== "signedIn" \|\| !auth\.profile\?\.id\) return;\n    const profileId = auth\.profile\.id;\n    let cancelled = false;\n\n    async function load\(\) \{.*?\n    void load\(\);\n    return \(\) => \{\n      cancelled = true;\n    \};\n  \}, \[auth\.status, id, auth\.profile\?\.id\]\);''',
        '''  const loadSetup = useCallback(async () => {
    if (auth.status !== "signedIn" || !auth.profile?.id) return;
    const profileId = auth.profile.id;
    const requestId = ++setupRequestIdRef.current;
    setLoading(true);
    setSetupError(null);

    const [listingResult, locationResult, taxonomyAssignmentResult, refsResult] =
      await Promise.all([
        fetchOwnerListingDetail(profileId, id),
        fetchListingLocationNodeId(profileId, id),
        fetchOwnerListingTaxonomyAssignment(profileId, id),
        Promise.all([
          fetchPublicCategories(),
          fetchPublicGovernorates(),
          fetchPublicSubcategories(),
          fetchPublicTaxonomyNodes(),
        ]),
      ]);

    if (requestId !== setupRequestIdRef.current) return;
    setLoading(false);
    if (!refsResult[0].ok) {
      setSetupError(refsResult[0].error);
      return;
    }
    if (!refsResult[1].ok) {
      setSetupError(refsResult[1].error);
      return;
    }
    if (!refsResult[2].ok) {
      setSetupError(refsResult[2].error);
      return;
    }
    if (!listingResult.ok) {
      setSetupError(listingResult.error);
      return;
    }

    setListing(listingResult.data);
    setCategories(refsResult[0].data);
    setGovernorates(refsResult[1].data);
    setSubcategories(refsResult[2].data);
    setTaxonomyNodes(refsResult[3].ok ? refsResult[3].data : []);

    const fallbackTaxonomyNodeId = readDetailString(
      listingResult.data.details,
      "_taxonomy_node_id",
    );
    setTaxonomyNodeId(
      taxonomyAssignmentResult.ok
        ? (taxonomyAssignmentResult.data?.taxonomyNodeId ?? fallbackTaxonomyNodeId)
        : fallbackTaxonomyNodeId,
    );
    setTitle(listingResult.data.title);
    setDescription(listingResult.data.description);
    setCategoryId(listingResult.data.categoryId);
    setSubcategoryId(listingResult.data.subcategoryId);
    setGovernorateId(listingResult.data.governorateId);
    setDistrict(listingResult.data.districtAr ?? "");
    setLocationNodeId(locationResult.ok ? (locationResult.data ?? "") : "");
    setPrice(listingResult.data.price?.toString() ?? "");
    setPriceType(listingResult.data.priceType);
    setCondition(listingResult.data.condition);
    setContactName(listingResult.data.contactName ?? "");
    setPhone(readDetailString(listingResult.data.details, "phone"));
    setWhatsapp(readDetailString(listingResult.data.details, "whatsapp"));
    setCategoryDetails(readCategoryDetails(listingResult.data.details));
    setContact(
      Object.keys(listingResult.data.contactOptions || {}).length > 0
        ? {
            phone: Boolean(listingResult.data.contactOptions.phone),
            whatsapp: Boolean(listingResult.data.contactOptions.whatsapp),
          }
        : { phone: true, whatsapp: false },
    );
  }, [auth.profile?.id, auth.status, id]);

  useEffect(() => {
    setupRequestIdRef.current += 1;
    setListing(null);
    setSetupError(null);
    void loadSetup();
    return () => {
      setupRequestIdRef.current += 1;
    };
  }, [loadSetup]);''',
        "manage listing setup loader",
    )
    text = replace_once(
        text,
        '''  async function loadImages() {
    if (!auth.profile?.id) return;
    setImagesLoading(true);
    const result = await fetchListingImages(id);
    if (result.ok) setImages(result.data);
    setImagesLoading(false);
  }''',
        '''  const loadImages = useCallback(async () => {
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
  }, [auth.profile?.id, id]);''',
        "manage listing image loader",
    )
    text = replace_once(
        text,
        '''  useEffect(() => {
    if (!listing) return;
    void loadImages();
  }, [listing]);''',
        '''  useEffect(() => {
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
  }, [uploading]);''',
        "manage listing effect guards",
    )
    text = replace_once(
        text,
        '    if (!listing || !isEditable) return;\n    setSaving(true);',
        '    if (!listing || !isEditable || saveInFlightRef.current) return;\n    saveInFlightRef.current = true;\n    setSaving(true);',
        "manage listing save guard",
    )
    text = replace_once(
        text,
        '    if (!listing || !isResubmittable) return;\n    setResubmitting(true);',
        '    if (!listing || !isResubmittable || resubmitInFlightRef.current) return;\n    resubmitInFlightRef.current = true;\n    setResubmitting(true);',
        "manage listing resubmit guard",
    )
    text = replace_once(
        text,
        '    if (!listing || !isDeletable) return;\n    if (!confirm',
        '    if (!listing || !isDeletable || deleteInFlightRef.current) return;\n    if (!confirm',
        "manage listing delete preguard",
    )
    text = replace_once(
        text,
        '    setDeleting(true);\n    const result = await deleteOwnerListing',
        '    deleteInFlightRef.current = true;\n    setDeleting(true);\n    const result = await deleteOwnerListing',
        "manage listing delete guard",
    )
    text = replace_once(
        text,
        '    if (!listing || selectedImagesRef.current.length === 0) return;\n    setUploading(true);',
        '    if (!listing || selectedImagesRef.current.length === 0 || uploadAllInFlightRef.current) return;\n    uploadAllInFlightRef.current = true;\n    setUploading(true);',
        "manage listing upload guard",
    )
    text = replace_once(
        text,
        '''            <Link to="/profile" className="rawaj-button-primary mt-4 px-4 py-2">
              {text("العودة لحسابي", "Back to my account")}
            </Link>''',
        '''            <div className="mt-4 flex flex-wrap justify-center gap-2">
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
            </div>''',
        "manage listing setup retry",
    )
    text = replace_once(
        text,
        '''        {savingError && (
          <div className="mb-4">
            <ListingStudioMessage tone="danger">{savingError}</ListingStudioMessage>
          </div>
        )}''',
        '''        {savingError && (
          <div className="mb-4">
            <ListingStudioMessage tone="danger">{savingError}</ListingStudioMessage>
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
        )}''',
        "manage listing image retry message",
    )
    write(path, text)


def patch_listing_detail() -> None:
    path = "src/routes/listings.$id.tsx"
    text = read(path)
    text = replace_once(
        text,
        '  const imageRequestIdRef = useRef(0);',
        '''  const imageRequestIdRef = useRef(0);
  const reportInFlightRef = useRef(false);
  const messageInFlightRef = useRef(false);
  const alertInFlightRef = useRef(false);''',
        "listing detail action refs",
    )
    text = sub_once(
        text,
        r'''  async function reportListing\(\) \{.*?\n  \}\n\n  async function messageSeller''',
        '''  async function reportListing() {
    setActionMessage(null);
    if (auth.status !== "signedIn") {
      setActionMessage(text("يجب تسجيل الدخول لإرسال بلاغ.", "Log in to report a listing."));
      return;
    }
    if (reportInFlightRef.current) return;
    reportInFlightRef.current = true;
    try {
      const result = await createListingReport(
        auth.profile?.id ?? null,
        id,
        "suspicious_listing",
        "بلاغ سريع من صفحة الإعلان.",
      );
      setActionMessage(
        result.ok
          ? text("تم إرسال البلاغ للمراجعة.", "Report sent for review.")
          : result.error.message,
      );
    } finally {
      reportInFlightRef.current = false;
    }
  }

  async function messageSeller''',
        "listing report guard",
    )
    text = sub_once(
        text,
        r'''  async function messageSeller\(\) \{.*?\n  \}\n\n  async function shareListing''',
        '''  async function messageSeller() {
    setActionMessage(null);
    if (auth.status !== "signedIn") {
      setActionMessage(text("يجب تسجيل الدخول لبدء محادثة.", "Log in to start a conversation."));
      return;
    }
    if (messageInFlightRef.current) return;
    if (listing?.ownerId === auth.profile?.id) {
      setActionMessage(text("لا يمكنك بدء محادثة مع نفسك.", "You cannot message yourself."));
      return;
    }
    if (!listing || listing.status !== "approved") {
      setActionMessage(
        text(
          "المحادثات متاحة للإعلانات المعتمدة فقط.",
          "Messages are available for approved listings only.",
        ),
      );
      return;
    }
    messageInFlightRef.current = true;
    try {
      const result = await startListingConversation(auth.profile?.id ?? null, listing.id);
      if (!result.ok) {
        setActionMessage(result.error.message);
        return;
      }
      void navigate({ to: "/chats", search: { conversation: result.data } });
    } finally {
      messageInFlightRef.current = false;
    }
  }

  async function shareListing''',
        "listing message guard",
    )
    text = replace_once(
        text,
        '    setAlertBusy(true);\n    const result = await createSavedSearch',
        '    if (alertInFlightRef.current) return;\n    alertInFlightRef.current = true;\n    setAlertBusy(true);\n    const result = await createSavedSearch',
        "listing alert guard start",
    )
    text = replace_once(
        text,
        '''    setAlertBusy(false);

    if (!result.ok) {''',
        '''    setAlertBusy(false);
    alertInFlightRef.current = false;

    if (!result.ok) {''',
        "listing alert guard reset",
    )
    write(path, text)


def patch_seller() -> None:
    path = "src/routes/seller.$id.tsx"
    text = read(path)
    text = replace_once(
        text,
        'import { useEffect, useState, type FormEvent } from "react";',
        'import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";',
        "seller review imports",
    )
    text = replace_once(
        text,
        '  const [eligibilityState, setEligibilityState] = useState<ReviewEligibilityUiState>("idle");',
        '''  const [eligibilityState, setEligibilityState] = useState<ReviewEligibilityUiState>("idle");
  const eligibilityRequestIdRef = useRef(0);
  const reviewInFlightRef = useRef(false);''',
        "seller review refs",
    )
    text = sub_once(
        text,
        r'''  useEffect\(\(\) => \{\n    if \(!shouldCheckEligibility\) \{.*?\n  \}, \[auth\.profile\?\.id, auth\.status, seller\.id, shouldCheckEligibility\]\);''',
        '''  const loadEligibility = useCallback(async () => {
    if (!shouldCheckEligibility) {
      eligibilityRequestIdRef.current += 1;
      setEligibilityState("idle");
      return;
    }
    const requestId = ++eligibilityRequestIdRef.current;
    setEligibilityState("loading");
    setNotice("");
    const result = await fetchSellerReviewEligibility(seller.id);
    if (requestId !== eligibilityRequestIdRef.current) return;
    if (!result.ok) {
      setEligibilityState("error");
      return;
    }
    if (result.data.eligible) {
      setEligibilityState("eligible");
      return;
    }
    if (result.data.reason === "existing_review") {
      setEligibilityState("existing_review");
      return;
    }
    if (result.data.reason === "no_qualifying_interaction") {
      setEligibilityState("no_qualifying_interaction");
      return;
    }
    setEligibilityState("error");
  }, [seller.id, shouldCheckEligibility]);

  useEffect(() => {
    void loadEligibility();
    return () => {
      eligibilityRequestIdRef.current += 1;
    };
  }, [loadEligibility]);''',
        "seller eligibility recovery",
    )
    text = sub_once(
        text,
        r'''  async function submitReview\(event: FormEvent<HTMLFormElement>\) \{.*?\n  \}\n\n  return \(''',
        '''  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (eligibilityState !== "eligible" || reviewInFlightRef.current) return;
    reviewInFlightRef.current = true;
    setNotice("");
    setSaving(true);
    try {
      const result = await createSellerReview({
        sellerUserId: seller.id,
        reviewerUserId: auth.profile?.id ?? null,
        rating,
        comment,
        traits: selectedTraits,
      });
      if (result.ok) {
        setComment("");
        setRating(5);
        setSelectedTraits([]);
        setEligibilityState("existing_review");
        setNotice(
          text(
            "تم إرسال التقييم للمراجعة قبل ظهوره للعامة.",
            "Review submitted for moderation before public display.",
          ),
        );
      } else {
        setNotice(result.error.message);
        if (result.error.code === "permission_denied") {
          setEligibilityState("no_qualifying_interaction");
        } else if (result.error.code === "status_mismatch") {
          setEligibilityState("existing_review");
        }
      }
    } finally {
      reviewInFlightRef.current = false;
      setSaving(false);
    }
  }

  return (''',
        "seller review mutation guard",
    )
    text = replace_once(
        text,
        '''            <p className="mt-1 text-muted-foreground">
              {text(
                "تعذر التحقق من أهلية التقييم الآن. لم يتم فتح نموذج غير محمي.",
                "Review eligibility could not be verified. An unprotected review form was not opened.",
              )}
            </p>
          </div>''',
        '''            <p className="mt-1 text-muted-foreground">
              {text(
                "تعذر التحقق من أهلية التقييم الآن. لم يتم فتح نموذج غير محمي.",
                "Review eligibility could not be verified. An unprotected review form was not opened.",
              )}
            </p>
            <button type="button" onClick={() => void loadEligibility()} className="mt-2 underline">
              {text("إعادة المحاولة", "Try again")}
            </button>
          </div>''',
        "seller eligibility retry",
    )
    write(path, text)


def patch_chats() -> None:
    path = "src/routes/chats.tsx"
    text = read(path)
    text = replace_once(
        text,
        '  const autoOpenedConversationRef = useRef<string | null>(null);',
        '''  const autoOpenedConversationRef = useRef<string | null>(null);
  const sendInFlightRef = useRef(false);
  const reportInFlightRef = useRef<Set<string>>(new Set());
  const blockInFlightRef = useRef(false);''',
        "chat action refs",
    )
    text = replace_once(
        text,
        '''    } else {
      setConversations([]);
      setConversationError(result.error);
    }''',
        '''    } else {
      setConversationError(result.error);
    }''',
        "chat conversation snapshot preservation",
    )
    text = replace_once(
        text,
        '''    } else {
      setMessages([]);
      setMessageError(result.error);
    }''',
        '''    } else {
      setMessageError(result.error);
    }''',
        "chat message snapshot preservation",
    )
    text = sub_once(
        text,
        r'''  async function handleSend\(event: FormEvent<HTMLFormElement>\) \{.*?\n  \}\n\n  async function handleReport''',
        '''  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.profile?.id || !selectedConversation || sendInFlightRef.current) return;
    if (selectedConversation.status !== "active") {
      setNotice(
        text(
          "هذه المحادثة محفوظة كسجل ولا تقبل رسائل جديدة.",
          "This conversation is preserved as history and cannot receive new messages.",
        ),
      );
      return;
    }
    const profileId = auth.profile.id;
    const conversationId = selectedConversation.id;
    const cleanBody = body.trim();
    if (!cleanBody) return;
    const requestId = readOrCreateMessageSendRequestId(profileId, conversationId, cleanBody);
    sendInFlightRef.current = true;
    setNotice("");
    setMessageError(null);
    setSending(true);
    try {
      const result = await sendConversationMessage(profileId, conversationId, cleanBody, requestId);
      if (selectedConversationIdRef.current !== conversationId || auth.profile?.id !== profileId)
        return;
      if (!result.ok) {
        setMessageError(result.error);
        return;
      }
      completeMessageSendRequest(profileId, conversationId, requestId);
      setBody("");
      setMessages((current) =>
        current.some((message) => message.id === result.data.id)
          ? current
          : [...current, result.data],
      );
      setNotice(text("تم إرسال الرسالة.", "Message sent."));
      await loadConversations();
    } finally {
      sendInFlightRef.current = false;
      setSending(false);
    }
  }

  async function handleReport''',
        "chat send guard",
    )
    text = sub_once(
        text,
        r'''  async function handleReport\(message: ConversationMessage\) \{.*?\n  \}\n\n  async function handleBlock''',
        '''  async function handleReport(message: ConversationMessage) {
    if (!auth.profile?.id || !selectedConversation || reportInFlightRef.current.has(message.id))
      return;
    reportInFlightRef.current.add(message.id);
    setReportingMessageId(message.id);
    setNotice("");
    try {
      const result = await createMessageReport({
        messageId: message.id,
        conversationId: selectedConversation.id,
        reporterUserId: auth.profile.id,
        reason: "abusive_or_suspicious",
      });
      setNotice(
        result.ok
          ? text("تم إرسال بلاغ الرسالة للمراجعة.", "Message report sent for review.")
          : result.error.message,
      );
    } finally {
      reportInFlightRef.current.delete(message.id);
      setReportingMessageId((current) => (current === message.id ? null : current));
    }
  }

  async function handleBlock''',
        "chat report guard",
    )
    text = sub_once(
        text,
        r'''  async function handleBlock\(\) \{.*?\n  \}\n\n  function openFirstAvailableConversation''',
        '''  async function handleBlock() {
    if (!auth.profile?.id || !selectedConversation || blockInFlightRef.current) return;
    if (
      !confirm(text("حظر هذا المستخدم في هذه المحادثة؟", "Block this user in this conversation?"))
    )
      return;
    blockInFlightRef.current = true;
    setNotice("");
    try {
      const result = await blockConversationParticipant({
        conversationId: selectedConversation.id,
        blockerUserId: auth.profile.id,
        blockedUserId: selectedConversation.otherParticipant.userId,
        reason: blockReason || null,
      });
      setNotice(
        result.ok
          ? text(
              "تم حظر المحادثة. لن تقبل رسائل جديدة.",
              "Conversation blocked. New messages are no longer allowed.",
            )
          : result.error.message,
      );
      if (result.ok) await loadConversations();
    } finally {
      blockInFlightRef.current = false;
    }
  }

  function openFirstAvailableConversation''',
        "chat block guard",
    )
    write(path, text)


def add_contract() -> None:
    path = "scripts/final-user-journeys.test.mjs"
    content = '''import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [more, addListing, manageListing, listingDetail, seller, chats, packageJson, qualityGate] =
  await Promise.all([
    readFile(new URL("../src/routes/more.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/add-listing.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/profile/listings.$id.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/listings.$id.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/seller.$id.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/chats.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
  ]);

test("session actions are synchronously deduplicated", () => {
  assert.match(more, /const logoutInFlightRef = useRef\(false\)/);
  assert.match(more, /if \(logoutInFlightRef\.current\) return/);
  assert.match(more, /finally \{/);
  assert.match(more, /disabled: loggingOut/);
});

test("listing create and edit setup loads expose retry and stale-read guards", () => {
  assert.match(addListing, /const setupRequestIdRef = useRef\(0\)/);
  assert.match(addListing, /const loadSetup = useCallback/);
  assert.match(addListing, /onClick=\{\(\) => void loadSetup\(\)\}/);
  assert.match(manageListing, /const setupRequestIdRef = useRef\(0\)/);
  assert.match(manageListing, /const imagesRequestIdRef = useRef\(0\)/);
  assert.match(manageListing, /const saveInFlightRef = useRef\(false\)/);
  assert.match(manageListing, /const resubmitInFlightRef = useRef\(false\)/);
  assert.match(manageListing, /const deleteInFlightRef = useRef\(false\)/);
  assert.match(manageListing, /Retry photos|إعادة تحميل الصور/);
});

test("public listing actions cannot be duplicated", () => {
  assert.match(listingDetail, /const reportInFlightRef = useRef\(false\)/);
  assert.match(listingDetail, /const messageInFlightRef = useRef\(false\)/);
  assert.match(listingDetail, /const alertInFlightRef = useRef\(false\)/);
  assert.match(listingDetail, /reportInFlightRef\.current = false/);
  assert.match(listingDetail, /messageInFlightRef\.current = false/);
});

test("seller review eligibility is retryable and review writes are deduplicated", () => {
  assert.match(seller, /const loadEligibility = useCallback/);
  assert.match(seller, /const eligibilityRequestIdRef = useRef\(0\)/);
  assert.match(seller, /const reviewInFlightRef = useRef\(false\)/);
  assert.match(seller, /onClick=\{\(\) => void loadEligibility\(\)\}/);
  assert.match(seller, /reviewInFlightRef\.current = false/);
});

test("chat refresh failures preserve snapshots and sensitive writes are deduplicated", () => {
  assert.doesNotMatch(chats, /setConversations\(\[\]\);\n\s*setConversationError\(result\.error\)/);
  assert.doesNotMatch(chats, /setMessages\(\[\]\);\n\s*setMessageError\(result\.error\)/);
  assert.match(chats, /const sendInFlightRef = useRef\(false\)/);
  assert.match(chats, /const reportInFlightRef = useRef<Set<string>>\(new Set\(\)\)/);
  assert.match(chats, /const blockInFlightRef = useRef\(false\)/);
  assert.match(chats, /finally \{/);
});

test("final user journey contract remains in package and Quality Gate", () => {
  assert.match(packageJson, /"test:final-user-journeys"/);
  assert.match(qualityGate, /Final user journeys contract/);
  assert.match(qualityGate, /npm run test:final-user-journeys/);
});
'''
    write(path, content)


def patch_package_and_quality_gate() -> None:
    package_path = "package.json"
    package_text = read(package_path)
    package_text = replace_once(
        package_text,
        '"test:launch-readiness-batch-8": "node --test scripts/launch-readiness-batch-8.test.mjs",',
        '"test:launch-readiness-batch-8": "node --test scripts/launch-readiness-batch-8.test.mjs",\n    "test:final-user-journeys": "node --test scripts/final-user-journeys.test.mjs",',
        "package final journeys script",
    )
    write(package_path, package_text)

    quality_path = ".github/workflows/quality-gate.yml"
    quality_text = read(quality_path)
    quality_text = replace_once(
        quality_text,
        '''      - name: Launch readiness Batch 8 contract
        run: npm run test:launch-readiness-batch-8

      - name: Desktop Experience V1 contract''',
        '''      - name: Launch readiness Batch 8 contract
        run: npm run test:launch-readiness-batch-8

      - name: Final user journeys contract
        run: npm run test:final-user-journeys

      - name: Desktop Experience V1 contract''',
        "quality gate final journeys step",
    )
    write(quality_path, quality_text)


patch_more()
patch_add_listing()
patch_manage_listing()
patch_listing_detail()
patch_seller()
patch_chats()
add_contract()
patch_package_and_quality_gate()
