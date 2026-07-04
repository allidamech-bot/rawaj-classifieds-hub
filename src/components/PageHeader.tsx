import { ChevronRight } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { NotificationTrigger } from "@/components/NotificationTrigger";
import { useUiPreferences } from "@/lib/ui-preferences";

interface Props {
  title?: string;
  to?: string;
  back?: boolean;
  backMode?: "link" | "history";
}

export function PageHeader({ title, to = "/", back = true, backMode = "link" }: Props) {
  const { text } = useUiPreferences();
  const navigate = useNavigate();

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }
    void navigate({ to: to as "/" });
  }

  return (
    <div className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
      <div className="container-wide flex items-center gap-2 py-3">
        {back && backMode === "history" ? (
          <button
            type="button"
            onClick={handleBack}
            aria-label={text("رجوع", "Back")}
            title={text("رجوع", "Back")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card text-foreground hairline transition hover:bg-muted-surface active:scale-[0.98]"
          >
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </button>
        ) : back ? (
          <Link
            to={to}
            aria-label={text("رجوع", "Back")}
            title={text("رجوع", "Back")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card text-foreground hairline transition hover:bg-muted-surface active:scale-[0.98]"
          >
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </Link>
        ) : null}
        {title && <h1 className="truncate text-base font-extrabold">{title}</h1>}
        <div className="ms-auto">
          <NotificationTrigger />
        </div>
      </div>
    </div>
  );
}
