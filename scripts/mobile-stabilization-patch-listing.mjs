import { replaceOnce } from "./mobile-stabilization-patch-utils.mjs";

const listing = "src/routes/add-listing.tsx";

await replaceOnce(
  listing,
  'import { ArrowDown, ArrowUp, Camera, Info, X } from "lucide-react";',
  'import { ArrowDown, ArrowUp, Camera, Info, ShieldCheck, X } from "lucide-react";',
  "listing terms icon",
);
await replaceOnce(
  listing,
  "const MAX_IMAGES = 6;",
  'const MAX_IMAGES = 6;\nconst LISTING_TERMS_VERSION = "2026-07-12";',
  "listing terms version",
);
await replaceOnce(
  listing,
  `  const [categoryDetails, setCategoryDetails] = useState<CategorySpecificDetails>({});
  const submittingRef = useRef(false);`,
  `  const [categoryDetails, setCategoryDetails] = useState<CategorySpecificDetails>({});
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const submittingRef = useRef(false);`,
  "listing terms state",
);
await replaceOnce(
  listing,
  "  const canSubmit = step === 2;",
  "  const canSubmit = step === 2 && acceptedTerms;",
  "listing submit gate",
);
await replaceOnce(
  listing,
  `  async function submitListing() {
    if (submittingRef.current) return;
    if (!validateCurrentStep(2)) {`,
  `  async function submitListing() {
    if (submittingRef.current) return;
    if (!acceptedTerms) {
      setSubmitMessage(
        text(
          "يجب قراءة شروط الاستخدام وسياسة المحتوى المحظور والموافقة عليهما قبل إرسال الإعلان.",
          "Read and accept the Terms of Use and prohibited-content policy before submitting.",
        ),
      );
      window.requestAnimationFrame(() => {
        document.querySelector("[data-listing-terms]")?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
      return;
    }
    if (!validateCurrentStep(2)) {`,
  "listing terms submit enforcement",
);
await replaceOnce(
  listing,
  `          ...(contentCheck.flags.length > 0 ? { content_flags: contentCheck.flags } : {}),
        },`,
  `          ...(contentCheck.flags.length > 0 ? { content_flags: contentCheck.flags } : {}),
          listing_terms_accepted: true,
          listing_terms_version: LISTING_TERMS_VERSION,
          listing_terms_accepted_at: new Date().toISOString(),
        },`,
  "listing terms audit metadata",
);
await replaceOnce(
  listing,
  `                  <Card title={text("مراجعة سريعة", "Quick review")}>`,
  `                  <Card title={text("إقرار ومسؤولية النشر", "Publishing responsibility")}>
                    <div
                      data-listing-terms="true"
                      className="rounded-[1.1rem] border border-border/75 bg-card-warm/70 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-trust" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-3">
                            <input
                              id="listing-terms-acceptance"
                              type="checkbox"
                              checked={acceptedTerms}
                              onChange={(event) => setAcceptedTerms(event.target.checked)}
                              className="mt-1 h-5 w-5 shrink-0 accent-primary"
                            />
                            <label
                              htmlFor="listing-terms-acceptance"
                              className="text-xs font-semibold leading-7 text-foreground"
                            >
                              {text(
                                "أقر بأنني أملك حق نشر محتوى الإعلان، وأن البيانات والصور صحيحة، وأنني أتحمل مسؤولية المحتوى والتعامل، وأوافق على شروط الاستخدام وسياسة المحتوى المحظور.",
                                "I confirm that I have the right to publish this listing, that its information and images are accurate, that I am responsible for its content and transactions, and that I accept the Terms of Use and prohibited-content policy.",
                              )}
                            </label>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 ps-8 text-[11px] font-bold">
                            <Link to="/terms" className="text-primary underline underline-offset-4">
                              {text("شروط الاستخدام", "Terms of Use")}
                            </Link>
                            <Link
                              to="/prohibited"
                              className="text-primary underline underline-offset-4"
                            >
                              {text("المحتوى المحظور", "Prohibited content")}
                            </Link>
                            <Link to="/privacy" className="text-primary underline underline-offset-4">
                              {text("سياسة الخصوصية", "Privacy Policy")}
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card title={text("مراجعة سريعة", "Quick review")}>`,
  "listing terms UI",
);
await replaceOnce(
  listing,
  `                    {submitting
                      ? text("جارٍ الإرسال...", "Submitting...")
                      : text("إرسال للمراجعة", "Submit for review")}`,
  `                    {submitting
                      ? text("جارٍ الإرسال...", "Submitting...")
                      : !acceptedTerms
                        ? text("وافق على الشروط للمتابعة", "Accept the terms to continue")
                        : text("إرسال للمراجعة", "Submit for review")}`,
  "listing submit button copy",
);
