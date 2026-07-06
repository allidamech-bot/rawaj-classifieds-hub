import { Check } from "lucide-react";
import type { ReactNode } from "react";

export type ListingStudioStep = {
  label: string;
  description?: string;
};

export function ListingStudioShell({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="space-y-4">{children}</div>
      {aside && <aside className="space-y-3">{aside}</aside>}
    </div>
  );
}

export function ListingStudioSteps({
  steps,
  current,
}: {
  steps: ListingStudioStep[];
  current: number;
}) {
  return (
    <ol className="mb-4 grid grid-cols-3 gap-2">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={step.label}
            className={`rounded-xl border p-2 ${
              active
                ? "border-primary bg-primary text-primary-foreground"
                : done
                  ? "border-emerald-trust/30 bg-emerald-trust/10 text-emerald-trust"
                  : "border-border bg-card text-muted-foreground"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-extrabold ${
                  active
                    ? "bg-primary-foreground/15"
                    : done
                      ? "bg-emerald-trust text-emerald-trust-foreground"
                      : "bg-muted-surface"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className="min-w-0 text-xs font-extrabold leading-tight">{step.label}</span>
            </span>
            {step.description && (
              <span className="mt-1 hidden text-[10px] leading-4 opacity-80 sm:block">
                {step.description}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function ListingStudioSection({
  title,
  description,
  children,
  tone = "default",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  tone?: "default" | "muted";
}) {
  return (
    <section
      className={`rounded-2xl p-4 hairline shadow-soft ${
        tone === "muted" ? "bg-muted-surface" : "bg-card"
      }`}
    >
      <div className="mb-3">
        <h3 className="text-sm font-extrabold text-foreground">{title}</h3>
        {description && (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

export function ListingStudioMessage({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const className =
    tone === "success"
      ? "bg-emerald-trust/10 text-emerald-trust"
      : tone === "warning"
        ? "bg-warning/10 text-warning"
        : tone === "danger"
          ? "bg-destructive/10 text-destructive"
          : "bg-muted-surface text-foreground";

  return (
    <div className={`rounded-xl p-3 text-xs font-semibold hairline ${className}`}>{children}</div>
  );
}
