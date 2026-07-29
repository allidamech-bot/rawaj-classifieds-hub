import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type ShellHeaderVariant = "brand" | "context" | "workspace";

interface ShellHeaderFrameProps {
  pathname: string;
  variant: ShellHeaderVariant;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}

export function ShellHeaderFrame({
  pathname,
  variant,
  children,
  className,
  innerClassName,
}: ShellHeaderFrameProps) {
  return (
    <header
      className={cn(
        "rawaj-app-header rawaj-shell-header sticky top-0 z-30 text-foreground",
        `rawaj-shell-header--${variant}`,
        className,
      )}
      data-shell-region="header-region"
      data-header-variant={variant}
      data-resolved-pathname={pathname}
    >
      <div
        className={cn(
          "rawaj-floating-header-shell rawaj-shell-header__inner container-wide",
          `rawaj-shell-header__inner--${variant}`,
          innerClassName,
        )}
      >
        {children}
      </div>
    </header>
  );
}
