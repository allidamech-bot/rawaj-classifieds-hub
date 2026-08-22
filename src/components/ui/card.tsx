import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva(
  "rounded-[var(--rawaj-radius-card)] border text-[var(--rawaj-text-primary)] transition-[border-color,box-shadow,transform] duration-[var(--motion-fast)]",
  {
    variants: {
      variant: {
        default:
          "border-[var(--rawaj-border)] bg-[var(--rawaj-card-background)] shadow-[var(--shadow-soft)]",
        flat: "border-[var(--rawaj-border)] bg-[var(--rawaj-card-background)] shadow-none",
        subtle: "border-[var(--rawaj-border)] bg-[var(--rawaj-muted-surface)] shadow-none",
        elevated:
          "border-[var(--rawaj-border-strong)] bg-[var(--rawaj-elevated-background)] shadow-[var(--shadow-raised)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {
  interactive?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, interactive = false, ...props }, ref) => (
    <div
      ref={ref}
      data-ui="card"
      data-variant={variant ?? "default"}
      data-interactive={interactive || undefined}
      className={cn(
        cardVariants({ variant }),
        interactive &&
          "hover:-translate-y-0.5 hover:border-[var(--rawaj-border-active)] hover:shadow-[var(--shadow-raised)] focus-within:border-[var(--rawaj-border-active)]",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col gap-1.5 p-[var(--rawaj-card-padding)]", className)}
      {...props}
    />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "font-display font-bold leading-snug tracking-tight text-[var(--rawaj-text-primary)]",
        className,
      )}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("text-sm leading-6 text-[var(--rawaj-text-muted)]", className)}
      {...props}
    />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("px-[var(--rawaj-card-padding)] pb-[var(--rawaj-card-padding)]", className)}
      {...props}
    />
  ),
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center px-[var(--rawaj-card-padding)] pb-[var(--rawaj-card-padding)]",
        className,
      )}
      {...props}
    />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
