import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, Bookmark, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { fetchSavedSearches } from "@/lib/classifieds-api";
import type { ClassifiedsError, SavedSearch } from "@/lib/classifieds-types";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/saved-searches")({
  head: () => ({ meta: [{ title: "عمليات البحث المحفوظة | رَوَاج" }] }),
  component: SavedSearchesPage,
});

function SavedSearchesPage() {
  const auth = useAuth();
  const [items, setItems] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ClassifiedsError | null>(null);

  useEffect(() => {
    if (auth.status !== "signedIn") return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      const result = await fetchSavedSearches(auth.profile?.id ?? null);

      if (cancelled) return;

      if (!result.ok) {
        setError(result.error);
        setItems([]);
      } else {
        setItems(result.data);
      }

      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [auth.status, auth.profile?.id]);

  if (auth.status === "loading") {
    return <State heading="جارٍ التحقق من الجلسة" body="يتم التأكد من تسجيل الدخول." />;
  }

  if (auth.status === "signedOut") {
    return (
      <State
        heading="تسجيل الدخول مطلوب"
        body="عمليات البحث المحفوظة مرتبطة بحسابك فقط ولا توجد بيانات تجريبية بديلة."
        actionLabel="تسجيل الدخول"
        actionTo="/login"
      />
    );
  }

  if (auth.status === "authUnavailable") {
    return (
      <State
        heading="Supabase غير مهيأ"
        body="عرض البحث المحفوظ يحتاج ضبط متغيرات Supabase العامة أولاً."
      />
    );
  }

  return (
    <>
      <PageHeader title="عمليات البحث المحفوظة" />
      <main className="container-wide space-y-4 pt-4 pb-8">
        <div className="rounded-2xl bg-card p-4 hairline">
          <h2 className="text-sm font-extrabold">عمليات البحث المحفوظة</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            تعرض هذه الصفحة عمليات البحث المحفوظة للحساب الحالي من Supabase فقط.
          </p>
        </div>

        {loading ? (
          <Panel title="جارٍ تحميل عمليات البحث" />
        ) : error ? (
          <Panel title={error.message} />
        ) : items.length === 0 ? (
          <Panel
            title="لا توجد عمليات بحث محفوظة"
            body="يمكن إضافة زر حفظ البحث لاحقاً بعد اعتماد تجربة البحث النهائية."
            actionLabel="ابدأ البحث"
            actionTo="/listings"
          />
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="rounded-2xl bg-card p-4 hairline">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-gold" />
                      <span className="truncate text-sm font-bold">{item.nameAr}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span>{formatDate(item.createdAt)}</span>
                      <span>مرتبطة بالحساب الحالي فقط</span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted-surface px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                    <Bell className="h-3 w-3" /> تنبيهات قريباً
                  </span>
                </div>
                <div className="mt-3">
                  <Link
                    to="/listings"
                    search={item.filters}
                    className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                  >
                    فتح البحث
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function State({
  heading,
  body,
  actionLabel,
  actionTo,
}: {
  heading: string;
  body: string;
  actionLabel?: string;
  actionTo?: string;
}) {
  return (
    <>
      <PageHeader title="عمليات البحث المحفوظة" />
      <main className="container-wide pt-10">
        <Panel title={heading} body={body} actionLabel={actionLabel} actionTo={actionTo} />
      </main>
    </>
  );
}

function Panel({
  title,
  body,
  actionLabel,
  actionTo,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  actionTo?: string;
}) {
  return (
    <div className="rounded-2xl bg-card p-10 text-center hairline">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted-surface">
        <Bookmark className="h-6 w-6 text-muted-foreground" />
      </span>
      <p className="mt-3 text-sm font-bold">{title}</p>
      {body && <p className="mt-1 text-xs text-muted-foreground">{body}</p>}
      {actionLabel && actionTo && (
        <Link
          to={actionTo}
          className="mt-5 inline-block rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar-SY", { dateStyle: "medium" }).format(new Date(value));
}
