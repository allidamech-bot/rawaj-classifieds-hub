import { Copy, Download, MessageCircle, Share2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchOwnerListingDetail } from "@/lib/classifieds-api";
import type { ClassifiedListing } from "@/lib/classifieds-types";
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
          setNotice(text("تم إرسال الإعلان، لكن تعذر تجهيز بطاقة المشاركة الآن.", "The listing was submitted, but the share card could not be prepared right now."));
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
    () => LISTING_SHARE_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? LISTING_SHARE_TEMPLATES[0],
    [selectedTemplateId],
  );

  if (!listingId) return null;

  const priceLabel = listing ? listingPriceLabel(listing, language) : "";
  const locationLabel = listing ? listingLocationLabel(listing, language) : "";
  const shareUrlFor = (channel: ListingShareChannel) => buildListingShareUrl(listingId, channel, selectedTemplate.id);
  const shareMessageFor = (channel: ListingShareChannel) => {
    const url = shareUrlFor(channel);
    if (!listing) return url;
    return [listing.title, priceLabel ? `${text("السعر", "Price")}: ${priceLabel}` : null, locationLabel ? `${text("الموقع", "Location")}: ${locationLabel}` : null, text("شاهد الإعلان على رواج:", "View the listing on RAWAJ:"), url].filter(Boolean).join("\n");
  };
  const buildCardBlob = async (channel: ListingShareChannel) => {
    if (!listing) throw new Error("listing_unavailable");
    return renderListingShareCard(listing, selectedTemplate, shareUrlFor(channel), language);
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
        file = new File([blob], `rawaj-${listing.id}-${selectedTemplate.id}.png`, { type: "image/png" });
      } catch {
        file = null;
      }
      if (navigator.share) {
        const shareData: ShareData = { title: listing.title, text: message, ...(file ? { files: [file] } : {}) };
        const canShareFiles = !file || !navigator.canShare || safelyCanShare(() => navigator.canShare(shareData));
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
      setNotice(text("تم تنزيل البطاقة ونسخ نص المشاركة.", "The card was downloaded and the share text was copied."));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNotice(text("تعذر فتح المشاركة الآن.", "Could not open sharing right now."));
    } finally {
      setBusyAction(null);
    }
  };

  const handleWhatsApp = () => {
    if (!listing || busyAction || typeof window === "undefined") return;
    window.open(`https://wa.me/?text=${encodeURIComponent(shareMessageFor("whatsapp"))}`, "_blank", "noopener,noreferrer");
  };

  const handleDownload = async () => {
    if (!listing || busyAction) return;
    setBusyAction("download");
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
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busyAction) close(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="rawaj-share-prompt-title" className="max-h-[94dvh] w-full overflow-y-auto rounded-t-[2rem] border border-border/70 bg-background shadow-2xl sm:max-w-4xl sm:rounded-[2rem]">
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-border/60 bg-background/95 p-4 backdrop-blur sm:p-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground"><Sparkles className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-brand-orange">{text("إعلانك قيد المراجعة", "Your listing is under review")}</p>
            <h2 id="rawaj-share-prompt-title" className="mt-0.5 text-xl font-black text-foreground">{text("شارك إعلانك من الآن واجذب المهتمين", "Share now and start attracting buyers")}</h2>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">{text("اختر تصميماً. نفس الرابط يعمل الآن بصفحة آمنة، وبعد اعتماد الإدارة يفتح الإعلان الكامل تلقائياً.", "Choose a design. The same link works now with a safe page, then automatically opens the full listing after approval.")}</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={close} disabled={Boolean(busyAction)} className="rawaj-icon-button h-10 w-10 shrink-0 disabled:opacity-40" aria-label={text("إغلاق", "Close")}><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 sm:p-6">
          {loadingListing ? (
            <div className="grid min-h-56 place-items-center rounded-[1.5rem] border border-border/60 bg-card text-sm font-bold text-muted-foreground">{text("نجهز بطاقات إعلانك...", "Preparing your listing cards...")}</div>
          ) : listing ? (
            <>
              <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="text-sm font-black text-foreground">{text("اختر شكل البطاقة", "Choose a card design")}</h3><p className="mt-1 text-[11px] text-muted-foreground">{text("ست بطاقات جاهزة كبداية، بينها مقاس ستوري.", "Six starter designs, including a story format.")}</p></div><span className="rounded-full bg-muted px-3 py-1 text-[10px] font-bold text-muted-foreground">6 {text("تصاميم", "designs")}</span></div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{LISTING_SHARE_TEMPLATES.map((template) => <ShareTemplatePreview key={template.id} template={template} listing={listing} selected={template.id === selectedTemplate.id} language={language} onSelect={() => setSelectedTemplateId(template.id)} />)}</div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <button type="button" onClick={() => void handleShareCard()} disabled={Boolean(busyAction)} className="rawaj-button-primary min-h-12 justify-center gap-2 rounded-2xl px-4 py-3 disabled:opacity-50"><Share2 className="h-4 w-4" />{text("شارك البطاقة", "Share card")}</button>
                <button type="button" onClick={handleWhatsApp} disabled={Boolean(busyAction)} className="min-h-12 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-700 disabled:opacity-50"><span className="flex items-center justify-center gap-2"><MessageCircle className="h-4 w-4" />WhatsApp</span></button>
                <button type="button" onClick={() => void handleDownload()} disabled={Boolean(busyAction)} className="min-h-12 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-black"><span className="flex items-center justify-center gap-2"><Download className="h-4 w-4" />{text("تنزيل", "Download")}</span></button>
                <button type="button" onClick={() => void handleCopy()} disabled={Boolean(busyAction)} className="min-h-12 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-black"><span className="flex items-center justify-center gap-2"><Copy className="h-4 w-4" />{text("نسخ الرابط", "Copy link")}</span></button>
              </div>
              {notice ? <p className="mt-4 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">{notice}</p> : null}
            </>
          ) : (
            <div className="rounded-2xl border border-border p-5 text-sm text-muted-foreground">{notice ?? text("تعذر تحميل الإعلان الآن.", "Could not load the listing right now.")}</div>
          )}
        </div>
      </section>
    </div>
  );
}

