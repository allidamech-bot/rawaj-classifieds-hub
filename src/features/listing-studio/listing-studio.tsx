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
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6">
      <div className="min-w-0 space-y-4">{children}</div>
      {aside ? <aside className="space-y-3 lg:sticky lg:top-24">{aside}</aside> : null}
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
    <ol className="rawaj-surface relative mb-5 grid grid-cols-3 gap-1.5 overflow-hidden rounded-[1.35rem] p-2 sm:gap-2 sm:p-2.5">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold/65 to-transparent"
      />
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={step.label}
            aria-current={active ? "step" : undefined}
            className={`relative min-w-0 rounded-[1rem] px-2 py-2.5 transition sm:px-3 ${
              active
                ? "bg-primary text-primary-foreground shadow-[0_8px_22px_rgba(16,43,70,0.14)]"
                : done
                  ? "bg-emerald-trust/8 text-emerald-trust"
                  : "text-muted-foreground"
            }`}
          >
            <span className="flex items-center gap-2">
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-[0.7rem] text-[10px] font-bold transition ${
                  active
                    ? "bg-white/10 text-gold ring-1 ring-white/10"
                    : done
                      ? "bg-emerald-trust text-emerald-trust-foreground"
                      : "border border-border/80 bg-card-warm/80 text-primary"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={2.2} /> : index + 1}
              </span>
              <span className="min-w-0 truncate text-[10px] font-semibold leading-tight sm:text-xs">
                {step.label}
              </span>
            </span>
            {step.description ? (
              <span className="mt-1.5 hidden ps-9 text-[10px] leading-4 opacity-75 sm:block">
                {step.description}
              </span>
            ) : null}
            {active ? (
              <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-brand-orange to-gold" />
            ) : null}
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
      className={`rounded-[1.4rem] p-4 sm:p-5 ${
        tone === "muted"
          ? "border border-border/65 bg-card-warm/65"
          : "rawaj-surface"
      }`}
    >
      <div className="mb-4">
        <span className="mb-1.5 block h-0.5 w-7 rounded-full bg-gradient-to-r from-brand-orange to-gold" />
        <h3 className="text-sm font-bold leading-tight text-primary sm:text-[15px]">{title}</h3>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-[11px] leading-5 text-muted-foreground sm:text-xs sm:leading-6">
            {description}
          </p>
        ) : null}
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
      ? "border-emerald-trust/15 bg-emerald-trust/8 text-emerald-trust"
      : tone === "warning"
        ? "border-warning/15 bg-warning/8 text-warning"
        : tone === "danger"
          ? "border-destructive/15 bg-destructive/8 text-destructive"
          : "border-border/70 bg-card-warm/70 text-foreground";

  return (
    <div className={`rounded-[1rem] border p-3 text-xs font-medium leading-5 ${className}`}>
      {children}
    </div>
  );
}
