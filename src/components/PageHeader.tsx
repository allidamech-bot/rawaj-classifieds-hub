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

  const backClassName =
    "rawaj-icon-button grid h-9 w-9 shrink-0 place-items-center sm:h-10 sm:w-10";

  return (
    <div className="sticky top-0 z-20 border-b border-border/75 bg-background/88 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80">
      <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold/65 to-transparent" />
      <div className="container-wide flex min-h-14 items-center gap-2.5 py-2 sm:min-h-16 sm:gap-3">
        {back && backMode === "history" ? (
          <button
            type="button"
            onClick={handleBack}
            aria-label={text("رجوع", "Back")}
            title={text("رجوع", "Back")}
            className={backClassName}
          >
            <ChevronRight className="h-4 w-4 rtl:rotate-180" strokeWidth={1.9} />
          </button>
        ) : back ? (
          <Link
            to={to}
            aria-label={text("رجوع", "Back")}
            title={text("رجوع", "Back")}
            className={backClassName}
          >
            <ChevronRight className="h-4 w-4 rtl:rotate-180" strokeWidth={1.9} />
          </Link>
        ) : null}

        {title ? (
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-bold leading-tight text-primary sm:text-base">{title}</h1>
            <span className="mt-1 block h-0.5 w-7 rounded-full bg-gradient-to-r from-brand-orange to-gold" />
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <div className="ms-auto shrink-0">
          <NotificationTrigger />
        </div>
      </div>
    </div>
  );
}
