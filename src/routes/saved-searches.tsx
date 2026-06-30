import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, Bookmark, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { fetchSavedSearches } from "@/lib/classifieds-api";
import type { ClassifiedsError, SavedSearch } from "@/lib/classifieds-types";
import { uiLabel } from "@/lib/i18n";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/saved-searches")({
  head: () => ({ meta: [{ title: "عمليات البحث المحفوظة | رَوَاج" }] }),
  component: SavedSearchesPage,
});

function SavedSearchesPage() {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
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
    return (
      <State
        heading={text("جارٍ التحقق من الجلسة", "Checking session")}
        body={text("يتم التأكد من تسجيل الدخول.", "Checking sign-in status.")}
      />
    );
  }

  if (auth.status === "signedOut") {
    return (
      <State
        heading={text("تسجيل الدخول مطلوب", "Login required")}
        body={text(
          "عمليات البحث المحفوظة مرتبطة بحسابك فقط ولا توجد بيانات تجريبية بديلة.",
          "Saved searches are linked only to your account. No demo data is used as a substitute.",
        )}
        actionLabel={text("تسجيل الدخول", "Log in")}
        actionTo="/login"
      />
    );
  }

  if (auth.status === "authUnavailable") {
    return (
      <State
        heading={text("البحث المحفوظ قيد التفعيل", "Saved search is being activated")}
        body={text(
          "حفظ عمليات البحث سيعمل مع الحسابات بعد اكتمال التفعيل. يمكنك استخدام فلاتر التصفح حالياً.",
          "Saving searches will work with accounts after activation. You can use browse filters now.",
        )}
        actionLabel={text("ابدأ البحث", "Start searching")}
        actionTo="/listings"
      />
    );
  }

  return (
    <>
      <PageHeader title={text("عمليات البحث المحفوظة", "Saved searches")} />
      <main className="container-wide space-y-4 pt-4 pb-8">
        <div className="rounded-2xl bg-card p-4 hairline">
          <h2 className="text-sm font-extrabold">
            {text("عمليات البحث المحفوظة", "Saved searches")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {text(
              "تعرض هذه الصفحة عمليات البحث المحفوظة للحساب الحالي فقط، ولا تستخدم بيانات تجريبية كبديل.",
              "This page shows saved searches for the current account only and does not use demo data as a substitute.",
            )}
          </p>
        </div>

        {loading ? (
          <Panel title={text("جارٍ تحميل عمليات البحث", "Loading saved searches")} />
        ) : error ? (
          <Panel
            title={text("تعذر تحميل عمليات البحث", "Could not load saved searches")}
            body={text(
              "البحث المحفوظ قيد التفعيل حالياً. استخدم صفحة التصفح للبحث مباشرة.",
              "Saved search is being activated. Use the browse page to search directly.",
            )}
            actionLabel={text("تصفح الإعلانات", "Browse listings")}
            actionTo="/listings"
          />
        ) : items.length === 0 ? (
          <Panel
            title={text("لا توجد عمليات بحث محفوظة", "No saved searches yet")}
            body={text(
              "يمكن إضافة زر حفظ البحث لاحقاً بعد اعتماد تجربة البحث النهائية.",
              "A save-search button can be added later after the final search experience is approved.",
            )}
            actionLabel={text("ابدأ البحث", "Start searching")}
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
                      <span>{formatDate(item.createdAt, language)}</span>
                      <span>
                        {text("مرتبطة بالحساب الحالي فقط", "Linked only to the current account")}
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted-surface px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                    <Bell className="h-3 w-3" /> {text("تنبيهات قريباً", "Alerts soon")}
                  </span>
                </div>
                <div className="mt-3">
                  <Link
                    to="/listings"
                    search={item.filters}
                    className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                  >
                    {text("فتح البحث", "Open search")}
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
  const { text } = useUiPreferences();

  return (
    <>
      <PageHeader title={text("عمليات البحث المحفوظة", "Saved searches")} />
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
  const { language } = useUiPreferences();

  return (
    <div className="rounded-2xl bg-card p-10 text-center hairline">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted-surface">
        <Bookmark className="h-6 w-6 text-muted-foreground" />
      </span>
      <p className="mt-3 text-sm font-bold">{title}</p>
      {body && <p className="mt-1 text-xs text-muted-foreground">{body}</p>}
      {actionLabel && actionTo && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            to={actionTo}
            className="inline-block rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground"
          >
            {actionLabel}
          </Link>
          <Link
            to="/categories"
            className="inline-block rounded-xl bg-muted-surface px-5 py-2 text-sm font-bold text-foreground"
          >
            {uiLabel("تصفح الأقسام", language)}
          </Link>
        </div>
      )}
    </div>
  );
}

function formatDate(value: string, language: Language) {
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SY" : "en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}
