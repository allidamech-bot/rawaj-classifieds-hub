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
import type { HomeCategoryWorld } from "@/features/home/home-category-discovery";
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
  worlds: HomeCategoryWorld[];
  language: "ar" | "en";
  text: (ar: string, en: string) => string;
}

export function CategoryWorlds({ worlds, language, text }: CategoryWorldsProps) {
  if (worlds.length === 0) return null;

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
        {worlds.map((world, index) => {
          const Icon = categoryIcons[world.iconKey ?? ""] ?? Grid3X3;
          const content = (
            <>
              <span className="rawaj-category-world__orb" aria-hidden="true" />
              <span className="rawaj-category-world__icon">
                <Icon strokeWidth={1.7} />
              </span>
              <span className="rawaj-category-world__copy">
                <strong>{worldName(world, language)}</strong>
                <small>
                  {(language === "en" ? world.descriptionEn : world.descriptionAr) ??
                    text("استكشف الإعلانات", "Explore listings")}
                </small>
              </span>
              <ChevronRight
                className="rawaj-category-world__arrow rtl:rotate-180"
                strokeWidth={1.8}
              />
            </>
          );

          const sharedProps = {
            className: "rawaj-category-world",
            "data-size": index < 2 ? ("large" as const) : ("compact" as const),
            "data-tone": worldTones[index % worldTones.length],
          };

          if (world.target.kind === "legacy") {
            return (
              <Link
                key={world.id}
                to="/category/$slug"
                params={{ slug: world.target.slug }}
                {...sharedProps}
              >
                {content}
              </Link>
            );
          }
          if (world.target.kind === "directory") {
            return (
              <Link
                key={world.id}
                to="/categories"
                search={{ node: world.target.node }}
                {...sharedProps}
              >
                {content}
              </Link>
            );
          }
          return (
            <Link key={world.id} to="/listings" search={world.target.search} {...sharedProps}>
              {content}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function worldName(world: HomeCategoryWorld, language: "ar" | "en") {
  if (language === "ar") return world.nameAr;
  if (world.nameEn) return world.nameEn;
  return world.legacyCategoryId
    ? categoryName(world.legacyCategoryId, world.nameAr, language)
    : world.nameAr;
}
