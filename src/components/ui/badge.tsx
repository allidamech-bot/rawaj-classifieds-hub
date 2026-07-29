import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold leading-none transition-colors duration-[var(--motion-fast)] focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-2 focus:ring-offset-background",
  {
    variants: {
      variant: {
        default:
          "border-[var(--rawaj-border)] bg-[var(--rawaj-muted-surface)] text-[var(--rawaj-text-secondary)]",
        secondary:
          "border-[var(--rawaj-border)] bg-[var(--rawaj-surface-active)] text-[var(--rawaj-text-primary)]",
        accent:
          "border-[#e164b4]/30 bg-[rgba(155,40,111,0.2)] text-[#f6cfe5]",
        success:
          "border-emerald-trust/25 bg-emerald-trust/10 text-[#bcebd9]",
        warning: "border-warning/25 bg-warning/10 text-[#ecd6ac]",
        gold: "border-gold/25 bg-gold/10 text-[#ecd6ac]",
        destructive: "border-destructive/30 bg-destructive/14 text-[#ffd4d0]",
        outline:
          "border-[var(--rawaj-border-strong)] bg-transparent text-[var(--rawaj-text-primary)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div
      data-ui="badge"
      data-variant={variant ?? "default"}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
