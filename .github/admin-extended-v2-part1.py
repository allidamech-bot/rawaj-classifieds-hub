from pathlib import Path
import re

ROOT = Path('.')

def read(path):
    return (ROOT / path).read_text()

def write(path, text):
    (ROOT / path).write_text(text)

def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f'missing exact block: {label}')
    return text.replace(old, new, 1)

def sub_once(text, pattern, replacement, label, flags=re.S):
    result, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f'missing regex block: {label} ({count})')
    return result


def patch_listings():
    path = 'src/routes/admin.listings.tsx'
    text = read(path)
    text = replace_once(
        text,
        'import { useEffect, useMemo, useState } from "react";',
        'import { useCallback, useEffect, useMemo, useRef, useState } from "react";',
        'listings imports',
    )
    text = replace_once(
        text,
'''  const [listings, setListings] = useState<AdminModerationListingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [extendDays, setExtendDays] = useState<Record<string, number>>({});
  const [workingId, setWorkingId] = useState<string | null>(null);

  async function loadListings() {
    setLoading(true);
    setError("");
    const result = await adminFetchModerationListings(canModerateListings);
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      setListings([]);
      return;
    }
    setListings(result.data);
  }

  useEffect(() => {
    void loadListings();
  }, [canModerateListings]);''',
'''  const [listings, setListings] = useState<AdminModerationListingSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [extendDays, setExtendDays] = useState<Record<string, number>>({});
  const [workingId, setWorkingId] = useState<string | null>(null);
  const loadRequestIdRef = useRef(0);
  const actionInFlightRef = useRef<Set<string>>(new Set());

  const loadListings = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    setLoading(true);
    setLoadError("");
    const result = await adminFetchModerationListings(canModerateListings);
    if (requestId !== loadRequestIdRef.current) return;
    setLoading(false);
    if (!result.ok) {
      setLoadError(result.error.message);
      return;
    }
    setListings(result.data);
    setHasLoaded(true);
  }, [canModerateListings]);

  useEffect(() => {
    loadRequestIdRef.current += 1;
    setListings([]);
    setHasLoaded(false);
    setLoadError("");
    void loadListings();
    return () => {
      loadRequestIdRef.current += 1;
      actionInFlightRef.current.clear();
    };
  }, [loadListings]);''',
        'listings load state',
    )
    text = sub_once(
        text,
        r'''  async function applyAction\(\n    listing: AdminModerationListingSummary,\n    action: AdminListingModerationAction,\n  \) \{.*?\n  \}\n\n  if \(!canModerateListings\) \{''',
'''  async function applyAction(
    listing: AdminModerationListingSummary,
    action: AdminListingModerationAction,
  ) {
    const actionKey = `${listing.id}:${action}`;
    if (actionInFlightRef.current.has(actionKey)) return;
    setActionMessage("");
    const reason = reasons[listing.id]?.trim() ?? "";
    if (reason.length < 3) {
      setActionMessage(
        text(
          "أدخل سبباً واضحاً قبل تنفيذ القرار.",
          "Enter a clear reason before applying the action.",
        ),
      );
      return;
    }

    actionInFlightRef.current.add(actionKey);
    setWorkingId(listing.id);
    try {
      const result = await adminApplyListingModerationAction(canModerateListings, {
        listingId: listing.id,
        action,
        reason,
        expectedUpdatedAt: listing.updatedAt,
        extendDays: action === "extend_expiry" ? (extendDays[listing.id] ?? 30) : null,
      });

      if (!result.ok) {
        setActionMessage(result.error.message);
        if (result.error.code === "stale_review") await loadListings();
        return;
      }

      setActionMessage(
        text(
          "تم تنفيذ القرار وتسجيله في سجل التدقيق.",
          "Action applied and recorded in the audit log.",
        ),
      );
      setReasons((current) => ({ ...current, [listing.id]: "" }));
      await loadListings();
    } finally {
      actionInFlightRef.current.delete(actionKey);
      setWorkingId((current) => (current === listing.id ? null : current));
    }
  }

  if (!canModerateListings) {''',
        'listings action',
    )
    text = replace_once(text, '{message && (', '{actionMessage && (', 'listings message condition')
    text = replace_once(text, '{message}</p>', '{actionMessage}</p>', 'listings message value')
    text = replace_once(
        text,
'''      {error && (
        <p className="rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive hairline">
          {error}
        </p>
      )}

      {loading ? (
        <StatePanel title={text("جارٍ تحميل الإعلانات...", "Loading listings...")} />
      ) : visibleListings.length === 0 ? (''',
'''      {loadError && hasLoaded ? (
        <p className="rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive hairline">
          {loadError}
          <button
            type="button"
            onClick={() => void loadListings()}
            className="ms-2 underline"
          >
            {text("إعادة المحاولة", "Try again")}
          </button>
        </p>
      ) : null}

      {loading && !hasLoaded ? (
        <StatePanel title={text("جارٍ تحميل الإعلانات...", "Loading listings...")} />
      ) : loadError && !hasLoaded ? (
        <StatePanel
          title={text("تعذر تحميل الإعلانات", "Could not load listings")}
          body={loadError}
          actionLabel={text("إعادة المحاولة", "Try again")}
          onAction={() => void loadListings()}
        />
      ) : visibleListings.length === 0 ? (''',
        'listings UI states',
    )
    text = replace_once(
        text,
'''function StatePanel({ title }: { title: string }) {
  return (
    <div className="rounded-2xl bg-card p-8 text-center text-sm font-bold hairline">{title}</div>
  );
}''',
'''function StatePanel({
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
    <div className="rounded-2xl bg-card p-8 text-center hairline">
      <p className="text-sm font-bold">{title}</p>
      {body ? <p className="mt-2 text-xs text-muted-foreground">{body}</p> : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}''',
        'listings state panel',
    )
    write(path, text)


