import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        data-ui="input"
        className={cn(
          "flex h-[var(--rawaj-control-height-lg)] w-full rounded-[var(--rawaj-radius-input)] border border-[var(--rawaj-border-strong)] bg-[var(--rawaj-surface-inset)] px-3.5 py-2 text-base font-medium text-[var(--rawaj-text-primary)] shadow-none transition-[border-color,box-shadow,background-color] duration-[var(--motion-fast)] placeholder:text-[var(--rawaj-text-muted)] placeholder:opacity-90 hover:border-[var(--rawaj-border-active)] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/15 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/15 disabled:cursor-not-allowed disabled:bg-[var(--rawaj-muted-surface)] disabled:text-[var(--rawaj-text-disabled)] disabled:opacity-70 file:border-0 file:bg-transparent file:text-sm file:font-semibold file:text-[var(--rawaj-text-primary)] md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
