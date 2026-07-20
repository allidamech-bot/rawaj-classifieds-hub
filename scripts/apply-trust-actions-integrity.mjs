import { readFile, rm, writeFile } from "node:fs/promises";

async function transform(path, mutate) {
  const source = await readFile(path, "utf8");
  const next = mutate(source);
  if (next === source) throw new Error(`${path}: transformation made no changes`);
  await writeFile(path, next);
}
function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}
function replaceRegexOnce(source, pattern, replacement, label) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const count = [...source.matchAll(new RegExp(pattern.source, flags))].length;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(pattern, replacement);
}

await transform("src/routes/support.tsx", (initial) => {
  let source = initial;
  source = replaceRegexOnce(
    source,
    /  const loadRequests = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[profileId\]\);/,
    `  const loadRequests = useCallback(async () => {
    if (!profileId) return;
    const currentProfileId = profileId;
    const requestId = ++requestsRequestIdRef.current;
    setRequestsLoading(true);
    setRequestsError(null);
    try {
      const result = await fetchMySupportRequests();
      if (requestId !== requestsRequestIdRef.current || currentProfileId !== profileIdRef.current) {
        return;
      }
      if (result.ok) {
        setRequests(result.data);
        setRequestsHasLoaded(true);
      } else {
        setRequestsError(result.error);
      }
    } catch (caught) {
      if (requestId !== requestsRequestIdRef.current || currentProfileId !== profileIdRef.current) {
        return;
      }
      setRequestsError({
        code: "unknown",
        message:
          caught instanceof Error
            ? caught.message
            : text("تعذر تحميل طلبات الدعم.", "Could not load support requests."),
        operation: "support_requests_load",
      });
    } finally {
      if (requestId === requestsRequestIdRef.current && currentProfileId === profileIdRef.current) {
        setRequestsLoading(false);
      }
    }
  }, [profileId, text]);`,
    "support history lifecycle",
  );
  source = replaceOnce(
    source,
    `    const payload = {\n      type: requestType,\n      subject,\n      message,\n      relatedListingId: relatedListingId || null,\n    };`,
    `    const cleanSubject = subject.trim();\n    const cleanMessage = message.trim();\n    const cleanRelatedListingId = relatedListingId.trim();\n    if (cleanSubject.length < 4) {\n      setNotice(text("اكتب عنواناً واضحاً من 4 أحرف على الأقل.", "Enter a clear subject of at least 4 characters."));\n      return;\n    }\n    if (cleanMessage.length < 10) {\n      setNotice(text("اكتب تفاصيل كافية من 10 أحرف على الأقل.", "Enter at least 10 characters of detail."));\n      return;\n    }\n\n    const payload = {\n      type: requestType,\n      subject: cleanSubject,\n      message: cleanMessage,\n      relatedListingId: cleanRelatedListingId || null,\n    };`,
    "support request validation",
  );
  source = replaceOnce(
    source,
    `      setNotice(text("تم إرسال طلب الدعم للمراجعة.", "Support request submitted for review."));\n    } finally {`,
    `      setNotice(text("تم إرسال طلب الدعم للمراجعة.", "Support request submitted for review."));\n    } catch (caught) {\n      if (currentProfileId === profileIdRef.current) {\n        setNotice(\n          caught instanceof Error\n            ? caught.message\n            : text("تعذر إرسال طلب الدعم.", "Could not submit the support request."),\n        );\n      }\n    } finally {`,
    "support submit exception handling",
  );
  source = replaceOnce(
    source,
    `<form onSubmit={(event) => void submitRequest(event)}>`,
    `<form onSubmit={(event) => void submitRequest(event)} aria-busy={submitting}>`,
    "support form busy state",
  );
  source = source.replaceAll(
    `                      onChange={(event) =>`,
    `                      disabled={submitting}\n                      onChange={(event) =>`,
  );
  source = replaceOnce(source, `                      maxLength={160}`, `                      required\n                      minLength={4}\n                      maxLength={160}`, "support subject constraints");
  source = replaceOnce(source, `                      maxLength={3000}\n                      rows={5}`, `                      required\n                      minLength={10}\n                      maxLength={3000}\n                      rows={5}`, "support message constraints");
  return source;
});

