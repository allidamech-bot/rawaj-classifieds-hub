import { cn } from "@/lib/utils";

interface BrandLockupProps {
  compact?: boolean;
  inverse?: boolean;
  className?: string;
}

export function BrandLockup({ compact = false, inverse = false, className }: BrandLockupProps) {
  return (
    <span
      className={cn("rawaj-brand-lockup inline-flex items-center gap-2.5", className)}
      data-compact={compact || undefined}
      data-inverse={inverse || undefined}
    >
      <span className="rawaj-brand-mark grid h-10 w-10 shrink-0 place-items-center">
        <img
          src="/brand/rawaj-mark-transparent-192.png"
          alt=""
          decoding="async"
          width={32}
          height={32}
          draggable={false}
          className="h-8 w-auto object-contain"
        />
      </span>

      <span className="flex items-center gap-2 leading-none">
        <span
          className={cn(
            "rawaj-brand-lockup__name font-display text-[18px] font-bold",
            inverse ? "text-primary-foreground" : "text-foreground",
          )}
        >
          رواج
        </span>
        <span className="rawaj-brand-divider h-5 w-px" aria-hidden="true" />
        <span
          className={cn(
            "rawaj-brand-lockup__latin text-[11px] font-bold tracking-[0.16em]",
            inverse ? "text-gold" : "text-brand-orange",
          )}
        >
          RAWAJ
        </span>
      </span>
    </span>
  );
}
