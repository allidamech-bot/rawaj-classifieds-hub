import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold leading-none transition-colors duration-[var(--motion-fast)] focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-2 focus:ring-offset-background",
  {
    variants: {
      variant: {
        default: "border-[var(--rawaj-border)] bg-[var(--rawaj-muted-surface)] text-[var(--rawaj-text-secondary)]",
        secondary:
          "border-[var(--rawaj-border)] bg-[var(--rawaj-surface-active)] text-[var(--rawaj-text-primary)]",
        accent:
          "border-[var(--rawaj-divider)] bg-[var(--rawaj-selected-surface)] text-[var(--rawaj-link-on-light)]",
        success:
          "border-[var(--rawaj-divider)] bg-[var(--rawaj-success-surface)] text-[var(--rawaj-success)]",
        warning:
          "border-[var(--rawaj-divider)] bg-[var(--rawaj-warning-surface)] text-[var(--rawaj-warning)]",
        gold:
          "border-[var(--rawaj-divider)] bg-[var(--rawaj-warning-surface)] text-[var(--rawaj-gold-ink)]",
        destructive:
          "border-[var(--rawaj-divider)] bg-[var(--rawaj-danger-surface)] text-[var(--rawaj-danger)]",
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
