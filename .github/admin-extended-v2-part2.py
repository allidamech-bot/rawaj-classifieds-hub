    setActionMessage("");
    try {
      const result = await adminModerateVerificationRequest(canManageVerifications, {
        requestId: request.id,
        status,
        adminNote: notes[request.id] ?? null,
        expectedUpdatedAt: request.updatedAt,
      });
      if (!result.ok) {
        setActionMessage(result.error.message);
        return;
      }
      setRequests((current) =>
        current.map((item) => (item.id === request.id ? { ...item, status } : item)),
      );
      setActionMessage(
        status === "approved"
          ? text("تم توثيق الحساب.", "Account verified.")
          : text("تم رفض طلب التوثيق.", "Verification rejected."),
      );
      await load();
    } finally {
      actionInFlightRef.current.delete(request.id);
      setWorkingRequestId((current) => (current === request.id ? null : current));
    }
  }''',
        'verification actions',
    )
    text = replace_once(text, '{notice ? (', '{actionMessage ? (', 'verification notice condition')
    text = replace_once(text, '{notice}</p>', '{actionMessage}</p>', 'verification notice value')
    text = replace_once(
        text,
'''      {loading ? (
        <Panel title={text("جارٍ تحميل طلبات التوثيق", "Loading verification requests")} />
      ) : error ? (
        <Panel
          title={text("تعذر تحميل طلبات التوثيق", "Could not load verification requests")}
          body={error.message}
        />
      ) : requests.length === 0 ? (''',
'''      {loadError && hasLoaded ? (
        <Panel
          title={text("تعذر تحديث طلبات التوثيق", "Could not refresh verification requests")}
          body={loadError.message}
          actionLabel={text("إعادة المحاولة", "Try again")}
          onAction={() => void load()}
        />
      ) : null}

      {loading && !hasLoaded ? (
        <Panel title={text("جارٍ تحميل طلبات التوثيق", "Loading verification requests")} />
      ) : loadError && !hasLoaded ? (
        <Panel
          title={text("تعذر تحميل طلبات التوثيق", "Could not load verification requests")}
          body={loadError.message}
          actionLabel={text("إعادة المحاولة", "Try again")}
          onAction={() => void load()}
        />
      ) : requests.length === 0 ? (''',
        'verification UI states',
    )
    text = replace_once(
        text,
'''                        {loadingDocumentId === request.id
                          ? text("جارٍ إنشاء رابط خاص", "Creating private link")
                          : text("تحميل الوثيقة بأمان", "Load secure document")}''',
'''                        {loadingDocumentId === request.id
                          ? text("جارٍ إنشاء رابط خاص", "Creating private link")
                          : documentErrors[request.id]
                            ? text("إعادة محاولة فتح الوثيقة", "Retry secure document")
                            : text("تحميل الوثيقة بأمان", "Load secure document")}''',
        'verification document label',
    )
    text = replace_once(
        text,
'''                    )
                  ) : (
                    <span className="text-[10px] text-muted-foreground">''',
'''                    )
                  ) : (
                    <span className="text-[10px] text-muted-foreground">''',
        'verification stable no-op anchor',
    )
    # Add document error message after the document action row.
    text = replace_once(
        text,
'''                </div>
                {documentUrls[request.id] ? (
                  <p className="mt-2 text-[10px] text-muted-foreground">''',
'''                </div>
                {documentErrors[request.id] ? (
                  <p className="mt-2 text-[10px] font-semibold text-destructive">
                    {documentErrors[request.id]}
                  </p>
                ) : null}
                {documentUrls[request.id] ? (
                  <p className="mt-2 text-[10px] text-muted-foreground">''',
        'verification document error UI',
    )
    text = replace_once(
        text,
'''function Panel({ title, body }: { title: string; body?: string }) {
  return (
    <section className="rounded-2xl bg-card p-8 text-center hairline">
      <p className="text-sm font-bold">{title}</p>
      {body ? <p className="mt-1 text-xs text-muted-foreground">{body}</p> : null}
    </section>
  );
}''',
'''function Panel({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <section className="rounded-2xl bg-card p-8 text-center hairline">
      <p className="text-sm font-bold">{title}</p>
      {body ? <p className="mt-1 text-xs text-muted-foreground">{body}</p> : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
        >
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}''',
        'verification panel',
    )
    write(path, text)


def patch_promotions():
    path = 'src/routes/admin.promotions.tsx'
    text = read(path)
    text = replace_once(
        text,
        'import { useEffect, useState } from "react";',
        'import { useCallback, useEffect, useRef, useState } from "react";',
        'promotion imports',
    )
    text = sub_once(
        text,
        r'''  const \[requests, setRequests\].*?\n  useEffect\(\(\) => \{\n    void load\(\);\n  \}, \[canManagePromotions\]\);''',
'''  const [requests, setRequests] = useState<ListingPromotionRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [receiptUrls, setReceiptUrls] = useState<Record<string, string | null>>({});
  const [receiptErrors, setReceiptErrors] = useState<Record<string, string>>({});
  const [receiptLoadingId, setReceiptLoadingId] = useState<string | null>(null);
  const [workingRequestId, setWorkingRequestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<ClassifiedsError | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const loadRequestIdRef = useRef(0);
  const receiptInFlightRef = useRef<Set<string>>(new Set());
  const actionInFlightRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    setLoading(true);
    setLoadError(null);
    const result = await adminFetchPromotionRequests(canManagePromotions);
    if (requestId !== loadRequestIdRef.current) return;
    setLoading(false);
    if (!result.ok) {
      setLoadError(result.error);
      return;
    }
    setRequests(result.data);
    setNotes((current) => ({
      ...current,
      ...Object.fromEntries(result.data.map((item) => [item.id, current[item.id] ?? item.adminNote ?? ""])),
    }));
    setHasLoaded(true);
  }, [canManagePromotions]);

  useEffect(() => {
    loadRequestIdRef.current += 1;
    setRequests([]);
    setHasLoaded(false);
    setLoadError(null);
    setReceiptUrls({});
    setReceiptErrors({});
    void load();
    return () => {
      loadRequestIdRef.current += 1;
      receiptInFlightRef.current.clear();
      actionInFlightRef.current.clear();
    };
  }, [load]);

  async function loadReceipt(request: ListingPromotionRequest) {
    if (!request.proofPath || receiptInFlightRef.current.has(request.id)) return;
    receiptInFlightRef.current.add(request.id);
    setReceiptLoadingId(request.id);
    setReceiptErrors((current) => ({ ...current, [request.id]: "" }));
    try {
      const result = await createPromotionReceiptSignedUrl(request.proofPath);
      if (!result.ok) {
        setReceiptErrors((current) => ({ ...current, [request.id]: result.error.message }));
        return;
      }
      setReceiptUrls((current) => ({ ...current, [request.id]: result.data }));
    } finally {
      receiptInFlightRef.current.delete(request.id);
      setReceiptLoadingId((current) => (current === request.id ? null : current));
    }
  }''',
        'promotion load state',
    )
    text = sub_once(
        text,
        r'''  async function moderate\(request: ListingPromotionRequest, status: "approved" \| "rejected"\) \{.*?\n  \}''',
'''  async function moderate(request: ListingPromotionRequest, status: "approved" | "rejected") {
    if (actionInFlightRef.current.has(request.id)) return;
    actionInFlightRef.current.add(request.id);
    setWorkingRequestId(request.id);
    setActionMessage("");
    try {
      const result = await adminModeratePromotionRequest(canManagePromotions, {
        requestId: request.id,
        status,
        adminNote: notes[request.id] ?? null,
        expectedUpdatedAt: request.updatedAt,
      });
      if (!result.ok) {
        setActionMessage(result.error.message);
        return;
      }
      setRequests((current) =>
        current.map((item) => (item.id === request.id ? { ...item, status } : item)),
      );
      setActionMessage(
        status === "approved"
          ? text("تم اعتماد الترويج.", "Promotion approved.")
          : text("تم رفض الترويج.", "Promotion rejected."),
      );
      await load();
    } finally {
      actionInFlightRef.current.delete(request.id);
      setWorkingRequestId((current) => (current === request.id ? null : current));
    }
  }''',
        'promotion action',
    )
    text = replace_once(text, '{notice && (', '{actionMessage && (', 'promotion notice condition')
    text = replace_once(text, '{notice}</p>', '{actionMessage}</p>', 'promotion notice value')
    text = replace_once(
        text,
'''      {loading ? (
        <Panel title={text("جارٍ تحميل طلبات الترويج", "Loading promotion requests")} />
      ) : error ? (
        <Panel
          title={text("تعذر تحميل طلبات الترويج", "Could not load promotion requests")}
          body={error.message}
        />
      ) : requests.length === 0 ? (''',
'''      {loadError && hasLoaded ? (
        <Panel
          title={text("تعذر تحديث طلبات الترويج", "Could not refresh promotion requests")}
          body={loadError.message}
          actionLabel={text("إعادة المحاولة", "Try again")}
          onAction={() => void load()}
        />
      ) : null}

      {loading && !hasLoaded ? (
        <Panel title={text("جارٍ تحميل طلبات الترويج", "Loading promotion requests")} />
      ) : loadError && !hasLoaded ? (
        <Panel
          title={text("تعذر تحميل طلبات الترويج", "Could not load promotion requests")}
          body={loadError.message}
          actionLabel={text("إعادة المحاولة", "Try again")}
          onAction={() => void load()}
        />
      ) : requests.length === 0 ? (''',
        'promotion UI states',
    )
    text = sub_once(
        text,
        r'''                      \) : \(\n                        <span className="rounded-lg bg-muted-surface px-2 py-1 font-bold text-muted-foreground hairline">\n                          \{receiptErrors\[request.id\].*?\n                        </span>\n                      \)''',
'''                      ) : (
                        <button
                          type="button"
                          disabled={receiptLoadingId === request.id}
                          onClick={() => void loadReceipt(request)}
                          className="rounded-lg bg-muted-surface px-2 py-1 font-bold text-muted-foreground hairline disabled:opacity-60"
                        >
                          {receiptLoadingId === request.id
                            ? text("جارٍ إنشاء رابط الإيصال", "Creating receipt link")
                            : receiptErrors[request.id]
                              ? text("إعادة محاولة فتح الإيصال", "Retry receipt")
                              : text("فتح الإيصال بأمان", "Open receipt securely")}
                        </button>
                      )''',
        'promotion receipt UI',
    )
    text = replace_once(
        text,
'''function Panel({ title, body }: { title: string; body?: string }) {
  return (
    <section className="rounded-2xl bg-card p-8 text-center hairline">
      <p className="text-sm font-bold">{title}</p>
      {body && <p className="mt-1 text-xs text-muted-foreground">{body}</p>}
    </section>
  );
}''',
'''function Panel({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <section className="rounded-2xl bg-card p-8 text-center hairline">
      <p className="text-sm font-bold">{title}</p>