def patch_verifications():
    path = 'src/routes/admin.verifications.tsx'
    text = read(path)
    text = replace_once(
        text,
        'import { useEffect, useState } from "react";',
        'import { useCallback, useEffect, useRef, useState } from "react";',
        'verification imports',
    )
    text = sub_once(
        text,
        r'''  const \[requests, setRequests\].*?\n  useEffect\(\(\) => \{\n    void load\(\);\n  \}, \[canManageVerifications\]\);''',
'''  const [requests, setRequests] = useState<SellerVerificationRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [documentErrors, setDocumentErrors] = useState<Record<string, string>>({});
  const [loadingDocumentId, setLoadingDocumentId] = useState<string | null>(null);
  const [workingRequestId, setWorkingRequestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<ClassifiedsError | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const loadRequestIdRef = useRef(0);
  const documentInFlightRef = useRef<Set<string>>(new Set());
  const actionInFlightRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    setLoading(true);
    setLoadError(null);
    const result = await adminFetchVerificationRequests(canManageVerifications);
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
  }, [canManageVerifications]);

  useEffect(() => {
    loadRequestIdRef.current += 1;
    setRequests([]);
    setHasLoaded(false);
    setLoadError(null);
    setDocumentUrls({});
    setDocumentErrors({});
    void load();
    return () => {
      loadRequestIdRef.current += 1;
      documentInFlightRef.current.clear();
      actionInFlightRef.current.clear();
    };
  }, [load]);''',
        'verification load state',
    )
    text = sub_once(
        text,
        r'''  async function loadSecureDocument\(request: SellerVerificationRequest\) \{.*?\n  \}\n\n  async function moderate\(request: SellerVerificationRequest, status: "approved" \| "rejected"\) \{.*?\n  \}''',
'''  async function loadSecureDocument(request: SellerVerificationRequest) {
    if (!request.documentPath || documentInFlightRef.current.has(request.id)) return;
    documentInFlightRef.current.add(request.id);
    setActionMessage("");
    setDocumentErrors((current) => ({ ...current, [request.id]: "" }));
    setLoadingDocumentId(request.id);
    try {
      const result = await adminCreateVerificationDocumentSignedUrl(
        canManageVerifications,
        request.documentPath,
      );

      if (!result.ok) {
        setDocumentErrors((current) => ({ ...current, [request.id]: result.error.message }));
        return;
      }
      if (!result.data) {
        setDocumentErrors((current) => ({
          ...current,
          [request.id]: text("لا توجد وثيقة مرتبطة بهذا الطلب.", "No evidence is linked to this request."),
        }));
        return;
      }
      setDocumentUrls((current) => ({ ...current, [request.id]: result.data as string }));
    } finally {
      documentInFlightRef.current.delete(request.id);
      setLoadingDocumentId((current) => (current === request.id ? null : current));
    }
  }

  async function moderate(request: SellerVerificationRequest, status: "approved" | "rejected") {
    if (actionInFlightRef.current.has(request.id)) return;
    actionInFlightRef.current.add(request.id);
    setWorkingRequestId(request.id);