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

// Shared category placeholder system.
// It must read as an honest missing-image state, never as a simulated product photo.
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
      className={`rawaj-placeholder-art relative w-full overflow-hidden rounded-[var(--rawaj-radius-card)] border border-border bg-[var(--rawaj-surface-inset)] ${ratio} ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 grid place-items-center p-3">
        <Icon
          className="h-11 w-11 text-[var(--rawaj-text-gold)] sm:h-14 sm:w-14"
          strokeWidth={1.75}
        />
      </div>
      {label ? (
        <span className="absolute bottom-2 start-2 max-w-[calc(100%-1rem)] truncate rounded-lg border border-white/10 bg-black/35 px-2 py-1 text-[10px] font-medium text-white/55 backdrop-blur-sm">
          {label}
        </span>
      ) : null}
    </div>
  );
}