function ShareTemplatePreview({ template, listing, selected, language, onSelect }: { template: ListingShareTemplate; listing: ClassifiedListing; selected: boolean; language: string; onSelect: () => void }) {
  return <button type="button" onClick={onSelect} className={`overflow-hidden rounded-2xl border p-2 text-start ${selected ? "border-brand-orange ring-2 ring-brand-orange/20" : "border-border"}`}><div className="aspect-[4/5] rounded-xl bg-primary/8 p-2 text-[10px] font-bold"><div className="line-clamp-3">{listing.title}</div></div><span className="mt-2 block text-[10px] font-black">{language === "en" ? template.labelEn : template.labelAr}</span></button>;
}

async function renderListingShareCard(listing: ClassifiedListing, template: ListingShareTemplate, shareUrl: string, language: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = template.story ? 1080 : 1200;
  canvas.height = template.story ? 1920 : 1200;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#f59e0b";
  ctx.font = `700 ${Math.round(canvas.width * 0.055)}px Arial`;
  ctx.fillText("RAWAJ", 70, 110);
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${Math.round(canvas.width * 0.05)}px Arial`;
  wrapText(ctx, listing.title, 70, 220, canvas.width - 140, 70);
  ctx.font = `500 ${Math.round(canvas.width * 0.024)}px Arial`;
  ctx.fillStyle = "#d1d5db";
  wrapText(ctx, shareUrl, 70, canvas.height - 140, canvas.width - 140, 42);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("blob_failed")), "image/png", 0.92));
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(/\s+/);
  let line = "";
  let cursorY = y;
  for (const word of words) {
    const test = `${line}${word} `;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = `${word} `;
      cursorY += lineHeight;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, cursorY);
}

function listingPriceLabel(listing: ClassifiedListing, language: string) {
  if (listing.priceLabel) return listing.priceLabel;
  if (typeof listing.priceAmount === "number") return new Intl.NumberFormat(language === "en" ? "en-US" : "ar-SY").format(listing.priceAmount);
  return "";
}

function listingLocationLabel(listing: ClassifiedListing, language: string) {
  const anyListing = listing as ClassifiedListing & { governorate?: string | null; cityArea?: string | null; locationLabel?: string | null };
  return anyListing.locationLabel || [anyListing.cityArea, anyListing.governorate].filter(Boolean).join(" · ");
}

function safelyCanShare(check: () => boolean) { try { return check(); } catch { return false; } }
function downloadBlob(blob: Blob, filename: string) { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
async function copyText(value: string) { if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value); const textarea = document.createElement("textarea"); textarea.value = value; document.body.appendChild(textarea); textarea.select(); document.execCommand("copy"); textarea.remove(); }
