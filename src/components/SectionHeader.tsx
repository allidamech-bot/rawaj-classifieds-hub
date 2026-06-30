import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

interface Props {
  title: string;
  action?: { label: string; onClick?: () => void; to?: string };
  className?: string;
}

export function SectionHeader({ title, action, className = "" }: Props) {
  return (
    <div className={`mb-3 flex items-center justify-between ${className}`}>
      <h2 className="text-lg font-extrabold text-foreground">
        <span className="inline-block border-b-2 border-gold pb-0.5">{title}</span>
      </h2>
      {action?.to ? (
        <Link
          to={action.to as "/"}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
        >
          {action.label} <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
        </Link>
      ) : action ? (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
          type="button"
        >
          {action.label} <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
        </button>
      ) : null}
    </div>
  );
}
