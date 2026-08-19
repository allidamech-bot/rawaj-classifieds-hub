import { Link } from "@tanstack/react-router";
import { CheckCircle2, Megaphone, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { createMySupportRequest } from "@/lib/classifieds-api";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import { useUiPreferences } from "@/lib/ui-preferences";

type AdvertisingTarget =
  | "home"
  | "search_results"
  | "categories"
  | "listing_detail"
  | "offers"
  | "campaign";

interface AdvertisingTargetOption {
  id: AdvertisingTarget;
  ar: string;
  en: string;
  hintAr: string;
  hintEn: string;
}

const TARGETS: readonly AdvertisingTargetOption[] = [
  {
    id: "home",
    ar: "الرئيسية",
    en: "Homepage",
    hintAr: "مساحة إعلانية في الصفحة الرئيسية",
    hintEn: "Advertising placement on the homepage",
  },
  {
    id: "search_results",
    ar: "نتائج البحث",
    en: "Search results",
    hintAr: "مساحة تظهر أثناء بحث العملاء",
    hintEn: "Placement shown while customers search",
  },
  {
    id: "categories",
    ar: "الأقسام",
    en: "Categories",
    hintAr: "ظهور داخل صفحات الأقسام",
    hintEn: "Placement inside category pages",
  },
  {
    id: "listing_detail",
    ar: "صفحة الإعلان",
    en: "Listing detail",
    hintAr: "مساحة داخل صفحات تفاصيل الإعلانات",
    hintEn: "Placement on listing detail pages",
  },
  {
    id: "offers",
    ar: "صفحة العروض",
    en: "Offers page",
    hintAr: "مساحة ضمن صفحة العروض",
    hintEn: "Placement on the offers page",
  },
  {
    id: "campaign",
    ar: "حملة إعلانية",
    en: "Advertising campaign",
    hintAr: "اطلب حملة أوسع وسننسق تفاصيلها معك",
    hintEn: "Request a broader campaign and we will coordinate the details",
  },
] as const;

const DURATION_OPTIONS = [7, 14, 30, 60, 90] as const;

export function CustomerPromotionRequestButton({
  listing,
}: {
  listing: Pick<ClassifiedListing, "id" | "title">;
}) {
  const { language, text } = useUiPreferences();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<AdvertisingTarget>("home");
  const [days, setDays] = useState<number>(14);
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const submitInFlightRef = useRef(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [busy, open]);

  const selectedTarget = TARGETS.find((option) => option.id === target) ?? TARGETS[0];

  function close() {
    if (busy) return;
    setOpen(false);
    setError("");
    setSubmitted(false);
  }

  async function submit() {
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setBusy(true);
    setError("");
    try {
      const targetLabel = language === "en" ? selectedTarget.en : selectedTarget.ar;
      const result = await createMySupportRequest({
        type: "other",
        subject: text(
          `طلب ترويج مدفوع — ${selectedTarget.ar}`,
          `Paid promotion request — ${selectedTarget.en}`,
        ),
        message: [
          text("طلب إعلاني أُرسل من صفحة «متجري».", "Advertising request sent from My Store."),
          `${text("الإعلان", "Listing")}: ${listing.title}`,
          `${text("معرّف الإعلان", "Listing ID")}: ${listing.id}`,
          `${text("نوع الترويج", "Promotion type")}: ${targetLabel}`,
          `${text("المدة المطلوبة", "Requested duration")}: ${days} ${text("يوم", "days")}`,
          brief.trim()
            ? `${text("تفاصيل العميل", "Customer brief")}: ${brief.trim()}`
            : text("لا توجد تفاصيل إضافية من العميل.", "No additional customer brief."),
          text(
            "يرجى التواصل مع العميل لتأكيد المقاس والسعر وطريقة الدفع قبل تشغيل الإعلان أو الحملة.",
            "Please contact the customer to confirm creative size, price, and payment method before activating the placement or campaign.",
          ),
        ].join("\n"),
        relatedListingId: listing.id,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setSubmitted(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : text("تعذر إرسال طلب الترويج.", "Could not send the promotion request."),
      );
    } finally {
      submitInFlightRef.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError("");
          setSubmitted(false);
          setOpen(true);
        }}
        data-tone="advertise"
        aria-label={text("طلب مساحة إعلانية أو حملة", "Request an ad placement or campaign")}
        title={text("ترويج مدفوع — مساحة إعلانية أو حملة", "Paid promotion — ad placement or campaign")}
      >
        <Megaphone aria-hidden="true" />
        <span>{text("ترويج", "Promote")}</span>
      </button>

      {open ? (
        <div
          className="rawaj-customer-promotion-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`promotion-request-${listing.id}`}
            className="rawaj-customer-promotion-dialog"
          >
            <header className="rawaj-customer-promotion-dialog__header">
              <span className="rawaj-customer-promotion-dialog__icon" aria-hidden="true">
                <Megaphone />
              </span>
              <div className="min-w-0 flex-1">
                <p>{text("إعلانات رواج", "RAWAJ Ads")}</p>
                <h3 id={`promotion-request-${listing.id}`}>
                  {text("اطلب مساحة إعلانية أو حملة", "Request an ad placement or campaign")}
                </h3>
                <span>
                  {text(
                    "أرسل طلبك أولاً. الإدارة تتواصل معك لتأكيد السعر والتصميم قبل أي تفعيل.",
                    "Send the request first. The team will contact you to confirm price and creative before anything is activated.",
                  )}
                </span>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={close}
                disabled={busy}
                className="rawaj-customer-promotion-dialog__close"
                aria-label={text("إغلاق", "Close")}
              >
                <X />
              </button>
            </header>

            {submitted ? (
              <div className="rawaj-customer-promotion-success" role="status">
                <CheckCircle2 aria-hidden="true" />
                <h4>{text("تم إرسال طلب الترويج", "Promotion request sent")}</h4>
                <p>
                  {text(
                    "وصل الطلب للإدارة مرتبطاً بهذا الإعلان. تستطيع متابعة الرد من صفحة الدعم.",
                    "The request reached the team and is linked to this listing. You can follow the response from Support.",
                  )}
                </p>
                <div>
                  <Link to="/support">{text("متابعة الطلب", "Track request")}</Link>
                  <button type="button" onClick={close}>
                    {text("تم", "Done")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rawaj-customer-promotion-dialog__body">
                <div className="rawaj-customer-promotion-listing">
                  <span>{text("الإعلان المرتبط", "Linked listing")}</span>
                  <strong>{listing.title}</strong>
                </div>

                <fieldset>
                  <legend>{text("أين تريد الترويج؟", "Where do you want to advertise?")}</legend>
                  <div className="rawaj-customer-promotion-targets">
                    {TARGETS.map((option) => {
                      const selected = option.id === target;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          data-selected={selected}
                          onClick={() => setTarget(option.id)}
                        >
                          <strong>{text(option.ar, option.en)}</strong>
                          <span>{text(option.hintAr, option.hintEn)}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <label className="rawaj-customer-promotion-field">
                  <span>{text("المدة المطلوبة", "Requested duration")}</span>
                  <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
                    {DURATION_OPTIONS.map((value) => (
                      <option key={value} value={value}>
                        {value} {text("يوم", "days")}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="rawaj-customer-promotion-field">
                  <span>{text("تفاصيل إضافية", "Additional details")}</span>
                  <textarea
                    value={brief}
                    onChange={(event) => setBrief(event.target.value)}
                    maxLength={600}
                    rows={4}
                    placeholder={text(
                      "مثلاً: أريد استهداف قسم السيارات، أو لدي تصميم جاهز، أو أريد من رواج تجهيز حملة كاملة...",
                      "For example: target the cars category, I already have a creative, or I want RAWAJ to prepare the full campaign...",
                    )}
                  />
                  <small>{brief.length}/600</small>
                </label>

                {error ? <p className="rawaj-customer-promotion-error" role="alert">{error}</p> : null}

                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={busy}
                  className="rawaj-customer-promotion-submit"
                >
                  <Megaphone aria-hidden="true" />
                  {busy
                    ? text("جارٍ إرسال الطلب…", "Sending request…")
                    : text("إرسال طلب الترويج", "Send promotion request")}
                </button>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
