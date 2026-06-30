import { createFileRoute } from "@tanstack/react-router";
import { Clock, FileCheck, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { demoNotice, pendingListings } from "@/data/adminMockData";
import { adminFetchPendingListings, adminModerateListing } from "@/lib/classifieds-api";
import type { ClassifiedListing, ClassifiedsError } from "@/lib/classifieds-types";
import { categoryName, governorateName, uiLabel } from "@/lib/i18n";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/admin/pending")({
  component: PendingPage,
});

function PendingPage() {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const [realListings, setRealListings] = useState<ClassifiedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const [message, setMessage] = useState("");
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});

  async function loadPending() {
    setLoading(true);
    setError(null);
    const result = await adminFetchPendingListings(auth.canAccessOwnerControls);

    if (!result.ok) {
      setError(result.error);
      setRealListings([]);
    } else {
      setRealListings(result.data);
    }

    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      const result = await adminFetchPendingListings(auth.canAccessOwnerControls);

      if (cancelled) return;

      if (!result.ok) {
        setError(result.error);
        setRealListings([]);
      } else {
        setRealListings(result.data);
      }

      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [auth.canAccessOwnerControls]);

  async function moderate(listing: ClassifiedListing, status: "approved" | "rejected") {
    setMessage("");
    if (!auth.profile?.id) {
      setMessage(
        text(
          "تعذر تحديد حساب المراجع الحالي. أعد تسجيل الدخول ثم حاول مجدداً.",
          "Could not identify the current reviewer account. Log in again and try once more.",
        ),
      );
      return;
    }

    const result = await adminModerateListing(auth.canAccessOwnerControls, {
      listingId: listing.id,
      status,
      reviewerId: auth.profile.id,
      rejectionReason:
        status === "rejected" ? rejectReasons[listing.id] || "مرفوض من لوحة المالك" : null,
    });

    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    setMessage(
      status === "approved"
        ? text("تم اعتماد الإعلان.", "Listing approved.")
        : text("تم رفض الإعلان.", "Listing rejected."),
    );
    await loadPending();
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-warning/10 p-3 hairline text-xs text-foreground/90">
        {text(
          "طابور المراجعة الحقيقي يُقرأ من مصدر البيانات للمالك فقط. إجراءات القبول/الرفض الحقيقية يجب أن تبقى محمية بسياسات RLS ولا تعتمد على البريد.",
          "The real review queue is read from the data source for the owner only. Real approve/reject actions must remain protected by RLS policies and must not rely on email.",
        )}
      </div>

      <section className="rounded-2xl bg-card p-4 hairline">
        <h2 className="text-base font-extrabold">
          {uiLabel("إعلانات حقيقية قيد المراجعة", language)}
        </h2>
        {message && (
          <p className="mt-2 rounded-xl bg-muted-surface p-2 text-xs font-semibold">{message}</p>
        )}
        {loading ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {uiLabel("جارٍ تحميل طابور المراجعة الحقيقي.", language)}
          </p>
        ) : error ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {uiLabel(
              "طابور المراجعة قيد التفعيل حالياً. ستظهر الإعلانات المرسلة للمراجعة هنا عند اكتمال الربط.",
              language,
            )}
          </p>
        ) : realListings.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {uiLabel("لا توجد إعلانات حقيقية قيد المراجعة حالياً.", language)}
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3">
            {realListings.map((listing) => (
              <article key={listing.id} className="rounded-xl bg-muted-surface p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold">{listing.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {listing.id} ·{" "}
                      {categoryName(
                        listing.categoryId,
                        listing.categoryNameAr ?? undefined,
                        language,
                      )}{" "}
                      ·{" "}
                      {governorateName(
                        listing.governorateId,
                        listing.governorateNameAr ?? undefined,
                        language,
                      )}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {text("صاحب الإعلان:", "Listing owner:")} {listing.ownerId} ·{" "}
                      {text("تاريخ الإرسال:", "Submitted:")}{" "}
                      {formatDate(listing.createdAt, language)}
                    </p>
                  </div>
                  <Badge>{uiLabel(listing.status, language)}</Badge>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    value={rejectReasons[listing.id] ?? ""}
                    onChange={(event) =>
                      setRejectReasons((current) => ({
                        ...current,
                        [listing.id]: event.target.value,
                      }))
                    }
                    placeholder={uiLabel("سبب الرفض عند الحاجة", language)}
                    className="rounded-xl bg-card px-3 py-2 text-xs outline-none hairline"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => void moderate(listing, "approved")}
                      className="rounded-xl bg-emerald-trust px-3 py-2 text-xs font-bold text-emerald-trust-foreground"
                    >
                      {uiLabel("اعتماد", language)}
                    </button>
                    <button
                      onClick={() => void moderate(listing, "rejected")}
                      className="rounded-xl bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground"
                    >
                      {uiLabel("رفض", language)}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-3">
        <p className="rounded-2xl bg-card p-3 text-xs text-muted-foreground hairline">
          {uiLabel("القائمة التالية نموذج UI تجريبي فقط وليست طابور إنتاج.", language)}{" "}
          {uiLabel(demoNotice, language)}
        </p>
        {pendingListings.map((listing) => (
          <article key={listing.id} className="rounded-2xl bg-card p-4 hairline">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-extrabold">{listing.title}</h2>
                  <Badge>{uiLabel(listing.status, language)}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {listing.id} · {listing.seller} · {listing.type}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-md bg-warning/15 px-2 py-1 text-[10px] font-bold text-warning">
                <Clock className="h-3 w-3" />
                {uiLabel("قيد المراجعة", language)}
              </span>
            </div>
            <Info
              rows={[
                ["القسم", uiLabel(listing.category, language)],
                ["المحافظة", uiLabel(listing.governorate, language)],
                ["تاريخ الإرسال", listing.submitted],
                ["مستوى المخاطر", uiLabel(listing.risk, language)],
                ["حالة المراجعة", uiLabel(listing.status, language)],
                ["السبب/الملاحظة", uiLabel(listing.reason, language)],
                ["المشرف المعيّن", uiLabel(listing.admin, language)],
                ["ملاحظة داخلية قيد التجهيز", uiLabel(listing.note, language)],
              ]}
              language={language}
            />
            <ActionRow
              actions={[
                "عرض التفاصيل",
                "قبول",
                "رفض",
                "طلب تعديل",
                "إضافة ملاحظة",
                "طلب مراجعة المالك",
              ]}
              language={language}
            />
            <InternalNote language={language} />
          </article>
        ))}
      </div>

      <div className="rounded-2xl bg-card p-3 text-xs text-muted-foreground hairline">
        <ShieldAlert className="me-1 inline h-3.5 w-3.5 text-warning" />
        {text(
          "المشرفون يمكنهم مراجعة الطابور حسب صلاحياتهم فقط. قبول/رفض الإعلانات الحقيقي يتطلب ربطاً تشغيلياً وصلاحيات وربط حسابات.",
          "Moderators can review the queue only within their permissions. Real approve/reject actions require operational integration, permissions, and accounts.",
        )}
      </div>
    </div>
  );
}

function formatDate(value: string, language: Language) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SY" : "en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-muted-surface px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
      {children}
    </span>
  );
}

