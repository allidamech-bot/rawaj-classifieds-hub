import { createFileRoute } from "@tanstack/react-router";
import { Clock, FileCheck, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { demoNotice, pendingListings } from "@/data/adminMockData";
import { adminFetchPendingListings } from "@/lib/classifieds-api";
import type { ClassifiedListing, ClassifiedsError } from "@/lib/classifieds-types";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/admin/pending")({
  component: PendingPage,
});

function PendingPage() {
  const auth = useAuth();
  const [realListings, setRealListings] = useState<ClassifiedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ClassifiedsError | null>(null);

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

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-warning/10 p-3 hairline text-xs text-foreground/90">
        طابور المراجعة الحقيقي يُقرأ من Supabase للمالك فقط. إجراءات القبول/الرفض الحقيقية يجب أن
        تبقى محمية بسياسات RLS ولا تعتمد على البريد.
      </div>

      <section className="rounded-2xl bg-card p-4 hairline">
        <h2 className="text-base font-extrabold">إعلانات حقيقية قيد المراجعة</h2>
        {loading ? (
          <p className="mt-2 text-xs text-muted-foreground">
            جارٍ تحميل طابور المراجعة من Supabase.
          </p>
        ) : error ? (
          <p className="mt-2 text-xs text-muted-foreground">{error.message}</p>
        ) : realListings.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            لا توجد إعلانات حقيقية قيد المراجعة حالياً.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3">
            {realListings.map((listing) => (
              <article key={listing.id} className="rounded-xl bg-muted-surface p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold">{listing.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {listing.id} · {listing.categoryNameAr ?? "قسم غير محدد"} ·{" "}
                      {listing.governorateNameAr ?? "سوريا"}
                    </p>
                  </div>
                  <Badge>{listing.status}</Badge>
                </div>
                <ActionRow actions={["قبول", "رفض", "أرشفة/إخفاء", "إضافة ملاحظة"]} />
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-3">
        <p className="rounded-2xl bg-card p-3 text-xs text-muted-foreground hairline">
          القائمة التالية نموذج UI تجريبي فقط وليست طابور إنتاج. {demoNotice}
        </p>
        {pendingListings.map((listing) => (
          <article key={listing.id} className="rounded-2xl bg-card p-4 hairline">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-extrabold">{listing.title}</h2>
                  <Badge>{listing.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {listing.id} · {listing.seller} · {listing.type}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-md bg-warning/15 px-2 py-1 text-[10px] font-bold text-warning">
                <Clock className="h-3 w-3" />
                قيد المراجعة
              </span>
            </div>
            <Info
              rows={[
                ["القسم", listing.category],
                ["المحافظة", listing.governorate],
                ["تاريخ الإرسال", listing.submitted],
                ["مستوى المخاطر", listing.risk],
                ["حالة المراجعة", listing.status],
                ["السبب/الملاحظة", listing.reason],
                ["المشرف المعيّن", listing.admin],
                ["ملاحظة داخلية placeholder", listing.note],
              ]}
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
            />
            <InternalNote />
          </article>
        ))}
      </div>

      <div className="rounded-2xl bg-card p-3 text-xs text-muted-foreground hairline">
        <ShieldAlert className="me-1 inline h-3.5 w-3.5 text-warning" />
        المشرفون يمكنهم مراجعة الطابور حسب صلاحياتهم فقط. قبول/رفض الإعلانات الحقيقي يتطلب Backend
        وصلاحيات وربط حسابات.
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-muted-surface px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
      {children}
    </span>
  );
}

function Info({ rows }: { rows: string[][] }) {
  return (
    <dl className="grid grid-cols-1 gap-2 text-xs md:grid-cols-4">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-muted-surface p-3">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="mt-1 font-bold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ActionRow({ actions }: { actions: string[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {actions.map((action) => (
        <button
          key={action}
          disabled
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground opacity-70 cursor-not-allowed"
        >
          <FileCheck className="h-3 w-3" />
          {action} · نموذج تجريبي
        </button>
      ))}
    </div>
  );
}

function InternalNote() {
  return (
    <div className="mt-3 rounded-xl bg-muted-surface p-3 text-xs">
      <b>ملاحظة داخلية</b>
      <p className="mt-1 text-muted-foreground">
        أضيفت بواسطة: مشرف تجريبي · التاريخ: placeholder · الحالة: غير مفعّلة
      </p>
      <button
        disabled
        className="mt-2 rounded-md bg-card px-2 py-1 text-[10px] font-bold hairline cursor-not-allowed"
      >
        إضافة ملاحظة · قريباً
      </button>
      <p className="mt-1 text-[11px] text-muted-foreground">
        الملاحظات الداخلية لا تظهر للمستخدمين.
      </p>
    </div>
  );
}
