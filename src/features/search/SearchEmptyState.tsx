import { Link } from "@tanstack/react-router";
import { Grid3X3, RotateCcw, SearchX } from "lucide-react";

export function SearchEmptyState({
  hasActiveFilters,
  onReset,
  text,
}: {
  hasActiveFilters: boolean;
  onReset: () => void;
  text: (ar: string, en: string) => string;
}) {
  return (
    <section
      className="rawaj-search-empty-state"
      data-recovery-actions="filters-categories-post"
      aria-live="polite"
    >
      <span className="rawaj-search-empty-state__icon">
        <SearchX aria-hidden="true" />
      </span>
      <h2>{text("لا توجد إعلانات مطابقة الآن", "No matching listings right now")}</h2>
      <p>
        {text(
          "وسّع نطاق البحث أو غيّر القسم والموقع للوصول إلى خيارات أكثر.",
          "Broaden the search or change the category and location to find more options.",
        )}
      </p>
      <div className="rawaj-category-empty-actions">
        {hasActiveFilters ? (
          <button type="button" onClick={onReset}>
            <RotateCcw aria-hidden="true" />
            {text("تخفيف الفلاتر", "Clear filters")}
          </button>
        ) : null}
        <Link to="/categories">
          <Grid3X3 aria-hidden="true" />
          {text("تصفح الأقسام", "Browse categories")}
        </Link>
        <Link to="/add-listing" data-tone="primary">
          {text("أضف إعلانك", "Post your listing")}
        </Link>
      </div>
    </section>
  );
}
