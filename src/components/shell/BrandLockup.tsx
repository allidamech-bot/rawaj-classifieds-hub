import { SITE_BRAND_AR, SITE_BRAND_EN } from "@/lib/site-brand";
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

      <span
        className="rawaj-brand-lockup__wordmark flex items-baseline leading-none whitespace-nowrap"
        dir="rtl"
      >
        <span
          className={cn(
            "rawaj-brand-lockup__name font-display text-[18px] font-bold",
            inverse ? "text-primary-foreground" : "text-foreground",
          )}
        >
          {SITE_BRAND_AR}
        </span>
        <span className="rawaj-brand-lockup__separator whitespace-pre" aria-hidden="true">
          {" | "}
        </span>
        <bdi
          lang="en"
          dir="ltr"
          className={cn(
            "rawaj-brand-lockup__latin text-sm font-bold",
            inverse ? "text-gold" : "text-brand-orange",
          )}
        >
          {SITE_BRAND_EN}
        </bdi>
      </span>
    </span>
  );
}
