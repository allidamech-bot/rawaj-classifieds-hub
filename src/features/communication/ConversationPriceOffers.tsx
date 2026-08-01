import { Check, Clock3, HandCoins, RefreshCw, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  createConversationPriceOffer,
  fetchConversationPriceOffers,
  transitionListingPriceOffer,
  type ConversationPriceOffersSnapshot,
  type ListingPriceOffer,
  type ListingPriceOfferAction,
  type ListingPriceOfferStatus,
} from "@/lib/classifieds-api";
import { useUiPreferences } from "@/lib/ui-preferences";

interface ConversationPriceOffersProps {
  conversationId: string;
  enabled: boolean;
}

export function ConversationPriceOffers({ conversationId, enabled }: ConversationPriceOffersProps) {
  const { language, text } = useUiPreferences();
  const [snapshot, setSnapshot] = useState<ConversationPriceOffersSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [counterInput, setCounterInput] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const requestGenerationRef = useRef(0);

  const offers = snapshot?.items ?? [];
  const pendingOffer = useMemo(
    () => [...offers].reverse().find((offer) => offer.status === "pending") ?? null,
    [offers],
  );

  useEffect(() => {
    const generation = ++requestGenerationRef.current;
    setSnapshot(null);
    setLoading(true);
    setError("");
    setNotice("");
    setAmountInput("");
    setCounterInput("");
    setBusyAction(null);
    void fetchConversationPriceOffers(conversationId)
      .then((result) => {
        if (generation !== requestGenerationRef.current) return;
        if (result.ok) setSnapshot(result.data);
        else setError(result.error.message);
      })
      .catch((caught) => {
        if (generation !== requestGenerationRef.current) return;
        setError(
          caught instanceof Error
            ? caught.message
            : text("تعذر تحميل عروض السعر.", "Could not load price offers."),
        );
      })
      .finally(() => {
        if (generation === requestGenerationRef.current) setLoading(false);
      });
    return () => {
      requestGenerationRef.current += 1;
    };
  }, [conversationId, text]);

  async function reload() {
    const generation = ++requestGenerationRef.current;
    setLoading(true);
    setError("");
    try {
      const result = await fetchConversationPriceOffers(conversationId);
      if (generation !== requestGenerationRef.current) return;
      if (result.ok) setSnapshot(result.data);
      else setError(result.error.message);
    } catch (caught) {
      if (generation !== requestGenerationRef.current) return;
      setError(
        caught instanceof Error
          ? caught.message
          : text("تعذر تحديث عروض السعر.", "Could not refresh price offers."),
      );
    } finally {
      if (generation === requestGenerationRef.current) setLoading(false);
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const amount = normalizedAmount(amountInput);
    if (!amount || busyAction) {
      if (!amount) setError(text("أدخل مبلغ عرض صحيحاً.", "Enter a valid offer amount."));
      return;
    }
    setBusyAction("create");
    setError("");
    setNotice("");
    try {
      const result = await createConversationPriceOffer({
        conversationId,
        amount,
        requestId: crypto.randomUUID(),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setAmountInput("");
      setNotice(text("تم إرسال عرض السعر.", "Price offer sent."));
      await reload();
    } finally {
      setBusyAction(null);
    }
  }

  async function handleTransition(offer: ListingPriceOffer, action: ListingPriceOfferAction) {
    if (busyAction) return;
    const amount = action === "counter" ? normalizedAmount(counterInput) : undefined;
    if (action === "counter" && !amount) {
      setError(text("أدخل مبلغ العرض المضاد.", "Enter a valid counteroffer amount."));
      return;
    }
    const confirmation = transitionConfirmation(action, text);
    if (!confirm(confirmation)) return;
    setBusyAction(`${offer.id}:${action}`);
    setError("");
    setNotice("");
    try {
      const result = await transitionListingPriceOffer({
        offerId: offer.id,
        action,
        amount: amount ?? undefined,
        expectedUpdatedAt: offer.updatedAt,
        requestId: crypto.randomUUID(),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setCounterInput("");
      setNotice(transitionSuccess(action, text));
      await reload();
    } finally {
      setBusyAction(null);
    }
  }

  const canCreateInitialOffer =
    enabled && snapshot?.listingAvailable === true && snapshot.role === "buyer" && !pendingOffer;

  return (
    <section
      data-price-offer-panel="true"
      aria-label={text("عروض السعر", "Price offers")}
      className="border-b border-border/60 bg-card/70 px-3 py-3 sm:px-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-xs font-extrabold text-foreground">
            <HandCoins className="h-4 w-4 text-primary" />
            {text("عروض السعر", "Price offers")}
          </p>
          <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
            {text(
              "العرض لا يعني بيع الإعلان تلقائياً. يجب على البائع إدارة حالة الإعلان بنفسه.",
              "Accepting an offer does not automatically mark the listing sold.",
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          disabled={loading || Boolean(busyAction)}
          className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-muted-surface px-2.5 text-[10px] font-bold text-foreground hairline"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {text("تحديث", "Refresh")}
        </button>
      </div>

      {error ? (
        <p
          className="mt-2 rounded-lg bg-destructive/10 p-2 text-[11px] font-semibold text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {notice ? (
        <p
          className="mt-2 rounded-lg bg-emerald-trust/10 p-2 text-[11px] font-semibold text-foreground"
          role="status"
        >
          {notice}
        </p>
      ) : null}

      {loading && !snapshot ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          {text("جاري تحميل عروض السعر.", "Loading price offers.")}
        </p>
      ) : null}

      {offers.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {offers.map((offer) => (
            <OfferHistoryCard
              key={offer.id}
              offer={offer}
              language={language}
              busy={Boolean(busyAction)}
              busyAction={busyAction}
              enabled={enabled}
              listingAvailable={snapshot?.listingAvailable === true}
              counterInput={counterInput}
              setCounterInput={setCounterInput}
              onTransition={handleTransition}
            />
          ))}
        </div>
      ) : snapshot ? (
        <p className="mt-3 rounded-xl bg-muted-surface p-3 text-[11px] text-muted-foreground">
          {snapshot.role === "buyer"
            ? text(
                "لم يتم تقديم عرض سعر بعد. يمكنك إرسال أول عرض من هنا.",
                "No price offer yet. You can send the first offer here.",
              )
            : text(
                "لم يصل أي عرض سعر على هذا الإعلان بعد.",
                "No price offer has been received for this listing yet.",
              )}
        </p>
      ) : null}

      {canCreateInitialOffer ? (
        <form onSubmit={handleCreate} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor={`offer-amount-${conversationId}`}>
            {text("مبلغ عرض السعر", "Price offer amount")}
          </label>
          <input
            id={`offer-amount-${conversationId}`}
            data-price-offer-input="initial"
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            value={amountInput}
            onChange={(event) => setAmountInput(event.target.value)}
            placeholder={text("أدخل مبلغ العرض", "Enter offer amount")}
            className="min-h-11 flex-1 rounded-xl bg-background px-3 text-sm font-bold text-foreground outline-none hairline focus:ring-2 focus:ring-primary/25"
          />
          <button
            type="submit"
            data-price-offer-action="create"
            disabled={Boolean(busyAction)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-extrabold text-primary-foreground disabled:opacity-60"
          >
            <HandCoins className="h-4 w-4" />
            {busyAction === "create"
              ? text("جارٍ الإرسال", "Sending")
              : text("إرسال العرض", "Send offer")}
          </button>
        </form>
      ) : null}

      {snapshot && !snapshot.listingAvailable && !pendingOffer ? (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-warning/10 p-3 text-[11px] font-semibold text-foreground">
          <Clock3 className="h-4 w-4 shrink-0 text-warning" />
          {text(
            "الإعلان غير متاح حالياً لعروض جديدة، لكن سجل العروض محفوظ.",
            "The listing is not available for new offers, but offer history is preserved.",
          )}
        </p>
      ) : null}
    </section>
  );
}

function OfferHistoryCard({
  offer,
  language,
  busy,
  busyAction,
  enabled,
  listingAvailable,
  counterInput,
  setCounterInput,
  onTransition,
}: {
  offer: ListingPriceOffer;
  language: "ar" | "en";
  busy: boolean;
  busyAction: string | null;
  enabled: boolean;
  listingAvailable: boolean;
  counterInput: string;
  setCounterInput: (value: string) => void;
  onTransition: (offer: ListingPriceOffer, action: ListingPriceOfferAction) => Promise<void>;
}) {
  const { text } = useUiPreferences();
  const isPending = offer.status === "pending";
  const isResponding = busyAction?.startsWith(`${offer.id}:`) ?? false;
  return (
    <article
      data-price-offer-card={offer.status}
      className={`rounded-xl border p-3 ${offerTone(offer.status)}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-base font-extrabold text-foreground">
            {formatOfferAmount(offer.amount, offer.currency, language)}
          </p>
          <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
            {offer.createdByMe
              ? text("أرسلته أنت", "Sent by you")
              : text("أرسله الطرف الآخر", "Sent by the other party")}
            {offer.parentOfferId ? ` · ${text("عرض مضاد", "Counteroffer")}` : ""}
          </p>
        </div>
        <span className="rounded-full bg-card/80 px-2.5 py-1 text-[10px] font-extrabold text-foreground hairline">
          {offerStatusLabel(offer.status, text)}
        </span>
      </div>
      <p className="mt-2 text-[9px] text-muted-foreground">
        {text("أُرسل", "Sent")}: {formatDateTime(offer.createdAt, language)}
        {isPending
          ? ` · ${text("ينتهي", "Expires")}: ${formatDateTime(offer.expiresAt, language)}`
          : offer.respondedAt
            ? ` · ${text("آخر إجراء", "Last action")}: ${formatDateTime(offer.respondedAt, language)}`
            : ""}
      </p>

      {isPending && offer.createdByMe && enabled ? (
        <button
          type="button"
          data-price-offer-action="withdraw"
          disabled={busy}
          onClick={() => void onTransition(offer, "withdraw")}
          className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-muted-surface px-3 text-[10px] font-bold text-foreground hairline disabled:opacity-60"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {isResponding ? text("جارٍ التنفيذ", "Working") : text("سحب العرض", "Withdraw")}
        </button>
      ) : null}

      {isPending && !offer.createdByMe && enabled ? (
        <div className="mt-3 grid gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-price-offer-action="accept"
              disabled={busy || !listingAvailable}
              onClick={() => void onTransition(offer, "accept")}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-trust/15 px-3 text-[10px] font-extrabold text-foreground disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5 text-emerald-trust" />
              {text("قبول", "Accept")}
            </button>
            <button
              type="button"
              data-price-offer-action="reject"
              disabled={busy}
              onClick={() => void onTransition(offer, "reject")}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-destructive/10 px-3 text-[10px] font-extrabold text-destructive disabled:opacity-60"
            >
              <X className="h-3.5 w-3.5" />
              {text("رفض", "Reject")}
            </button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              data-price-offer-input="counter"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={counterInput}
              disabled={busy || !listingAvailable}
              onChange={(event) => setCounterInput(event.target.value)}
              placeholder={text("مبلغ العرض المضاد", "Counteroffer amount")}
              className="min-h-10 flex-1 rounded-lg bg-background px-3 text-xs font-bold text-foreground outline-none hairline focus:ring-2 focus:ring-primary/25"
            />
            <button
              type="button"
              data-price-offer-action="counter"
              disabled={busy || !listingAvailable}
              onClick={() => void onTransition(offer, "counter")}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-3 text-[10px] font-extrabold text-primary disabled:opacity-60"
            >
              <HandCoins className="h-3.5 w-3.5" />
              {text("إرسال عرض مضاد", "Send counteroffer")}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function normalizedAmount(value: string): number | null {
  const amount = Number(value.replace(/[,_\s]/g, ""));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

function offerStatusLabel(
  status: ListingPriceOfferStatus,
  text: (ar: string, en: string) => string,
): string {
  if (status === "accepted") return text("مقبول", "Accepted");
  if (status === "rejected") return text("مرفوض", "Rejected");
  if (status === "countered") return text("تم الرد بعرض مضاد", "Countered");
  if (status === "withdrawn") return text("مسحوب", "Withdrawn");
  if (status === "expired") return text("منتهي", "Expired");
  return text("بانتظار الرد", "Pending");
}

function offerTone(status: ListingPriceOfferStatus): string {
  if (status === "accepted") return "border-emerald-trust/30 bg-emerald-trust/8";
  if (status === "rejected" || status === "expired")
    return "border-destructive/20 bg-destructive/5";
  if (status === "pending") return "border-primary/25 bg-primary/[0.035]";
  return "border-border/70 bg-muted-surface/70";
}

function transitionConfirmation(
  action: ListingPriceOfferAction,
  text: (ar: string, en: string) => string,
): string {
  if (action === "accept") {
    return text(
      "قبول عرض السعر؟ لن يتم إغلاق الإعلان أو اعتباره مباعاً تلقائياً.",
      "Accept this offer? The listing will not be marked sold automatically.",
    );
  }
  if (action === "reject") return text("رفض عرض السعر؟", "Reject this offer?");
  if (action === "withdraw") return text("سحب عرض السعر؟", "Withdraw this offer?");
  return text(
    "إرسال العرض المضاد وإنهاء العرض الحالي؟",
    "Send the counteroffer and close the current offer?",
  );
}

function transitionSuccess(
  action: ListingPriceOfferAction,
  text: (ar: string, en: string) => string,
): string {
  if (action === "accept") return text("تم قبول العرض.", "Offer accepted.");
  if (action === "reject") return text("تم رفض العرض.", "Offer rejected.");
  if (action === "withdraw") return text("تم سحب العرض.", "Offer withdrawn.");
  return text("تم إرسال العرض المضاد.", "Counteroffer sent.");
}

function formatOfferAmount(amount: number, currency: string, language: "ar" | "en") {
  return `${new Intl.NumberFormat(language === "ar" ? "ar-SY" : "en-US").format(amount)} ${currency}`;
}

function formatDateTime(value: string, language: "ar" | "en") {
  if (!value) return "";
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SY" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
