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
      className={`relative w-full overflow-hidden rounded-[var(--rawaj-radius-card)] border border-border/70 bg-muted-surface ${ratio} ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.58),transparent_52%)]" />
      <div className="absolute inset-0 grid place-items-center p-4">
        <span className="grid h-14 w-14 place-items-center rounded-[var(--rawaj-radius-card)] border border-border/80 bg-card text-primary shadow-soft sm:h-16 sm:w-16">
          <Icon className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={1.7} />
        </span>
      </div>
      {label ? (
        <span className="absolute bottom-2 start-2 max-w-[calc(100%-1rem)] truncate rounded-lg border border-border/70 bg-card/92 px-2 py-1 text-[10px] font-semibold text-muted-foreground backdrop-blur-sm">
          {label}
        </span>
      ) : null}
    </div>
  );
}
