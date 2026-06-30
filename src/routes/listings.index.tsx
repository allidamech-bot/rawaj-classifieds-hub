import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Clock, MapPin, Search, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import {
  fetchPublicCategories,
  fetchPublicGovernorates,
  fetchPublicListings,
} from "@/lib/classifieds-api";
import type {
  ClassifiedCategory,
  ClassifiedGovernorate,
  ClassifiedListing,
  ClassifiedsError,
} from "@/lib/classifieds-types";
import { priceLabel } from "@/utils/format";

const searchSchema = z.object({
  category: z.string().optional(),
  gov: z.string().optional(),
  q: z.string().optional(),
  sort: z.enum(["latest", "cheapest", "expensive", "featured"]).optional(),
});

export const Route = createFileRoute("/listings/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "تصفّح الإعلانات | رَوَاج" },
      { name: "description", content: "نتائج البحث والإعلانات على رَوَاج، السوق السوري المجاني." },
    ],
  }),
  component: ListingsPage,
});

function ListingsPage() {
  const search = Route.useSearch();
  const [sort, setSort] = useState<"latest" | "cheapest" | "expensive" | "featured">(
    search.sort ?? "latest",
  );
  const [govId, setGovId] = useState<string>("");
  const [q, setQ] = useState(search.q ?? "");
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<ClassifiedCategory[]>([]);
  const [governorates, setGovernorates] = useState<ClassifiedGovernorate[]>([]);
  const [items, setItems] = useState<ClassifiedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ClassifiedsError | null>(null);

  const selectedCategory = useMemo(
    () =>
      search.category
        ? categories.find(
            (category) => category.id === search.category || category.slug === search.category,
          )
        : undefined,
    [categories, search.category],
  );
  const selectedGovernorate = governorates.find((gov) => gov.id === govId);

  useEffect(() => {
    let cancelled = false;

    async function loadReferences() {
      setLoading(true);
      setError(null);

      const [categoriesResult, governoratesResult] = await Promise.all([
        fetchPublicCategories(),
        fetchPublicGovernorates(),
      ]);

      if (cancelled) return;

      if (!categoriesResult.ok) {
        setError(categoriesResult.error);
        setLoading(false);
        return;
      }

      if (!governoratesResult.ok) {
        setError(governoratesResult.error);
        setLoading(false);
        return;
      }

      setCategories(categoriesResult.data);
      setGovernorates(governoratesResult.data);
      const initialGov = search.gov
        ? governoratesResult.data.find((gov) => gov.id === search.gov || gov.slug === search.gov)
        : undefined;
      setGovId(initialGov?.id ?? "");
    }

    void loadReferences();

    return () => {
      cancelled = true;
    };
  }, [search.gov]);

  useEffect(() => {
    if (categories.length === 0 && governorates.length === 0) return;

    let cancelled = false;

    async function loadListings() {
      setLoading(true);
      setError(null);

      const result = await fetchPublicListings({
        categoryId: selectedCategory?.id,
        governorateId: govId || undefined,
        query: q,
        sort,
      });

      if (cancelled) return;

      if (!result.ok) {
        setError(result.error);
        setItems([]);
      } else {
        setItems(result.data);
      }

      setLoading(false);
    }

    void loadListings();

    return () => {
      cancelled = true;
    };
  }, [categories.length, governorates.length, selectedCategory?.id, govId, q, sort]);

  const title = selectedCategory ? selectedCategory.nameAr : "كل الإعلانات";
  const sortChips = [
    { id: "latest", label: "الأحدث" },
    { id: "cheapest", label: "الأرخص" },
    { id: "expensive", label: "الأعلى سعراً" },
    { id: "featured", label: "المميز" },
  ] as const;

  return (
    <>
      <PageHeader title={title} />
      <main className="container-wide pt-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
          <div className="flex items-center gap-2 rounded-xl bg-card px-3 py-2.5 hairline">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="ابحث ضمن الإعلانات المعتمدة..."
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <button
            onClick={() => setOpen((value) => !value)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
          >
            <MapPin className="h-4 w-4 text-gold" /> {selectedGovernorate?.nameAr ?? "كل سوريا"}
          </button>
        </div>

        {open && (
          <div className="mt-2 rounded-xl bg-card p-2 shadow-premium hairline">
            <div className="flex flex-wrap gap-2">
              <GovernorateChip
                active={!govId}
                label="كل سوريا"
                onClick={() => {
                  setGovId("");
                  setOpen(false);
                }}
              />
              {governorates.map((governorate) => (
                <GovernorateChip
                  key={governorate.id}
                  active={govId === governorate.id}
                  label={governorate.nameAr}
                  onClick={() => {
                    setGovId(governorate.id);
                    setOpen(false);
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {sortChips.map((chip) => (
            <button
              key={chip.id}
              onClick={() => setSort(chip.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                sort === chip.id
                  ? "bg-gold text-gold-foreground"
                  : "bg-card text-foreground hairline hover:bg-muted-surface"
              }`}
            >
              {chip.label}
            </button>
          ))}
          <button
            disabled
            title="قريباً"
            className="inline-flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-full bg-card px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hairline opacity-70"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> فلاتر أخرى · قريباً
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>{loading ? "جارٍ تحميل الإعلانات..." : `${items.length} إعلان معتمد`}</span>
          {selectedCategory && (
            <Link to="/listings" className="font-semibold text-primary">
              مسح الفلتر
            </Link>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/categories"
            className="rounded-full bg-card px-3 py-1.5 text-xs font-bold text-foreground hairline"
          >
            تصفح الأقسام
          </Link>
          {(q || govId || selectedCategory) && (
            <Link
              to="/listings"
              className="rounded-full bg-muted-surface px-3 py-1.5 text-xs font-bold text-muted-foreground"
            >
              إعادة ضبط الفلاتر
            </Link>
          )}
        </div>

        {loading ? (
          <StateCard
            title="جارٍ تحميل الإعلانات"
            body="نبحث عن الإعلانات المعتمدة المتاحة للتصفح داخل سوريا."
          />
        ) : error ? (
          <StateCard
            title={
              error.code === "schema_missing" || error.code === "supabase_unconfigured"
                ? "الإعلانات الحقيقية قيد التفعيل"
                : "تعذر تحميل الإعلانات"
            }
            body={
              error.code === "schema_missing" || error.code === "supabase_unconfigured"
                ? "ستظهر الإعلانات هنا بعد اكتمال الربط التشغيلي. يمكنك حالياً تصفح بنية رَوَاج وتجهيز إعلانك."
                : error.message
            }
            actionLabel="العودة للرئيسية"
            actionTo="/"
          />
        ) : items.length === 0 ? (
          <StateCard
            title="لا توجد إعلانات مطابقة حالياً"
            body="كن أول من يضيف إعلاناً في هذا القسم. تظهر هنا الإعلانات المعتمدة فقط بعد المراجعة."
            actionLabel="أضف إعلانك"
            actionTo="/add-listing"
          />
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((listing) => (
              <RealListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function GovernorateChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted-surface text-foreground hover:bg-secondary"
      }`}
    >
      {label}
    </button>
  );
}

function RealListingCard({ listing }: { listing: ClassifiedListing }) {
  return (
    <Link
      to="/listings/$id"
      params={{ id: listing.id }}
      className="group block overflow-hidden rounded-2xl bg-card hairline shadow-soft transition-shadow hover:shadow-premium"
    >
      <div className="relative">
        <PlaceholderArt type={listing.categoryPlaceholder ?? "misc"} aspect="wide" />
        <div className="absolute top-2 start-2 flex flex-wrap gap-1">
          {listing.isFeatured && (
            <span className="rounded-md bg-gold px-2 py-0.5 text-[11px] font-bold text-gold-foreground">
              مميز
            </span>
          )}
          <span className="rounded-md bg-emerald-trust px-2 py-0.5 text-[11px] font-bold text-emerald-trust-foreground">
            معتمد
          </span>
        </div>
        <span className="absolute bottom-2 end-2 rounded-md bg-primary/85 px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
          {listing.categoryNameAr ?? "إعلان"}
        </span>
      </div>
      <div className="space-y-1.5 p-3">
        <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-foreground">
          {listing.title}
        </h3>
        <div className="text-lg font-extrabold text-foreground">
          {priceLabel(listing.price ?? 0, listing.priceType)}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {listing.governorateNameAr ?? "سوريا"}
            {listing.districtAr ? ` · ${listing.districtAr}` : ""}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {formatDate(listing.createdAt)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function StateCard({
  title,
  body,
  actionLabel,
  actionTo,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  actionTo?: string;
}) {
  return (
    <div className="mt-10 rounded-2xl bg-card p-10 text-center hairline">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      {actionLabel && actionTo && (
        <Link
          to={actionTo}
          className="mt-4 inline-block rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return "تاريخ غير متاح";
  return new Intl.DateTimeFormat("ar-SY", { dateStyle: "medium" }).format(new Date(value));
}
