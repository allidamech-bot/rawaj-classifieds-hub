import { ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface Props {
  title?: string;
  to?: string;
  back?: boolean;
}

export function PageHeader({ title, to = "/", back = true }: Props) {
  return (
    <div className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
      <div className="container-wide flex items-center gap-2 py-3">
        {back && (
          <Link
            to={to}
            aria-label="رجوع"
            className="grid h-9 w-9 place-items-center rounded-full bg-card hairline transition hover:bg-muted-surface"
          >
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </Link>
        )}
        {title && <h1 className="truncate text-base font-extrabold">{title}</h1>}
      </div>
    </div>
  );
}