function Info({ rows, language }: { rows: string[][]; language: Language }) {
  return (
    <dl className="grid grid-cols-1 gap-2 text-xs md:grid-cols-4">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-muted-surface p-3">
          <dt className="text-muted-foreground">{uiLabel(label, language)}</dt>
          <dd className="mt-1 font-bold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ActionRow({ actions, language }: { actions: string[]; language: Language }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {actions.map((action) => (
        <button
          key={action}
          disabled
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground opacity-70 cursor-not-allowed"
        >
          <FileCheck className="h-3 w-3" />
          {uiLabel(action, language)} · {uiLabel("نموذج تجريبي", language)}
        </button>
      ))}
    </div>
  );
}

function InternalNote({ language }: { language: Language }) {
  return (
    <div className="mt-3 rounded-xl bg-muted-surface p-3 text-xs">
      <b>{uiLabel("ملاحظة داخلية", language)}</b>
      <p className="mt-1 text-muted-foreground">
        {uiLabel("أضيفت بواسطة: مشرف تجريبي · التاريخ: قيد التجهيز · الحالة: غير مفعّلة", language)}
      </p>
      <button
        disabled
        className="mt-2 rounded-md bg-card px-2 py-1 text-[10px] font-bold hairline cursor-not-allowed"
      >
        {uiLabel("إضافة ملاحظة · قريباً", language)}
      </button>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {uiLabel("الملاحظات الداخلية لا تظهر للمستخدمين.", language)}
      </p>
    </div>
  );
}
