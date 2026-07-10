import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, FileKey2, FileText, Upload } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  createSellerVerificationRequest,
  fetchMyVerificationRequests,
} from "@/lib/classifieds-api";
import type {
  ClassifiedsError,
  SellerVerificationRequest,
  VerificationDocumentType,
  VerificationRequestType,
} from "@/lib/classifieds-types";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

const verificationFileAccept = "image/jpeg,image/png,image/webp,application/pdf";

export const Route = createFileRoute("/verification")({
  head: () => ({
    meta: [
      { title: "طلب توثيق | رواج" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: VerificationPage,
});

function VerificationPage() {
  const auth = useAuth();
  const { text } = useUiPreferences();
  const [requests, setRequests] = useState<SellerVerificationRequest[]>([]);
  const [requestType, setRequestType] = useState<VerificationRequestType>("personal");
  const [legalName, setLegalName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [documentType, setDocumentType] = useState<VerificationDocumentType | "">("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const [notice, setNotice] = useState("");
  const [noticeKind, setNoticeKind] = useState<"success" | "error" | "">("");
  const profileId = auth.profile?.id ?? null;
  const hasPendingRequest = requests.some(
    (request) => request.status === "pending_review" || String(request.status) === "pending",
  );
  const availableDocumentTypes = documentTypeOptions(requestType);
  const businessNameValid = requestType !== "business" || businessName.trim().length >= 3;

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

  function changeRequestType(next: VerificationRequestType) {
    setRequestType(next);
    setDocumentType("");
    setDocumentFile(null);
    if (next === "personal") setBusinessName("");
    setNotice("");
    setNoticeKind("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setNoticeKind("");

    if (hasPendingRequest) {
      setNotice(
        text(
          "لديك طلب توثيق قيد المراجعة.",
          "You already have a verification request under review.",
        ),
      );
      return;
    }

    if (!documentType || !documentFile) {
      setNotice(text("اختر نوع المستند وأرفق الوثيقة.", "Choose a document type and attach the file."));
      setNoticeKind("error");
      return;
    }

    if (!businessNameValid) {
      setNotice(text("اكتب اسم المنشأة القانوني.", "Enter the legal business name."));
      setNoticeKind("error");
      return;
    }

    setSaving(true);
    const result = await createSellerVerificationRequest({
      userId: profileId,
      requestType,
      legalName,
      businessName: requestType === "business" ? businessName : null,
      documentType,
      documentFile,
    });
    setSaving(false);

    if (result.ok) {
      setNotice(
        text(
          "تم رفع الوثيقة الخاصة وإرسال طلب التوثيق للمراجعة اليدوية.",
          "Private evidence uploaded and verification request sent for manual review.",
        ),
      );
      setNoticeKind("success");
      setLegalName("");
      setBusinessName("");
      setDocumentType("");
      setDocumentFile(null);
      await loadRequests();
    } else {
      setNotice(result.error.message);
      setNoticeKind("error");
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
              className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
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
              "التوثيق مراجعة يدوية لوثيقة خاصة. لا يعني ضمان هوية فوري، ولا يتضمن فحص حضور حي أو حماية مدفوعات.",
              "Verification is a manual review of private evidence. It does not mean instant identity proof, liveness checks, or payment protection.",
            )}
          </p>
        </section>

        <form onSubmit={(event) => void submit(event)} className="rounded-2xl bg-card p-4 hairline">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={text("نوع الطلب", "Request type")}>
              <select
                value={requestType}
                onChange={(event) => changeRequestType(event.target.value as VerificationRequestType)}
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

            {requestType === "business" ? (
              <Field label={text("اسم المنشأة القانوني", "Legal business name")}>
                <input
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  maxLength={120}
                  required
                  className="input"
                />
              </Field>
            ) : null}

            <Field label={text("نوع المستند", "Document type")}>
              <select
                value={documentType}
                onChange={(event) => setDocumentType(event.target.value as VerificationDocumentType)}
                required
                className="input"
              >
                <option value="">{text("اختر نوع المستند", "Choose document type")}</option>
                {availableDocumentTypes.map((option) => (
                  <option key={option.value} value={option.value}>
                    {text(option.ar, option.en)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <label className="mt-4 block rounded-2xl bg-muted-surface p-4 hairline">
            <span className="flex items-center gap-2 text-xs font-bold">
              <Upload className="h-4 w-4 text-primary" />
              {text("وثيقة التوثيق الخاصة", "Private verification document")}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              required
              onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
              className="mt-3 block w-full text-xs file:me-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-card file:px-3 file:py-2 file:font-bold file:text-foreground"
            />
            {documentFile ? (
              <span className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <FileKey2 className="h-4 w-4" />
                <span className="min-w-0 truncate">{documentFile.name}</span>
                <span className="shrink-0">{formatFileSize(documentFile.size)}</span>
              </span>
            ) : null}
            <span className="mt-2 block text-[11px] leading-5 text-muted-foreground">
              {text(
                "JPG أو PNG أو WebP أو PDF، بحد أقصى 10 MB. تحفظ الوثيقة في مساحة خاصة ولا تستخدم كرابط عام.",
                "JPG, PNG, WebP or PDF up to 10 MB. Evidence is stored privately and is never exposed as a public URL.",
              )}
            </span>
          </label>

          <p className="mt-3 rounded-xl bg-muted-surface p-3 text-xs leading-6 text-muted-foreground hairline">
            {text(
              "لا تظهر أي شارة توثيق عامة قبل الموافقة اليدوية. يمكن للمراجعين المخولين فقط فتح الوثيقة عبر رابط خاص مؤقت.",
              "No public verified badge appears before manual approval. Only authorized reviewers can open evidence through a temporary private link.",
            )}
          </p>

          {hasPendingRequest ? (
            <p className="mt-3 rounded-xl bg-gold/10 p-3 text-xs font-bold text-gold-foreground hairline">
              {text(
                "لديك طلب توثيق قيد المراجعة.",
                "You already have a verification request under review.",
              )}
            </p>
          ) : null}

          <button
            disabled={
              saving ||
              hasPendingRequest ||
              legalName.trim().length < 3 ||
              !businessNameValid ||
              !documentType ||
              !documentFile
            }
            className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-gold px-4 py-2 text-xs font-bold text-gold-foreground disabled:opacity-60"
          >
            {saving ? text("جارٍ الرفع والإرسال", "Uploading and sending") : text("إرسال الطلب", "Submit request")}
          </button>

          {notice ? (
            <p
              className={`mt-3 rounded-xl p-3 text-xs font-semibold ${
                noticeKind === "success"
                  ? "bg-emerald-trust/10 text-emerald-trust"
                  : noticeKind === "error"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted-surface"
              }`}
            >
              {notice}
            </p>
          ) : null}
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
                <article key={request.id} className="rounded-xl bg-muted-surface p-3 text-xs hairline">
                  <p className="font-bold">{request.legalName}</p>
                  <p className="mt-1 text-muted-foreground">
                    {statusLabel(request.status, text)} · {typeLabel(request.requestType, text)}
                  </p>
                  {request.businessName ? (
                    <p className="mt-1 text-muted-foreground">{request.businessName}</p>
                  ) : null}
                  {request.documentType ? (
                    <p className="mt-1 text-muted-foreground">
                      {verificationDocumentTypeLabel(request.documentType, text)}
                    </p>
                  ) : null}
                  {request.documentPath ? (
                    <p className="mt-1 text-[10px] font-bold text-emerald-trust">
                      {text("وثيقة خاصة مرفقة", "Private evidence attached")}
                    </p>
                  ) : (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {text("طلب قديم بلا وثيقة مرفقة", "Legacy request without attached evidence")}
                    </p>
                  )}
                  {request.adminNote ? (
                    <p className="mt-1 text-muted-foreground">{request.adminNote}</p>
                  ) : null}
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

function documentTypeOptions(type: VerificationRequestType) {
  if (type === "business") {
    return [
      { value: "commercial_registration" as const, ar: "سجل تجاري", en: "Commercial registration" },
      { value: "business_license" as const, ar: "رخصة منشأة", en: "Business license" },
      { value: "tax_document" as const, ar: "وثيقة ضريبية", en: "Tax document" },
    ];
  }
  return [
    { value: "national_id" as const, ar: "هوية وطنية", en: "National ID" },
    { value: "passport" as const, ar: "جواز سفر", en: "Passport" },
    { value: "other_government_id" as const, ar: "هوية حكومية أخرى", en: "Other government ID" },
  ];
}

function verificationDocumentTypeLabel(
  type: string,
  text: (ar: string, en: string) => string,
) {
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

function formatFileSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
