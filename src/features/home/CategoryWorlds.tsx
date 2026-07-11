import { Link } from "@tanstack/react-router";
import {
  Briefcase,
  Building2,
  Car,
  ChevronRight,
  GraduationCap,
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
import { SectionHeader } from "@/components/shell/spatial-primitives";
import type { ClassifiedCategory } from "@/lib/classifieds-types";
import { categoryName } from "@/lib/i18n";

const categoryIcons: Record<string, LucideIcon> = {
  car: Car,
  realestate: Building2,
  phone: Smartphone,
  electronics: Laptop,
  furniture: Building2,
  job: Briefcase,
  service: Wrench,
  fashion: Shirt,
  food: Utensils,
  animals: PawPrint,
  education: GraduationCap,
  business: Store,
  misc: Sparkles,
};

const worldTones = ["orange", "sage", "gold", "plum", "indigo", "warm"] as const;

interface CategoryWorldsProps {
  categories: ClassifiedCategory[];
  language: "ar" | "en";
  text: (ar: string, en: string) => string;
}

export function CategoryWorlds({ categories, language, text }: CategoryWorldsProps) {
  const visibleCategories = categories.slice(0, 6);
  if (visibleCategories.length === 0) return null;

  return (
    <section className="rawaj-category-worlds" aria-labelledby="rawaj-category-worlds-title">
      <SectionHeader
        eyebrow={text("عوالم السوق", "Marketplace worlds")}
        title={
          <span id="rawaj-category-worlds-title">
            {text("ابدأ من القسم", "Start with a category")}
          </span>
        }
        action={
          <Link to="/categories" className="rawaj-section-link">
            {text("كل الأقسام", "All categories")}
            <ChevronRight className="h-4 w-4 rtl:rotate-180" strokeWidth={1.9} />
          </Link>
        }
      />

      <div className="rawaj-category-worlds__grid">
        {visibleCategories.map((category, index) => {
          const Icon = categoryIcons[category.placeholder] ?? Grid3X3;
          return (
            <Link
              key={category.id}
              to="/listings"
              search={{ category: category.id }}
              className="rawaj-category-world"
              data-size={index < 2 ? "large" : "compact"}
              data-tone={worldTones[index % worldTones.length]}
            >
              <span className="rawaj-category-world__orb" aria-hidden="true" />
              <span className="rawaj-category-world__icon">
                <Icon strokeWidth={1.7} />
              </span>
              <span className="rawaj-category-world__copy">
                <strong>{categoryName(category.id, category.nameAr, language)}</strong>
                <small>{category.hintAr ?? text("استكشف الإعلانات", "Explore listings")}</small>
              </span>
              <ChevronRight
                className="rawaj-category-world__arrow rtl:rotate-180"
                strokeWidth={1.8}
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
