import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, CheckCircle2, FileKey2, ShieldCheck, Upload, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
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

export const Route = createFileRoute("/verification")({
  head: () => ({
    meta: [{ title: "طلب توثيق | رواج" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: VerificationPage,
});

const eligibilityRules = [
  ["حساب نشط منذ 7 أيام على الأقل", "An active account that is at least 7 days old"],
  ["اسم وهوية عامة وموقع مكتملان في الملف الشخصي", "A completed public name/identity and location"],
  ["وجود إعلان واحد معتمد على الأقل", "At least one approved listing"],
  ["عدم وجود تعليق أو تقييد نشط على الحساب", "No active suspension or account restriction"],
  ["عدم وجود طلب توثيق آخر قيد المراجعة", "No other verification request under review"],
  [
    "وثيقة حكومية أو تجارية مطابقة لنوع الطلب",
    "A valid government or business document matching the request type",
  ],
] as const;

function VerificationPage() {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const [requests, setRequests] = useState<SellerVerificationRequest[]>([]);
  const [requestType, setRequestType] = useState<VerificationRequestType>("personal");
  const [legalName, setLegalName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [documentType, setDocumentType] = useState<VerificationDocumentType | "">("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [hasLoadedRequests, setHasLoadedRequests] = useState(false);
  const [saving, setSaving] = useState(false);
  const [requestsError, setRequestsError] = useState<ClassifiedsError | null>(null);
  const [notice, setNotice] = useState("");
  const [noticeKind, setNoticeKind] = useState<"success" | "error" | "">("");
  const requestsRequestIdRef = useRef(0);
  const submissionRequestIdRef = useRef(0);
  const submitInFlightRef = useRef(false);
  const profileId = auth.profile?.id ?? null;
  const profileIdRef = useRef<string | null>(profileId);
  profileIdRef.current = profileId;

  const alreadyVerified = auth.profile?.verificationStatus === "verified";
  const hasPendingRequest = requests.some(
    (request) => request.status === "pending_review" || String(request.status) === "pending",
  );
  const availableDocumentTypes = documentTypeOptions(requestType);

  const loadRequests = useCallback(async () => {
    if (!profileId) return;
    const requestId = ++requestsRequestIdRef.current;
    setRequestsLoading(true);
    setRequestsError(null);
    try {
      const result = await fetchMyVerificationRequests();
      if (requestId !== requestsRequestIdRef.current || profileId !== profileIdRef.current) return;
      if (result.ok) {
        setRequests(result.data);
        setHasLoadedRequests(true);
      } else {
        setRequestsError(result.error);
      }
    } catch (caught) {
      if (requestId !== requestsRequestIdRef.current || profileId !== profileIdRef.current) return;
      setRequestsError({
        code: "unknown",
        message:
          caught instanceof Error
            ? caught.message
            : text("تعذر تحميل سجل التوثيق.", "Could not load verification history."),
        operation: "verification_requests_load",
      });
    } finally {
      if (requestId === requestsRequestIdRef.current && profileId === profileIdRef.current) {
        setRequestsLoading(false);
      }
    }
  }, [profileId, text]);

  useEffect(() => {
    requestsRequestIdRef.current += 1;
    submissionRequestIdRef.current += 1;
    submitInFlightRef.current = false;
    setRequests([]);
    setHasLoadedRequests(false);
    setRequestsError(null);
    setNotice("");
    setNoticeKind("");
    setSaving(false);
    setAcceptedRules(false);
    if (auth.status === "signedIn" && profileId) void loadRequests();
  }, [auth.status, loadRequests, profileId]);

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
    if (submitInFlightRef.current) return;
    setNotice("");
    setNoticeKind("");

    if (!hasLoadedRequests || requestsLoading) {
      fail(
        text(
          "انتظر حتى يكتمل فحص سجل التوثيق ثم أعد المحاولة.",
          "Wait for verification history to finish loading, then try again.",
        ),
      );
      return;
    }
    if (alreadyVerified) {
      fail(text("الحساب موثّق بالفعل.", "This account is already verified."));
      return;
    }
    if (hasPendingRequest) {
      fail(
        text(
          "لديك طلب توثيق قيد المراجعة بالفعل.",
          "You already have a verification request under review.",
        ),
      );
      return;
    }
    if (legalName.trim().length < 3) {
      fail(text("اكتب الاسم القانوني بوضوح.", "Enter the legal name clearly."));
      return;
    }
    if (requestType === "business" && businessName.trim().length < 3) {
      fail(text("اكتب اسم المنشأة القانوني.", "Enter the legal business name."));
      return;
    }
    if (!documentType || !documentFile) {
      fail(
        text(
          "اختر نوع المستند وأرفق الوثيقة المطلوبة.",
          "Choose the document type and attach the required evidence.",
        ),
      );
      return;
    }
    if (!acceptedRules) {
      fail(
        text(
          "يجب الإقرار بشروط التوثيق قبل إرسال الطلب.",
          "You must accept the verification conditions before submitting.",
        ),
      );
      return;
    }

    const submissionRequestId = ++submissionRequestIdRef.current;
    const submissionProfileId = profileId;
    submitInFlightRef.current = true;
    setSaving(true);
    try {
      const result = await createSellerVerificationRequest({
        requestType,
        legalName: legalName.trim(),
        businessName: requestType === "business" ? businessName.trim() : null,
        documentType,
        documentFile,
      });
      if (
        submissionRequestId !== submissionRequestIdRef.current ||
        submissionProfileId !== profileIdRef.current
      )
        return;

      if (result.ok) {
        setRequests((current) => [
          result.data,
          ...current.filter((item) => item.id !== result.data.id),
        ]);
        setHasLoadedRequests(true);
        setNotice(
          text(
            "تم استلام الطلب. سيبقى قيد المراجعة اليدوية، ولا تمنح الشارة إلا بعد استيفاء شروط الأهلية ومطابقة الوثيقة.",
            "Request received. It remains under manual review, and the badge is granted only after eligibility and evidence checks pass.",
          ),
        );
        setNoticeKind("success");
        setLegalName("");
        setBusinessName("");
        setDocumentType("");
        setDocumentFile(null);
        setAcceptedRules(false);
        await loadRequests();
      } else {
        fail(result.error.message);
      }
    } catch {
      fail(
        text(
          "تعذر إرسال طلب التوثيق. أعد المحاولة.",
          "Could not submit the verification request. Try again.",
        ),
      );
    } finally {
      if (
        submissionRequestId === submissionRequestIdRef.current &&
        submissionProfileId === profileIdRef.current
      ) {
        submitInFlightRef.current = false;
        setSaving(false);
      }
    }
  }

  function fail(message: string) {
    setNotice(message);
    setNoticeKind("error");
  }

  if (auth.status !== "signedIn") {
    return (
      <>
        <PageHeader title={text("التوثيق", "Verification")} to="/more" backMode="history" />
        <main className="container-wide mobile-page-bottom pt-4">
          <section className="rounded-2xl bg-card p-7 text-center hairline">
            <BadgeCheck className="mx-auto h-9 w-9 text-gold" />
            <h1 className="mt-3 text-base font-extrabold">
              {text("التوثيق يتطلب حساباً", "Verification requires an account")}
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-xs leading-6 text-muted-foreground">
              {text(
                "سجّل الدخول أولاً. الطلبات تخضع لشروط أهلية وفحص آلي أولي ثم مراجعة بشرية من الإدارة.",
                "Log in first. Requests are subject to eligibility checks followed by manual admin review.",
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
      <PageHeader title={text("التوثيق", "Verification")} to="/more" backMode="history" />
      <main className="container-wide mobile-page-bottom space-y-4 pb-8 pt-4">
        <section className="rounded-2xl bg-card p-5 hairline">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold/10 text-gold">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-extrabold">
                {text("التوثيق ليس تلقائياً", "Verification is not automatic")}
              </h1>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                {text(
                  "الشارة تمنح بعد استيفاء شروط الأهلية وفحص وثيقة خاصة ومراجعة يدوية. الشارة تعني أن رواج راجع الأدلة المقدمة وقت الطلب فقط؛ ولا تعني ضمان السلعة أو الملكية أو جودة الإعلان أو الدفع أو نجاح أي صفقة.",
                  "The badge is granted only after eligibility checks, private-document review, and manual moderation. It means RAWAJ reviewed the evidence supplied at the time of the request; it does not guarantee an item, ownership, listing accuracy, payment, or any transaction.",
                )}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-card p-4 hairline">
          <h2 className="text-sm font-extrabold">
            {text("شروط الأهلية قبل إرسال الطلب", "Eligibility before submitting")}
          </h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {eligibilityRules.map(([ar, en]) => (
              <div
                key={en}
                className="flex items-start gap-2 rounded-xl bg-muted-surface p-3 text-xs leading-5"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>{text(ar, en)}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 rounded-xl bg-warning/10 p-3 text-[11px] leading-5 text-warning">
            {text(
              "هذه الشروط تُفحص أيضاً في الخادم قبل حفظ الطلب. وجود زر التوثيق لا يعني أن الحساب مؤهل، والإدارة تستطيع رفض الطلب أو طلب معلومات إضافية.",
              "These rules are also enforced server-side before a request is stored. Seeing the verification option does not mean the account is eligible, and admins may reject a request or require additional evidence.",
            )}
          </p>
        </section>

        {alreadyVerified ? (
          <section className="rounded-2xl bg-emerald-500/10 p-5 hairline">
            <div className="flex items-center gap-3 text-emerald-400">
              <BadgeCheck className="h-6 w-6" />
              <strong>{text("حسابك موثّق حالياً", "Your account is currently verified")}</strong>
            </div>
          </section>
        ) : (
          <form
            onSubmit={(event) => void submit(event)}
            aria-busy={saving}
            className="rounded-2xl bg-card p-4 hairline"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={text("نوع الطلب", "Request type")}>
                <select
                  value={requestType}
                  onChange={(event) =>
                    changeRequestType(event.target.value as VerificationRequestType)
                  }
                  disabled={saving}
                  className="input"
                >
                  <option value="personal">{text("فرد", "Individual")}</option>
                  <option value="business">{text("منشأة / نشاط تجاري", "Business")}</option>
                </select>
              </Field>

              <Field
                label={text(
                  "الاسم القانوني كما في الوثيقة",
                  "Legal name exactly as shown on the document",
                )}
              >
                <input
                  value={legalName}
                  onChange={(event) => setLegalName(event.target.value)}
                  maxLength={120}
                  required
                  disabled={saving}
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
                    disabled={saving}
                    className="input"
                  />
                </Field>
              ) : null}

              <Field label={text("نوع المستند", "Document type")}>
                <select
                  value={documentType}
                  onChange={(event) =>
                    setDocumentType(event.target.value as VerificationDocumentType)
                  }
                  required
                  disabled={saving}
                  className="input"
                >
                  <option value="">{text("اختر المستند", "Choose a document")}</option>
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
                {text("وثيقة خاصة للمراجعة", "Private evidence for review")}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                required
                onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
                disabled={saving}
                className="mt-3 block w-full text-xs file:me-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-card file:px-3 file:py-2 file:font-bold file:text-foreground"
              />
              {documentFile ? (
                <span className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <FileKey2 className="h-4 w-4" />
                  <span className="min-w-0 truncate">{documentFile.name}</span>
                  <span className="shrink-0">{formatFileSize(documentFile.size)}</span>
                </span>
              ) : null}
              <small className="mt-2 block text-[11px] leading-5 text-muted-foreground">
                {text(
                  "JPG أو PNG أو WebP أو PDF بحد أقصى 10 MB. لا تُنشر الوثيقة في ملفك العام.",
                  "JPG, PNG, WebP, or PDF up to 10 MB. The document is not published on your public profile.",
                )}
              </small>
            </label>

            <div className="mt-4 flex items-start gap-3 rounded-xl bg-muted-surface p-3 hairline">
              <input
                id="verification-rules"
                type="checkbox"
                checked={acceptedRules}
                onChange={(event) => setAcceptedRules(event.target.checked)}
                disabled={saving}
                className="mt-1 h-4 w-4"
              />
              <label
                htmlFor="verification-rules"
                className="text-[11px] leading-5 text-muted-foreground"
              >
                {text(
                  "أقر بصحة البيانات والوثيقة، وأفهم أن التوثيق قابل للرفض أو السحب عند ظهور معلومات غير صحيحة أو إساءة استخدام، وأن الشارة ليست ضماناً لأي معاملة. كما أوافق على ",
                  "I confirm the information and evidence are accurate, understand verification may be refused or revoked for false information or abuse, and understand the badge is not a transaction guarantee. I also agree to the ",
                )}
                <Link to="/terms" className="font-bold text-primary hover:underline">
                  {text("شروط الاستخدام", "Terms of Use")}
                </Link>
                {text(" و", " and ")}
                <Link to="/privacy" className="font-bold text-primary hover:underline">
                  {text("سياسة الخصوصية", "Privacy Policy")}
                </Link>
                .
              </label>
            </div>

            {notice ? (
              <p
                role="status"
                className={`mt-3 rounded-xl p-3 text-xs font-semibold ${noticeKind === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-destructive/10 text-destructive"}`}
              >
                {notice}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={saving || hasPendingRequest || !acceptedRules}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-extrabold text-primary-foreground disabled:opacity-50"
            >
              <BadgeCheck className="h-4 w-4" />
              {saving
                ? text("جارٍ إرسال الطلب", "Submitting request")
                : hasPendingRequest
                  ? text("طلبك قيد المراجعة", "Request under review")
                  : text("إرسال طلب التوثيق", "Submit verification request")}
            </button>
          </form>
        )}

        <section className="rounded-2xl bg-card p-4 hairline">
          <h2 className="text-sm font-extrabold">
            {text("سجل طلبات التوثيق", "Verification history")}
          </h2>
          {requestsLoading ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {text("جارٍ التحميل…", "Loading…")}
            </p>
          ) : requestsError ? (
            <p className="mt-3 text-xs text-destructive">{requestsError.message}</p>
          ) : requests.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {text("لا توجد طلبات سابقة.", "No previous requests.")}
            </p>
          ) : (
            <div className="mt-3 grid gap-2">
              {requests.map((request) => (
                <RequestRow key={request.id} request={request} language={language} text={text} />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold">{label}</span>
      {children}
    </label>
  );
}

function RequestRow({
  request,
  language,
  text,
}: {
  request: SellerVerificationRequest;
  language: "ar" | "en";
  text: (ar: string, en: string) => string;
}) {
  const approved = request.status === "approved";
  const rejected = request.status === "rejected";
  return (
    <article className="flex items-start justify-between gap-3 rounded-xl bg-muted-surface p-3 hairline">
      <div className="min-w-0">
        <strong className="block truncate text-xs">
          {request.requestType === "business"
            ? request.businessName || request.legalName
            : request.legalName}
        </strong>
        <small className="mt-1 block text-[10px] text-muted-foreground">
          {new Date(request.createdAt).toLocaleDateString(language === "ar" ? "ar-SA" : "en-US")}
        </small>
      </div>
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${approved ? "bg-emerald-500/10 text-emerald-400" : rejected ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}
      >
        {approved ? (
          <CheckCircle2 className="h-3 w-3" />
        ) : rejected ? (
          <XCircle className="h-3 w-3" />
        ) : (
          <ShieldCheck className="h-3 w-3" />
        )}
        {approved
          ? text("معتمد", "Approved")
          : rejected
            ? text("مرفوض", "Rejected")
            : text("قيد المراجعة", "Under review")}
      </span>
    </article>
  );
}

function documentTypeOptions(
  requestType: VerificationRequestType,
): { value: VerificationDocumentType; ar: string; en: string }[] {
  return requestType === "business"
    ? [
        { value: "commercial_registration", ar: "سجل تجاري", en: "Commercial registration" },
        { value: "business_license", ar: "ترخيص منشأة", en: "Business license" },
        { value: "tax_document", ar: "وثيقة ضريبية رسمية", en: "Official tax document" },
      ]
    : [
        { value: "national_id", ar: "هوية وطنية / شخصية", en: "National ID" },
        { value: "passport", ar: "جواز سفر", en: "Passport" },
        {
          value: "other_government_id",
          ar: "وثيقة هوية حكومية أخرى",
          en: "Other government-issued ID",
        },
      ];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
