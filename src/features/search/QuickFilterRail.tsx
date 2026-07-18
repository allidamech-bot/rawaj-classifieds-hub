import { Camera, MapPin, Shapes, Sparkles, Tag, X } from "lucide-react";
import type { CategoryFieldKind } from "@/lib/category-fields";

type QuickFilterSection = "location" | "price" | "category" | "condition";

interface QuickFilterRailProps {
  locationLabel: string;
  priceActive: boolean;
  categoryLabel: string;
  categoryActive: boolean;
  conditionActive: boolean;
  showCondition: boolean;
  withPhotos: boolean;
  newestActive: boolean;
  hasActiveFilters: boolean;
  onOpenFilters: () => void;
  onNewest: () => void;
  onTogglePhotos: () => void;
  onReset: () => void;
  fieldKind: CategoryFieldKind;
  text: (ar: string, en: string) => string;
}

export function QuickFilterRail({
  locationLabel,
  priceActive,
  categoryLabel,
  categoryActive,
  conditionActive,
  showCondition,
  withPhotos,
  newestActive,
  hasActiveFilters,
  onOpenFilters,
  onNewest,
  onTogglePhotos,
  onReset,
  fieldKind,
  text,
}: QuickFilterRailProps) {
  function openSection(section: QuickFilterSection) {
    onOpenFilters();

    const headingBySection: Record<QuickFilterSection, string> = {
      location: text("الموقع", "Location"),
      price: text("السعر", "Price"),
      category: text("القسم", "Category"),
      condition: text("خيارات القسم", "Category options"),
    };

    window.setTimeout(() => {
      const targetHeading = headingBySection[section];
      const sections = Array.from(
        document.querySelectorAll<HTMLElement>(".rawaj-filter-sheet__section"),
      );
      const target = sections.find(
        (item) => item.querySelector("h3")?.textContent?.trim() === targetHeading,
      );

      if (!target) return;
      target.scrollIntoView({ block: "start", behavior: "smooth" });
      window.setTimeout(() => {
        target
          .querySelector<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled])")
          ?.focus({ preventScroll: true });
      }, 220);
    }, 80);
  }

  return (
    <nav
      className="rawaj-quick-filter-rail"
      aria-label={text("فلاتر سريعة", "Quick filters")}
      data-state-contract="contextual-url-filters"
      data-has-active-filters={hasActiveFilters}
    >
      <button type="button" onClick={onNewest} data-active={newestActive}>
        <Sparkles aria-hidden="true" />
        <span>{text("الأحدث", "Newest")}</span>
      </button>
      <button
        type="button"
        onClick={() => openSection("location")}
        data-active={locationLabel !== text("كل سوريا", "All Syria")}
      >
        <MapPin aria-hidden="true" />
        <span>{locationLabel}</span>
      </button>
      <button type="button" onClick={() => openSection("price")} data-active={priceActive}>
        <Tag aria-hidden="true" />
        <span>{priceActive ? text("السعر محدد", "Price set") : text("السعر", "Price")}</span>
      </button>
      <button type="button" onClick={() => openSection("category")} data-active={categoryActive}>
        <Shapes aria-hidden="true" />
        <span>{categoryLabel}</span>
      </button>
      {showCondition ? (
        <button
          type="button"
          onClick={() => openSection("condition")}
          data-active={conditionActive}
          data-kind={fieldKind}
        >
          <span className="rawaj-quick-filter-rail__dot" aria-hidden="true" />
          <span>
            {conditionActive ? text("الحالة محددة", "Condition set") : text("الحالة", "Condition")}
          </span>
        </button>
      ) : null}
      <button type="button" onClick={onTogglePhotos} data-active={withPhotos}>
        <Camera aria-hidden="true" />
        <span>{text("مع صور", "With photos")}</span>
      </button>
      {hasActiveFilters ? (
        <button type="button" onClick={onReset} data-tone="clear">
          <X aria-hidden="true" />
          <span>{text("مسح الكل", "Clear all")}</span>
        </button>
      ) : null}
    </nav>
  );
}
