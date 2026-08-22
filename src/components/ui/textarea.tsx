import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        data-ui="textarea"
        className={cn(
          "flex min-h-28 w-full resize-y rounded-[var(--rawaj-radius-input)] border border-[var(--rawaj-border-strong)] bg-[var(--rawaj-surface-inset)] px-3.5 py-3 text-base font-medium leading-7 text-foreground shadow-none transition-[border-color,box-shadow,background-color] duration-[var(--motion-fast)] placeholder:text-muted-foreground placeholder:opacity-90 hover:border-[var(--rawaj-border-active)] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/15 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/15 disabled:cursor-not-allowed disabled:bg-muted-surface disabled:text-muted-foreground disabled:opacity-70 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