await transform("src/routes/verification.tsx", (initial) => {
  let source = initial;
  source = replaceRegexOnce(
    source,
    /  const loadRequests = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[profileId\]\);/,
    `  const loadRequests = useCallback(async () => {
    if (!profileId) return;
    const requestId = ++requestsRequestIdRef.current;
    setRequestsLoading(true);
    setRequestsError(null);
    const currentProfileId = profileId;
    try {
      const result = await fetchMyVerificationRequests();
      if (requestId !== requestsRequestIdRef.current || currentProfileId !== profileIdRef.current) {
        return;
      }
      if (result.ok) {
        setRequests(result.data);
        setHasLoadedRequests(true);
      } else {
        setRequestsError(result.error);
      }
    } catch (caught) {
      if (requestId !== requestsRequestIdRef.current || currentProfileId !== profileIdRef.current) {
        return;
      }
      setRequestsError({
        code: "unknown",
        message:
          caught instanceof Error
            ? caught.message
            : text("تعذر تحميل طلبات التوثيق.", "Could not load verification requests."),
        operation: "verification_requests_load",
      });
    } finally {
      if (requestId === requestsRequestIdRef.current && currentProfileId === profileIdRef.current) {
        setRequestsLoading(false);
      }
    }
  }, [profileId, text]);`,
    "verification history lifecycle",
  );
  source = replaceOnce(
    source,
    `    if (!documentType || !documentFile) {`,
    `    if (legalName.trim().length < 3) {\n      setNotice(text("اكتب الاسم القانوني بوضوح.", "Enter the legal name clearly."));\n      setNoticeKind("error");\n      return;\n    }\n\n    if (!documentType || !documentFile) {`,
    "verification legal name validation",
  );
  source = replaceOnce(source, `        legalName,`, `        legalName: legalName.trim(),`, "verification trim legal name");
  source = replaceOnce(source, `        businessName: requestType === "business" ? businessName : null,`, `        businessName: requestType === "business" ? businessName.trim() : null,`, "verification trim business name");
  source = replaceOnce(
    source,
    `<form onSubmit={(event) => void submit(event)} className="rounded-2xl bg-card p-4 hairline">`,
    `<form onSubmit={(event) => void submit(event)} aria-busy={saving} className="rounded-2xl bg-card p-4 hairline">`,
    "verification form busy state",
  );
  source = source.replaceAll(`                className="input"`, `                disabled={saving}\n                className="input"`);
  source = source.replaceAll(`                  className="input"`, `                  disabled={saving}\n                  className="input"`);
  source = replaceOnce(source, `               className="mt-3 block`, `               disabled={saving}\n               className="mt-3 block`, "verification file disabled");
  return source;
});

