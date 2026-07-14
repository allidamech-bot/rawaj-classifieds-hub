import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, ExternalLink, FileKey2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  adminCreateVerificationDocumentSignedUrl,
  adminFetchVerificationRequests,
  adminModerateVerificationRequest,
} from "@/lib/classifieds-api";
import type { ClassifiedsError, SellerVerificationRequest } from "@/lib/classifieds-types";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/admin/verifications")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: AdminVerificationsPage,
});

function AdminVerificationsPage() {
  const auth = useAuth();
  const { text } = useUiPreferences();
  const canManageVerifications = auth.hasPermission("canManageVerifications");
  const [requests, setRequests] = useState<SellerVerificationRequest[]>([]);
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
      ...Object.fromEntries(
        result.data.map((item) => [item.id, current[item.id] ?? item.adminNote ?? ""]),
      ),
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
  }, [load]);

  async function loadSecureDocument(request: SellerVerificationRequest) {
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
          [request.id]: text(
            "لا توجد وثيقة مرتبطة بهذا الطلب.",
            "No evidence is linked to this request.",
          ),
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
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-card p-4 hairline">
        <h2 className="flex items-center gap-2 text-base font-extrabold">
          <BadgeCheck className="h-4 w-4 text-emerald-trust" />
          {text("طلبات توثيق البائعين", "Seller verification requests")}
        </h2>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">
          {text(
            "راجع الطلب والوثيقة الخاصة عبر رابط مؤقت. الشارة العامة لا تظهر إلا بعد الموافقة.",
            "Review the request and private evidence through a temporary link. Public verified status appears after approval only.",
          )}
        </p>
        {actionMessage ? (
          <p className="mt-3 rounded-xl bg-muted-surface p-2 text-xs font-semibold">
            {actionMessage}
          </p>
        ) : null}
      </section>

      {loadError && hasLoaded ? (
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
      ) : requests.length === 0 ? (
        <Panel title={text("لا توجد طلبات توثيق حالياً", "No verification requests right now")} />
      ) : (
        <div className="grid gap-3">
          {requests.map((request) => (
            <article key={request.id} className="rounded-2xl bg-card p-4 hairline">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-extrabold">{request.legalName}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {verificationTypeLabel(request.requestType, text)} · {request.userId}
                  </p>
                  {request.businessName ? (
                    <p className="mt-1 text-xs">{request.businessName}</p>
                  ) : null}
                  {request.documentType ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {text("نوع المستند:", "Document type:")}{" "}
                      {verificationDocumentTypeLabel(request.documentType, text)}
                    </p>
                  ) : null}
                </div>
                <span className="rounded-md bg-muted-surface px-2 py-1 text-[10px] font-bold hairline">
                  {verificationStatusLabel(request.status, text)}
                </span>
              </div>

              <div className="mt-3 rounded-xl bg-muted-surface p-3 hairline">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-bold">
                    <FileKey2 className="h-4 w-4 text-primary" />
                    {text("وثيقة خاصة", "Private evidence")}
                  </span>
                  {request.documentPath ? (
                    documentUrls[request.id] ? (
                      <a
                        href={documentUrls[request.id]}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                      >
                        <ExternalLink className="h-4 w-4" />
                        {text("فتح الوثيقة", "Open document")}
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled={loadingDocumentId === request.id}
                        onClick={() => void loadSecureDocument(request)}
                        className="inline-flex min-h-11 items-center rounded-xl bg-card px-3 py-2 text-xs font-bold hairline disabled:opacity-60"
                      >
                        {loadingDocumentId === request.id
                          ? text("جارٍ إنشاء رابط خاص", "Creating private link")
                          : documentErrors[request.id]
                            ? text("إعادة محاولة فتح الوثيقة", "Retry secure document")
                            : text("تحميل الوثيقة بأمان", "Load secure document")}
                      </button>
                    )
                  ) : (
                    <span className="text-[10px] text-muted-foreground">
                      {text("طلب قديم بلا وثيقة", "Legacy request without evidence")}
                    </span>
                  )}
                </div>
                {documentErrors[request.id] ? (
                  <p className="mt-2 text-[10px] font-semibold text-destructive">
                    {documentErrors[request.id]}
                  </p>
                ) : null}
                {documentUrls[request.id] ? (
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    {text(
                      "الرابط مؤقت وخاص بحساب المراجع المخول.",
                      "The link is temporary and restricted to authorized review access.",
                    )}
                  </p>
                ) : null}
              </div>

              <textarea
                value={notes[request.id] ?? ""}
                onChange={(event) =>
                  setNotes((current) => ({ ...current, [request.id]: event.target.value }))
                }
                maxLength={1000}
                rows={2}
                placeholder={text("ملاحظة إدارية", "Admin note")}
                className="mt-3 w-full rounded-xl bg-muted-surface px-3 py-2 text-xs outline-none hairline"
              />

              {request.status === "pending_review" ? (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void moderate(request, "approved")}
                    className="inline-flex min-h-11 items-center rounded-xl bg-emerald-trust px-3 py-2 text-xs font-bold text-emerald-trust-foreground"
                  >
                    {text("موافقة", "Approve")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void moderate(request, "rejected")}
                    className="inline-flex min-h-11 items-center rounded-xl bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground"
                  >
                    {text("رفض", "Reject")}
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Panel({
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
}

function verificationStatusLabel(
  status: SellerVerificationRequest["status"],
  text: (ar: string, en: string) => string,
) {
  if (status === "approved") return text("موثق", "Verified");
  if (status === "rejected") return text("مرفوض", "Rejected");
  return text("قيد المراجعة", "Pending review");
}

function verificationTypeLabel(
  type: SellerVerificationRequest["requestType"],
  text: (ar: string, en: string) => string,
) {
  return type === "business" ? text("منشأة", "Business") : text("فرد", "Individual");
}

function verificationDocumentTypeLabel(type: string, text: (ar: string, en: string) => string) {
  const labels: Record<string, [string, string]> = {
    national_id: ["هوية وطنية", "National ID"],
    passport: ["جواز سفر", "Passport"],
    other_government_id: ["هوية حكومية أخرى", "Other government ID"],
    commercial_registration: ["سجل تجاري", "Commercial registration"],
    business_license: ["رخصة منشأة", "Business license"],
    tax_document: ["وثيقة ضريبية", "Tax document"],
  };
  const label = labels[type];
  return label ? text(label[0], label[1]) : type;
}
