import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

type FeedbackTone = "neutral" | "error";

interface FeedbackStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  code?: string;
  tone?: FeedbackTone;
  className?: string;
  as?: "main" | "section";
}

export function FeedbackState({
  title,
  description,
  action,
  code,
  tone = "neutral",
  className,
  as,
}: FeedbackStateProps) {
  const Component: ElementType = as ?? (code || tone === "error" ? "main" : "section");

  return (
    <Component
      className={cn(
        "rawaj-feedback-state rawaj-foundation-card mx-auto w-full max-w-xl p-6 text-center sm:p-8",
        tone === "error" && "border-destructive/20",
        className,
      )}
      data-tone={tone}
      role={tone === "error" ? "alert" : undefined}
    >
      {code ? (
        <p className="font-display text-4xl font-bold leading-none text-primary sm:text-5xl">
          {code}
        </p>
      ) : null}
      <h1 className={cn("text-lg font-bold text-foreground sm:text-xl", code && "mt-4")}>
        {title}
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-muted-foreground">{description}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </Component>
  );
}
