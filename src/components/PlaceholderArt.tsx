import { useId } from "react";
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
  const gradientId = `rawaj-placeholder-${useId().replace(/:/g, "")}`;
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
      className={`relative w-full overflow-hidden rounded-[var(--rawaj-radius-card)] border border-white/10 bg-[#1d2021] ${ratio} ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(232,202,141,0.12),transparent_30%),radial-gradient(circle_at_58%_58%,rgba(18,63,54,0.14),transparent_38%),linear-gradient(145deg,#282d2e,#181b1c)]" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.045),transparent_38%,rgba(0,0,0,0.16))]" />
      <div className="absolute inset-0 grid place-items-center p-3">
        <span className="relative grid place-items-center">
          <span className="absolute h-10 w-16 rounded-full bg-amber-200/5 blur-xl sm:h-12 sm:w-20" />
          <Icon
            className="relative h-11 w-11 drop-shadow-[0_8px_15px_rgba(0,0,0,0.28)] sm:h-14 sm:w-14"
            stroke={`url(#${gradientId})`}
            strokeWidth={1.85}
          >
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f0d59b" />
                <stop offset="52%" stopColor="#d8ae5f" />
                <stop offset="100%" stopColor="#8fb8a8" />
              </linearGradient>
            </defs>
          </Icon>
        </span>
      </div>
      {label ? (
        <span className="absolute bottom-2 start-2 max-w-[calc(100%-1rem)] truncate rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-[10px] font-semibold text-white/65 backdrop-blur-sm">
          {label}
        </span>
      ) : null}
    </div>
  );
}
