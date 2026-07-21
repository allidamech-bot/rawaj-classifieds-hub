import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-[var(--rawaj-control-height)] items-center justify-center gap-2 whitespace-nowrap rounded-[var(--rawaj-radius-button)] px-4 py-2 text-sm font-semibold cursor-pointer transition-[color,background-color,border-color,box-shadow,transform] duration-[var(--motion-fast)] ease-[var(--motion-ease)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.985] [&_svg]:pointer-events-none [&_svg]:size-[var(--rawaj-icon-sm)] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange/92",
        accent: "bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange/92",
        brand: "bg-primary text-primary-foreground hover:bg-primary/92",
        soft: "border border-border bg-muted-surface text-primary hover:border-primary/20 hover:bg-secondary",
        success: "bg-emerald-trust text-emerald-trust-foreground hover:bg-emerald-trust/92",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-card text-foreground hover:border-primary/25 hover:bg-muted-surface",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "text-foreground hover:bg-muted-surface",
        link: "min-h-0 rounded-none px-0 py-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[var(--rawaj-control-height)]",
        sm: "h-[var(--rawaj-control-height-sm)] min-h-[var(--rawaj-control-height-sm)] px-3 text-xs",
        compact: "h-8 min-h-8 rounded-lg px-2.5 text-xs",
        lg: "h-[var(--rawaj-control-height-lg)] min-h-[var(--rawaj-control-height-lg)] px-6 text-sm",
        icon: "h-[var(--rawaj-control-height)] w-[var(--rawaj-control-height)] px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        data-ui="button"
        data-variant={variant ?? "default"}
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
