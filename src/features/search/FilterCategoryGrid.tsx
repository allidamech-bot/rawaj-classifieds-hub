import {
  Briefcase,
  Building2,
  Car,
  Grid3X3,
  Laptop,
  PawPrint,
  Shirt,
  Smartphone,
  Sparkles,
  Store,
  Utensils,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { ClassifiedCategory } from "@/lib/classifieds-types";
import { categoryName } from "@/lib/i18n";

const categoryIcons: Record<string, LucideIcon> = {
  car: Car,
  realestate: Building2,
  phone: Smartphone,
  electronics: Laptop,
  furniture: Store,
  job: Briefcase,
  service: Wrench,
  fashion: Shirt,
  food: Utensils,
  animals: PawPrint,
  business: Store,
  misc: Sparkles,
};

interface FilterCategoryGridProps {
  categories: ClassifiedCategory[];
  selectedCategory?: ClassifiedCategory;
  language: "ar" | "en";
  onSelect: (categoryId: string) => void;
  text: (ar: string, en: string) => string;
}

export function FilterCategoryGrid({
  categories,
  selectedCategory,
  language,
  onSelect,
  text,
}: FilterCategoryGridProps) {
  return (
    <div className="rawaj-filter-category-grid" data-source="live-categories">
      <button
        type="button"
        onClick={() => onSelect("")}
        aria-pressed={!selectedCategory}
        data-selected={!selectedCategory}
      >
        <span>
          <Grid3X3 aria-hidden="true" />
        </span>
        <strong>{text("كل الأقسام", "All categories")}</strong>
      </button>
      {categories.map((category) => {
        const Icon = categoryIcons[category.placeholder] ?? Grid3X3;
        const selected = selectedCategory?.id === category.id;
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category.id)}
            aria-pressed={selected}
            data-selected={selected}
          >
            <span>
              <Icon aria-hidden="true" />
            </span>
            <strong>{categoryName(category.id, category.nameAr, language)}</strong>
          </button>
        );
      })}
    </div>
  );
}
