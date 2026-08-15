import { Copy, Download, MessageCircle, Share2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchOwnerListingDetail } from "@/lib/classifieds-api";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import {
  listingShareLocationLabel,
  listingSharePriceLabel,
  renderListingShareCard,
} from "@/lib/listing-share-card-renderer";
import {
  LISTING_SHARE_TEMPLATES,
  RAWAJ_LISTING_SUBMITTED_EVENT,
  buildListingShareUrl,
  captureGrowthAttribution,
  clearQueuedListingSharePrompt,
  readQueuedListingSharePrompt,
  type ListingShareChannel,
  type ListingShareTemplate,
  type ListingShareTemplateId,
  type QueuedListingSharePrompt,
} from "@/lib/listing-share-growth";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export default function RawajGrowthLayer() {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const [listingId, setListingId] = useState<string | null>(null);
  const [listing, setListing] = useState<ClassifiedListing | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<ListingShareTemplateId>("classic");
  const [loadingListing, setLoadingListing] = useState(false);
  const [busyAction, setBusyAction] = useState<ListingShareChannel | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    captureGrowthAttribution(window.location.href);
    const queued = readQueuedListingSharePrompt();
    if (queued) setListingId(queued.listingId);
    const onSubmitted = (event: Event) => {
      const customEvent = event as CustomEvent<QueuedListingSharePrompt>;
      const nextId = customEvent.detail?.listingId?.trim();
      if (!nextId) return;
      setListing(null);
      setNotice(null);
      setSelectedTemplateId("classic");
      setListingId(nextId);
    };
    window.addEventListener(RAWAJ_LISTING_SUBMITTED_EVENT, onSubmitted);
    return () => window.removeEventListener(RAWAJ_LISTING_SUBMITTED_EVENT, onSubmitted);
  }, []);

  useEffect(() => {
    if (!listingId || auth.status !== "signedIn" || !auth.profile?.id) return;
    let cancelled = false;
    setLoadingListing(true);
    void fetchOwnerListingDetail(auth.profile.id, listingId)
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setNotice(
            text(
              "تم إرسال الإعلان، لكن تعذر تجهيز بطاقة المشاركة الآن.",
              "The listing was submitted, but the share card could not be prepared right now.",
            ),
          );
          return;
        }
        setListing(result.data);
      })
      .finally(() => {
        if (!cancelled) setLoadingListing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [auth.profile?.id, auth.status, listingId, text]);

  const close = useCallback(() => {
    if (listingId) clearQueuedListingSharePrompt(listingId);
    setListingId(null);
    setListing(null);
    setNotice(null);
    setBusyAction(null);
  }, [listingId]);

  useEffect(() => {
    if (!listingId || typeof window === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyAction) close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [busyAction, close, listingId]);

  const selectedTemplate = useMemo(
    () =>
      LISTING_SHARE_TEMPLATES.find((template) => template.id === selectedTemplateId) ??
      LISTING_SHARE_TEMPLATES[0],
    [selectedTemplateId],
  );

  if (!listingId) return null;

  const priceLabel = listing ? listingSharePriceLabel(listing, language) : "";
  const locationLabel = listing ? listingShareLocationLabel(listing, language) : "";
  const shareUrlFor = (channel: ListingShareChannel) =>
    buildListingShareUrl(listingId, channel, selectedTemplate.id);

  const shareMessageFor = (channel: ListingShareChannel) => {
    const url = shareUrlFor(channel);
    if (!listing) return url;
    return [
      listing.title,
      priceLabel ? `${text("السعر", "Price")}: ${priceLabel}` : null,
      locationLabel ? `${text("الموقع", "Location")}: ${locationLabel}` : null,
      text("شاهد الإعلان على رواج:", "View the listing on RAWAJ:"),
      url,
    ]
      .filter(Boolean)
      .join("\n");
  };

  const buildCardBlob = async (channel: ListingShareChannel) => {
    if (!listing) throw new Error("listing_unavailable");
    void channel;
    return renderListingShareCard(listing, selectedTemplate, language);
  };

  const handleShareCard = async () => {
    if (!listing || busyAction) return;
    setBusyAction("native");
    setNotice(null);
    try {
      const message = shareMessageFor("native");
      let file: File | null = null;
      try {
        const blob = await buildCardBlob("native");
        file = new File([blob], `rawaj-${listing.id}-${selectedTemplate.id}.png`, {
          type: "image/png",
        });
      } catch {
        file = null;
      }
      if (navigator.share) {
        const shareData: ShareData = {
          title: listing.title,
          text: message,
          ...(file ? { files: [file] } : {}),
        };
        const canShareFiles =
          !file || !navigator.canShare || safelyCanShare(() => navigator.canShare(shareData));
        if (canShareFiles) {
          await navigator.share(shareData);
          setNotice(text("تم فتح نافذة المشاركة.", "Share sheet opened."));
          return;
        }
        await navigator.share({ title: listing.title, text: message });
        setNotice(text("تم فتح نافذة المشاركة بالرابط.", "Share sheet opened with the link."));
        return;
      }
      if (file) downloadBlob(file, file.name);
      await copyText(message);
      setNotice(
        text(
          "تم تنزيل البطاقة ونسخ نص المشاركة.",
          "The card was downloaded and the share text was copied.",
        ),
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNotice(text("تعذر فتح المشاركة الآن.", "Could not open sharing right now."));
    } finally {
      setBusyAction(null);
    }
  };

  const handleWhatsApp = () => {
    if (!listing || busyAction || typeof window === "undefined") return;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(shareMessageFor("whatsapp"))}`,
      "_blank",
      "noopener,noreferrer",
    );
    setNotice(
      text(
        "تم تجهيز رسالة واتساب بالرابط. لإرسال التصميم نفسه استخدم «شارك البطاقة» واختر واتساب.",
        "WhatsApp was prepared with the link. To send the designed image too, use “Share card” and choose WhatsApp.",
      ),
    );
  };

  const handleDownload = async () => {
    if (!listing || busyAction) return;
    setBusyAction("download");
    setNotice(null);
    try {
      const blob = await buildCardBlob("download");
      downloadBlob(blob, `rawaj-${listing.id}-${selectedTemplate.id}.png`);
      setNotice(text("تم تنزيل بطاقة الإعلان.", "Listing card downloaded."));
    } catch {
      setNotice(text("تعذر إنشاء الصورة الآن.", "Could not create the image right now."));
    } finally {
      setBusyAction(null);
    }
  };

  const handleCopy = async () => {
    if (busyAction) return;
    setBusyAction("copy");
    setNotice(null);
    try {
      await copyText(shareUrlFor("copy"));
      setNotice(text("تم نسخ رابط الإعلان.", "Listing link copied."));
    } catch {
      setNotice(text("تعذر نسخ الرابط.", "Could not copy the link."));
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busyAction) close();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="rawaj-share-prompt-title"
        className="max-h-[94dvh] w-full overflow-y-auto rounded-t-[2rem] border border-border/70 bg-background shadow-2xl sm:max-w-4xl sm:rounded-[2rem]"
      >
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-border/60 bg-background/95 p-4 backdrop-blur sm:p-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-brand-orange">
              {listing?.status === "pending_review"
                ? text("إعلانك قيد المراجعة", "Your listing is under review")
                : text("إعلانك جاهز للمشاركة", "Your listing is ready to share")}
            </p>
            <h2 id="rawaj-share-prompt-title" className="mt-0.5 text-xl font-black text-foreground">
              {text("شارك إعلانك من الآن واجذب المهتمين", "Share now and start attracting buyers")}
            </h2>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              {listing?.status === "pending_review"
                ? text(
                    "اختر تصميماً. نفس الرابط يعمل الآن بصفحة آمنة، وبعد اعتماد الإدارة يفتح الإعلان الكامل تلقائياً.",
                    "Choose a design. The same link works now with a safe page, then automatically opens the full listing after approval.",
                  )
                : text(
                    "اختر التصميم الأنسب وشارك بطاقة إعلانك الجاهزة.",
                    "Choose a design and share your ready-made listing card.",
                  )}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            disabled={Boolean(busyAction)}
            className="rawaj-icon-button h-10 w-10 shrink-0 disabled:opacity-40"
            aria-label={text("إغلاق", "Close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          {loadingListing ? (
            <div className="grid min-h-56 place-items-center rounded-[1.5rem] border border-border/60 bg-card text-sm font-bold text-muted-foreground">
              {text("نجهز بطاقات إعلانك...", "Preparing your listing cards...")}
            </div>
          ) : listing ? (
            <>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-foreground">
                    {text("اختر شكل البطاقة", "Choose a card design")}
                  </h3>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {text(
                      "ستة تصاميم مختلفة فعلياً، بينها مقاس ستوري.",
                      "Six genuinely different designs, including a story format.",
                    )}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-bold text-muted-foreground">
                  6 {text("تصاميم", "designs")}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {LISTING_SHARE_TEMPLATES.map((template) => (
                  <ShareTemplatePreview
                    key={template.id}
                    template={template}
                    listing={listing}
                    selected={template.id === selectedTemplate.id}
                    language={language}
                    onSelect={() => setSelectedTemplateId(template.id)}
                  />
                ))}
              </div>

              <div className="mt-5 rounded-[1.4rem] border border-border/70 bg-card p-4">
                <div className="flex items-start gap-3">
                  {listing.primaryImageUrl ? (
                    <img
                      src={listing.primaryImageUrl}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-muted text-[10px] font-bold text-muted-foreground">
                      RAWAJ
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-foreground">{listing.title}</p>
                    <p className="mt-1 text-xs font-bold text-brand-orange">{priceLabel}</p>
                    {locationLabel ? (
                      <p className="mt-1 truncate text-[11px] text-muted-foreground">
                        {locationLabel}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <button
                  type="button"
                  onClick={() => void handleShareCard()}
                  disabled={Boolean(busyAction)}
                  className="rawaj-button-primary min-h-12 justify-center gap-2 rounded-2xl px-4 py-3 disabled:opacity-50"
                >
                  <Share2 className="h-4 w-4" />
                  {busyAction === "native"
                    ? text("جارٍ التجهيز...", "Preparing...")
                    : text("شارك البطاقة", "Share card")}
                </button>
                <button
                  type="button"
                  onClick={handleWhatsApp}
                  disabled={Boolean(busyAction)}
                  className="min-h-12 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-700 disabled:opacity-50"
                >
                  <span className="flex items-center justify-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    {text("واتساب بالرابط", "WhatsApp link")}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleDownload()}
                  disabled={Boolean(busyAction)}
                  className="min-h-12 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-black text-foreground disabled:opacity-50"
                >
                  <span className="flex items-center justify-center gap-2">
                    <Download className="h-4 w-4" />
                    {busyAction === "download"
                      ? text("جارٍ الإنشاء...", "Creating...")
                      : text("تحميل الصورة", "Download image")}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  disabled={Boolean(busyAction)}
                  className="min-h-12 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-black text-foreground disabled:opacity-50"
                >
                  <span className="flex items-center justify-center gap-2">
                    <Copy className="h-4 w-4" />
                    {text("نسخ الرابط", "Copy link")}
                  </span>
                </button>
              </div>

              <p className="mt-3 text-center text-[11px] leading-5 text-muted-foreground">
                {text(
                  "لإرسال التصميم نفسه على واتساب: اضغط «شارك البطاقة» ثم اختر واتساب من نافذة المشاركة.",
                  "To send the designed image on WhatsApp, tap “Share card” and choose WhatsApp from the share sheet.",
                )}
              </p>

              {notice ? (
                <div
                  className="mt-4 rounded-2xl border border-border/60 bg-muted/45 px-4 py-3 text-center text-xs font-semibold text-foreground"
                  role="status"
                  aria-live="polite"
                >
                  {notice}
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-[1.5rem] border border-warning/25 bg-warning/10 p-5 text-sm leading-7 text-foreground">
              {notice ?? text("تعذر تجهيز البطاقة حالياً.", "The share card is unavailable right now.")}
            </div>
          )}

          <button
            type="button"
            onClick={close}
            disabled={Boolean(busyAction)}
            className="mt-4 w-full py-2 text-xs font-bold text-muted-foreground disabled:opacity-40"
          >
            {text("لاحقاً", "Maybe later")}
          </button>
        </div>
      </section>
    </div>
  );
}

function ShareTemplatePreview({
  template,
  listing,
  selected,
  language,
  onSelect,
}: {
  template: ListingShareTemplate;
  listing: ClassifiedListing;
  selected: boolean;
  language: string;
  onSelect: () => void;
}) {
  const price = listingSharePriceLabel(listing, language);
  const location = listingShareLocationLabel(listing, language);
  const story = template.format === "story";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`rounded-[1.25rem] border p-2 text-start transition ${
        selected
          ? "border-brand-orange bg-brand-orange/8 shadow-soft"
          : "border-border/70 bg-card hover:border-brand-orange/35"
      }`}
    >
      <ShareTemplateArtwork
        template={template}
        listing={listing}
        price={price}
        location={location}
        story={story}
      />
      <span className="mt-2 block truncate text-center text-[10px] font-bold text-foreground">
        {language === "en" ? template.labelEn : template.labelAr}
      </span>
    </button>
  );
}

function ShareTemplateArtwork({
  template,
  listing,
  price,
  location,
  story,
}: {
  template: ListingShareTemplate;
  listing: ClassifiedListing;
  price: string;
  location: string;
  story: boolean;
}) {
  const image = listing.primaryImageUrl ? (
    <img src={listing.primaryImageUrl} alt="" className="h-full w-full object-cover" />
  ) : (
    <div className="grid h-full place-items-center text-[8px] font-bold">RAWAJ</div>
  );
  const brand = (
    <div className="flex items-center justify-between text-[7px] font-black">
      <span>RAWAJ</span>
      <span style={{ color: template.accent }}>رواج</span>
    </div>
  );

  return (
    <div
      data-share-template-preview={template.id}
      className={`relative overflow-hidden rounded-[1rem] p-2 ${story ? "aspect-[9/16]" : "aspect-square"}`}
      style={{ background: template.background, color: template.surface }}
    >
      {template.id === "classic" ? (
        <>
          {brand}
          <div className="mt-2 grid h-[70%] grid-cols-[1.2fr_0.8fr] gap-1.5">
            <div className="overflow-hidden rounded-lg" style={{ background: template.surface }}>
              {image}
            </div>
            <div className="flex min-w-0 flex-col justify-center">
              <p className="line-clamp-3 text-[7px] font-black leading-3">{listing.title}</p>
              <p className="mt-1 text-[7px] font-black" style={{ color: template.accent }}>
                {price}
              </p>
            </div>
          </div>
        </>
      ) : template.id === "quick-sale" ? (
        <>
          <div
            className="-mx-2 -mt-2 flex h-[24%] items-center justify-between px-2 text-[7px] font-black"
            style={{ background: template.surface, color: "#fff" }}
          >
            <span>RAWAJ</span>
            <span>{price}</span>
          </div>
          <div className="mt-1 h-[48%] overflow-hidden">{image}</div>
          <p
            className="mt-1 line-clamp-2 text-[8px] font-black leading-3"
            style={{ color: template.foreground }}
          >
            {listing.title}
          </p>
        </>
      ) : template.id === "minimal" ? (
        <div className="flex h-full flex-col text-center" style={{ color: template.foreground }}>
          <div className="text-[7px] font-black tracking-[0.16em]">RAWAJ</div>
          <div className="mx-3 mt-2 h-[48%] overflow-hidden rounded-sm">{image}</div>
          <p className="mt-2 line-clamp-2 text-[7px] font-bold leading-3">{listing.title}</p>
          <p className="mt-1 text-[8px] font-black">{price}</p>
        </div>
      ) : template.id === "emerald" ? (
        <>
          {brand}
          <div className="mx-2 mt-2 h-[52%] overflow-hidden rounded-t-full rounded-b-xl ring-1 ring-white/30">
            {image}
          </div>
          <div className="mt-2 flex items-end justify-between gap-1">
            <p className="line-clamp-2 text-[7px] font-black leading-3">{listing.title}</p>
            <span
              className="rounded-full px-1.5 py-1 text-[6px] font-black"
              style={{ background: template.accent, color: template.background }}
            >
              {price}
            </span>
          </div>
        </>
      ) : template.id === "premium" ? (
        <div className="h-full border p-1.5 text-center" style={{ borderColor: template.accent }}>
          <div
            className="text-[7px] font-black tracking-[0.18em]"
            style={{ color: template.accent }}
          >
            RAWAJ
          </div>
          <div className="mt-1.5 h-[48%] overflow-hidden">{image}</div>
          <p className="mt-2 line-clamp-2 text-[7px] font-black leading-3">{listing.title}</p>
          <p className="mt-1 text-[8px] font-black" style={{ color: template.accent }}>
            {price}
          </p>
        </div>
      ) : (
        <>
          <div className="absolute inset-x-0 top-0 h-[58%] overflow-hidden">{image}</div>
          <div className="absolute inset-x-0 top-[45%] h-[18%] bg-gradient-to-t from-[#14263D] to-transparent" />
          <div className="relative flex h-full flex-col">
            {brand}
            <div className="mt-auto pb-5">
              <p className="line-clamp-3 text-[8px] font-black leading-3">{listing.title}</p>
              <p className="mt-1 text-[9px] font-black" style={{ color: template.accent }}>
                {price}
              </p>
              {location ? <p className="mt-1 truncate text-[6px] opacity-80">{location}</p> : null}
            </div>
          </div>
        </>
      )}
      <span className="absolute inset-x-2 bottom-2 text-center text-[6px] font-bold opacity-80">
        rawa-j.com
      </span>
    </div>
  );
}

function safelyCanShare(check: () => boolean) {
  try {
    return check();
  } catch {
    return false;
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  const textarea = document.createElement("textarea");
  textarea.value = value;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}
