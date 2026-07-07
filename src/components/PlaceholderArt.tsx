import {
  Armchair,
  Briefcase,
  Building2,
  Car,
  GraduationCap,
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
import type { PlaceholderType } from "@/types";

// Unified geometric category-icon system.
// - Same container treatment across categories
// - Same stroke family (Lucide)
// - Same visual weight
// - Clearly a category symbol, never a fake product image
const glyphs: Record<PlaceholderType, LucideIcon> = {
  car: Car,
  realestate: Building2,
  phone: Smartphone,
  electronics: Laptop,
  furniture: Armchair,
  job: Briefcase,
  service: Wrench,
  fashion: Shirt,
  food: Utensils,
  animals: PawPrint,
  education: GraduationCap,
  business: Store,
  misc: Sparkles,
};

interface Props {
  type: PlaceholderType;
  label?: string;
  className?: string;
  aspect?: "square" | "standard" | "wide" | "tall";
}

export function PlaceholderArt({ type, label, className = "", aspect = "wide" }: Props) {
  const Icon = glyphs[type] ?? Sparkles;
  const ratio =
    aspect === "square"
      ? "aspect-square"
      : aspect === "standard"
        ? "aspect-[4/3]"
        : aspect === "tall"
          ? "aspect-[4/5]"
          : "aspect-[16/10]";

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl ${ratio} ${className}`}
      aria-hidden="true"
      style={{
        background:
          "linear-gradient(135deg, #f6efdc 0%, #ffffff 55%, #efe6cc 100%)",
      }}
    >
      {/* subtle geometric plane */}
      <span
        className="pointer-events-none absolute -end-6 -top-6 block h-24 w-24 rotate-12 rounded-2xl opacity-70"
        style={{
          background:
            "linear-gradient(140deg, rgba(14,42,68,0.10), rgba(14,42,68,0) 70%)",
        }}
      />
      <span
        className="pointer-events-none absolute -bottom-8 -start-8 block h-24 w-24 -rotate-6 rounded-full opacity-60"
        style={{
          background:
            "radial-gradient(closest-side, rgba(224,118,43,0.16), transparent 70%)",
        }}
      />
      <div className="absolute inset-0 grid place-items-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/85 text-primary ring-1 ring-primary/15 backdrop-blur-sm sm:h-16 sm:w-16">
          <Icon className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={1.75} />
        </span>
      </div>
      {label && (
        <span className="absolute bottom-2 start-2 rounded-md bg-white/85 px-2 py-0.5 text-[11px] font-semibold text-primary ring-1 ring-primary/10">
          {label}
        </span>
      )}
    </div>
  );
}
