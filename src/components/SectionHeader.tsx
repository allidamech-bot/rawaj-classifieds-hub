import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

interface Props {
  title: string;
  description?: string;
  action?: { label: string; onClick?: () => void; to?: string };
  className?: string;
}

export function SectionHeader({ title, description, action, className = "" }: Props) {
  return (
    <div className={`mb-4 flex items-end justify-between gap-4 ${className}`}>
      <div className="rawaj-section-heading min-w-0">
        <h2 className="rawaj-section-title text-lg sm:text-xl">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action?.to ? (
        <Link
          to={action.to as "/"}
          className="rawaj-touch-target inline-flex shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-muted-surface"
        >
          {action.label} <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
        </Link>
      ) : action ? (
        <button
          onClick={action.onClick}
          className="rawaj-touch-target inline-flex shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-muted-surface"
          type="button"
        >
          {action.label} <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
        </button>
      ) : null}
    </div>
  );
}