await transform("src/routes/promotion.tsx", (initial) => {
  let source = initial;
  source = replaceOnce(
    source,
    `  const listingsRequestIdRef = useRef(0);\n  const requestsRequestIdRef = useRef(0);`,
    `  const listingsRequestIdRef = useRef(0);\n  const requestsRequestIdRef = useRef(0);\n  const submitInFlightRef = useRef(false);\n  const profileIdRef = useRef<string | null>(profileId);\n  profileIdRef.current = profileId;`,
    "promotion refs",
  );
  source = replaceOnce(
    source,
    `  const durationOptions = [3, 7, 14, 30];`,
    `  const durationOptions = [3, 7, 14, 30];\n  const hasPendingForSelectedListing = requests.some(\n    (request) => request.listingId === selectedListingId && request.status === "pending_review",\n  );`,
    "promotion pending guard",
  );
  source = replaceRegexOnce(
    source,
    /  const loadListings = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[profileId\]\);/,
    `  const loadListings = useCallback(async () => {
    if (!profileId) return;
    const currentProfileId = profileId;
    const requestId = ++listingsRequestIdRef.current;
    setListingsLoading(true);
    setListingsError(null);
    try {
      const result = await fetchCurrentUserListings(currentProfileId);
      if (requestId !== listingsRequestIdRef.current || currentProfileId !== profileIdRef.current) return;
      if (result.ok) {
        setListings(result.data);
        setHasLoadedListings(true);
        setSelectedListingId((current) => {
          const currentStillEligible = result.data.some(
            (item) => item.id === current && item.status === "approved",
          );
          if (currentStillEligible) return current;
          return result.data.find((item) => item.status === "approved")?.id ?? "";
        });
      } else {
        setListingsError(result.error);
      }
    } catch (caught) {
      if (requestId !== listingsRequestIdRef.current || currentProfileId !== profileIdRef.current) return;
      setListingsError({
        code: "unknown",
        message: caught instanceof Error ? caught.message : text("تعذر تحميل إعلاناتك.", "Could not load your listings."),
        operation: "promotion_listings_load",
      });
    } finally {
      if (requestId === listingsRequestIdRef.current && currentProfileId === profileIdRef.current) {
        setListingsLoading(false);
      }
    }
  }, [profileId, text]);`,
    "promotion listings lifecycle",
  );
  source = replaceRegexOnce(
    source,
    /  const loadRequests = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[profileId\]\);/,
    `  const loadRequests = useCallback(async () => {
    if (!profileId) return;
    const currentProfileId = profileId;
    const requestId = ++requestsRequestIdRef.current;
    setRequestsLoading(true);
    setRequestsError(null);
    try {
      const result = await fetchMyPromotionRequests(currentProfileId);
      if (requestId !== requestsRequestIdRef.current || currentProfileId !== profileIdRef.current) return;
      if (result.ok) {
        setRequests(result.data);
        setHasLoadedRequests(true);
      } else {
        setRequestsError(result.error);
      }
    } catch (caught) {
      if (requestId !== requestsRequestIdRef.current || currentProfileId !== profileIdRef.current) return;
      setRequestsError({
        code: "unknown",
        message: caught instanceof Error ? caught.message : text("تعذر تحميل طلبات الترويج.", "Could not load promotion requests."),
        operation: "promotion_requests_load",
      });
    } finally {
      if (requestId === requestsRequestIdRef.current && currentProfileId === profileIdRef.current) {
        setRequestsLoading(false);
      }
    }
  }, [profileId, text]);`,
    "promotion requests lifecycle",
  );
  source = replaceRegexOnce(
    source,
    /  async function submit\(event: FormEvent<HTMLFormElement>\) \{[\s\S]*?\n  \}\n\n  if \(auth\.status !== "signedIn"\)/,
    `  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentProfileId = profileId;
    if (!currentProfileId || submitInFlightRef.current) return;
    setNotice("");
    if (!hasLoadedListings || !hasLoadedRequests || listingsLoading || requestsLoading) {
      setNotice(text("انتظر اكتمال تحميل بياناتك قبل الإرسال.", "Wait until your data finishes loading before submitting."));
      return;
    }
    if (!selectedListingId) {
      setNotice(text("اختر إعلاناً معتمداً.", "Choose an approved listing."));
      return;
    }
    if (hasPendingForSelectedListing) {
      setNotice(text("يوجد طلب ترويج قيد المراجعة لهذا الإعلان.", "A promotion request for this listing is already under review."));
      return;
    }

    submitInFlightRef.current = true;
    setSaving(true);
    try {
      const result = await createListingPromotionRequest({
        listingId: selectedListingId,
        requesterUserId: currentProfileId,
        promotionType,
        requestedDays,
        paymentMethod: paymentMethod.trim() || null,
        paymentReference: paymentReference.trim() || null,
      });
      if (currentProfileId !== profileIdRef.current) return;
      if (!result.ok) {
        setNotice(result.error.message);
        return;
      }

      setRequests((current) => [result.data, ...current.filter((item) => item.id !== result.data.id)]);
      setHasLoadedRequests(true);
      if (receiptFile) {
        const receiptResult = await uploadPromotionReceipt({
          userId: currentProfileId,
          requestId: result.data.id,
          file: receiptFile,
        });
        if (currentProfileId !== profileIdRef.current) return;
        if (!receiptResult.ok) {
          setNotice(
            text(
              "تم إنشاء طلب الترويج، لكن تعذر رفع الإيصال. لا تعِد إرسال الطلب؛ تواصل مع الدعم لإرفاقه.",
              "The promotion request was created, but the receipt could not upload. Do not resubmit; contact support to attach it.",
            ),
          );
          await loadRequests();
          return;
        }
      }
      setNotice(text("تم إرسال طلب الترويج للمراجعة اليدوية.", "Promotion request sent for manual review."));
      setPaymentMethod("");
      setPaymentReference("");
      setReceiptFile(null);
      await loadRequests();
    } catch (caught) {
      if (currentProfileId === profileIdRef.current) {
        setNotice(caught instanceof Error ? caught.message : text("تعذر إرسال طلب الترويج.", "Could not submit the promotion request."));
      }
    } finally {
      submitInFlightRef.current = false;
      if (currentProfileId === profileIdRef.current) setSaving(false);
    }
  }

  if (auth.status !== "signedIn")`,
    "promotion submit lifecycle",
  );
  source = replaceOnce(
    source,
    `               onSubmit={(event) => void submit(event)}\n               className=`,
    `               onSubmit={(event) => void submit(event)}\n               aria-busy={saving}\n               className=`,
    "promotion form busy state",
  );
  source = source.replaceAll(`                     className="input"`, `                     disabled={saving}\n                     className="input"`);
  source = replaceOnce(
    source,
    `                disabled={saving || !selectedListingId}`,
    `                type="submit"\n                disabled={\n                  saving ||\n                  !selectedListingId ||\n                  !hasLoadedListings ||\n                  !hasLoadedRequests ||\n                  hasPendingForSelectedListing\n                }\n                aria-busy={saving}`,
    "promotion submit disabled state",
  );
  return source;
});

await rm("scripts/apply-trust-actions-integrity.mjs", { force: true });
