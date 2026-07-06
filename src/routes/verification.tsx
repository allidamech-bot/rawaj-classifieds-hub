import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, FileText } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  createSellerVerificationRequest,
  fetchMyVerificationRequests,
} from "@/lib/classifieds-api";
import type {
  ClassifiedsError,
  SellerVerificationRequest,
  VerificationRequestType,
} from "@/lib/classifieds-types";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/verification")({
  component: VerificationPage,
});

function VerificationPage() {
  const auth = useAuth();
  const { text } = useUiPreferences();
  const [requests, setRequests] = useState<SellerVerificationRequest[]>([]);
  const [requestType, setRequestType] = useState<VerificationRequestType>("personal");
  const [legalName, setLegalName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const [notice, setNotice] = useState("");
  const profileId = auth.profile?.id ?? null;
  const hasPendingRequest = requests.some(
    (request) => request.status === "pending_review" || String(request.status) === "pending",
  );

  async function loadRequests() {
    if (!profileId) return;
    setLoading(true);
    setError(null);
    const result = await fetchMyVerificationRequests(profileId);
    if (result.ok) setRequests(result.data);
    else setError(result.error);
    setLoading(false);
  }

  useEffect(() => {
    if (auth.status !== "signedIn") return;
    void loadRequests();
  }, [auth.status, profileId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    if (hasPendingRequest) {
      setNotice(
        text(
          "لديك طلب توثيق قيد المراجعة.",
          "You already have a verification request under review.",
        ),
      );
      return;
    }
    setSaving(true);
    const result = await createSellerVerificationRequest({
      userId: profileId,
      requestType,
      legalName,
      businessName: requestType === "business" ? businessName : null,
      documentType: documentType || null,
    });
    setSaving(false);
    if (result.ok) {
      setNotice(
        text(
          "تم إرسال طلب التوثيق للمراجعة اليدوية.",
          "Verification request sent for manual review.",
        ),
      );
      setLegalName("");
      setBusinessName("");
      setDocumentType("");
      await loadRequests();
    } else {
      setNotice(result.error.message);
    }
  }

  if (auth.status !== "signedIn") {
    return (
      <>
        <PageHeader
          title={text("طلب توثيق", "Verification request")}
          to="/more"
          backMode="history"
        />
        <main className="container-wide mobile-page-bottom pt-4">
          <section className="rounded-2xl bg-card p-8 text-center hairline">
            <BadgeCheck className="mx-auto h-8 w-8 text-gold" />
            <h1 className="mt-3 text-base font-extrabold">
              {text("تسجيل الدخول مطلوب", "Login required")}
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-xs leading-6 text-muted-foreground">
              {text(
                "سجّل الدخول لإرسال طلب توثيق تتم مراجعته يدوياً من الإدارة.",
                "Log in to submit a verification request for manual admin review.",
              )}
            </p>
            <Link
              to="/login"
              search={{ returnTo: "/verification" }}
              className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              {text("تسجيل الدخول", "Log in")}
            </Link>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <PageHeader title={text("طلب توثيق", "Verification request")} to="/more" backMode="history" />
      <main className="container-wide mobile-page-bottom space-y-5 pt-4">
        <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-soft">
          <h1 className="text-lg font-extrabold">
            {text("إرسال طلب توثيق للمراجعة", "Submit a verification request")}
          </h1>
          <p className="mt-2 text-xs leading-6 text-primary-foreground/80">
            {text(
              "التوثيق هنا طلب مراجعة يدوي فقط. لا يعني ضمان هوية فوري، ولا يتضمن فحصاً تلقائياً أو كشف حضور حي أو حماية مدفوعات.",
              "Verification here is a manual review request only. It does not mean instant identity proof, automated checks, liveness detection, or payment protection.",
            )}
          </p>
        </section>

        <form onSubmit={(event) => void submit(event)} className="rounded-2xl bg-card p-4 hairline">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={text("نوع الطلب", "Request type")}>
              <select
                value={requestType}
                onChange={(event) => setRequestType(event.target.value as VerificationRequestType)}
                className="input"
              >
                <option value="personal">{text("فرد", "Individual")}</option>
                <option value="business">{text("منشأة", "Business")}</option>
              </select>
            </Field>
            <Field label={text("الاسم القانوني", "Legal name")}>
              <input
                value={legalName}
                onChange={(event) => setLegalName(event.target.value)}
                maxLength={120}
                required
                className="input"
              />
            </Field>
            <Field label={text("اسم المنشأة اختياري", "Business name optional")}>
              <input
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                maxLength={120}
                className="input"
              />
            </Field>
            <Field label={text("نوع المستند اختياري", "Document type optional")}>
              <input
                value={documentType}
                onChange={(event) => setDocumentType(event.target.value)}
                maxLength={80}
                className="input"
              />
            </Field>
          </div>
          <p className="mt-3 rounded-xl bg-muted-surface p-3 text-xs leading-6 text-muted-foreground hairline">
            {text(
              "قد تطلب الإدارة معلومات أو مستندات إضافية عند الحاجة. لا تظهر أي شارة توثيق عامة قبل الموافقة اليدوية.",
              "Admins may request more information or documents when needed. No public verified badge appears before manual approval.",
            )}
          </p>
          {hasPendingRequest && (
            <p className="mt-3 rounded-xl bg-gold/10 p-3 text-xs font-bold text-gold-foreground hairline">
              {text(
                "لديك طلب توثيق قيد المراجعة.",
                "You already have a verification request under review.",
              )}
            </p>
          )}
          <button
            disabled={saving || hasPendingRequest || legalName.trim().length < 3}
            className="mt-3 rounded-xl bg-gold px-4 py-2 text-xs font-bold text-gold-foreground disabled:opacity-60"
          >
            {saving ? text("جارٍ الإرسال", "Sending") : text("إرسال الطلب", "Submit request")}
          </button>
          {notice && (
            <p className="mt-3 rounded-xl bg-muted-surface p-3 text-xs font-semibold">{notice}</p>
          )}
        </form>

        <section className="rounded-2xl bg-card p-4 hairline">
          <h2 className="flex items-center gap-2 text-sm font-extrabold">
            <FileText className="h-4 w-4 text-primary" />
            {text("طلباتي السابقة", "My previous requests")}
          </h2>
          {loading ? (
            <p className="mt-2 text-xs text-muted-foreground">{text("جارٍ التحميل", "Loading")}</p>
          ) : error ? (
            <p className="mt-2 text-xs font-semibold text-destructive">{error.message}</p>
          ) : requests.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {text("لا توجد طلبات توثيق بعد.", "No verification requests yet.")}
            </p>
          ) : (
            <div className="mt-3 grid gap-2">
              {requests.map((request) => (
                <article
                  key={request.id}
                  className="rounded-xl bg-muted-surface p-3 text-xs hairline"
                >
                  <p className="font-bold">{request.legalName}</p>
                  <p className="mt-1 text-muted-foreground">
                    {statusLabel(request.status, text)} · {typeLabel(request.requestType, text)}
                  </p>
                  {request.businessName && (
                    <p className="mt-1 text-muted-foreground">{request.businessName}</p>
                  )}
                  {request.documentType && (
                    <p className="mt-1 text-muted-foreground">{request.documentType}</p>
                  )}
                  {request.adminNote && (
                    <p className="mt-1 text-muted-foreground">{request.adminNote}</p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function statusLabel(
  status: SellerVerificationRequest["status"],
  text: (ar: string, en: string) => string,
) {
  if (status === "approved") return text("مقبول", "Approved");
  if (status === "rejected") return text("مرفوض", "Rejected");
  return text("قيد المراجعة", "Pending review");
}

function typeLabel(type: VerificationRequestType, text: (ar: string, en: string) => string) {
  return type === "business" ? text("منشأة", "Business") : text("فرد", "Individual");
}
