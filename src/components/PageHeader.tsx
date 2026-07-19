import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { NotificationTrigger } from "@/components/NotificationTrigger";
import { PublicAdPlacementSlot } from "@/components/PublicAdPlacementSlot";
import { resolveAdPlacementPage } from "@/lib/ad-placement-route";
import type { AdPlacementPage } from "@/lib/api/ad-placements";
import { useUiPreferences } from "@/lib/ui-preferences";

interface Props {
  title?: string;
  to?: string;
  back?: boolean;
  backMode?: "link" | "history";
  placementPage?: AdPlacementPage | null;
}

function resolveTitlePlacement(title?: string): AdPlacementPage | null {
  const normalizedTitle = title?.trim().toLocaleLowerCase();
  if (!normalizedTitle) return null;
  if (normalizedTitle === "الأقسام" || normalizedTitle === "categories") return "categories";
  if (normalizedTitle === "الإعلانات" || normalizedTitle === "listings") return "search_results";
  if (normalizedTitle === "العروض" || normalizedTitle === "offers") return "offers";
  return null;
}

export function PageHeader({
  title,
  to = "/",
  back = true,
  backMode = "link",
  placementPage,
}: Props) {
  const { text } = useUiPreferences();
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.resolvedLocation?.pathname ?? state.location.pathname,
  });
  const resolvedPlacementPage =
    placementPage === undefined
      ? (resolveAdPlacementPage(pathname) ?? resolveTitlePlacement(title))
      : placementPage;

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }
    void navigate({ to: to as "/" });
  }

  const backClassName =
    "rawaj-icon-button rawaj-touch-target grid shrink-0 place-items-center shadow-none";

  return (
    <>
      <div
        className="rawaj-page-header sticky top-0 z-20"
        data-shell-region="header-region"
        data-resolved-pathname={pathname}
      >
        <div className="container-wide flex min-h-14 items-center gap-2.5 py-1.5 sm:min-h-16 sm:gap-3">
          {back && backMode === "history" ? (
            <button
              type="button"
              onClick={handleBack}
              aria-label={text("رجوع", "Back")}
              title={text("رجوع", "Back")}
              className={backClassName}
            >
              <ChevronRight className="h-4.5 w-4.5 rtl:rotate-180" strokeWidth={1.9} />
            </button>
          ) : back ? (
            <Link
              to={to}
              aria-label={text("رجوع", "Back")}
              title={text("رجوع", "Back")}
              className={backClassName}
            >
              <ChevronRight className="h-4.5 w-4.5 rtl:rotate-180" strokeWidth={1.9} />
            </Link>
          ) : null}

          {title ? (
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[15px] font-bold leading-tight text-primary sm:text-base">
                {title}
              </h1>
            </div>
          ) : (
            <div className="flex-1" />
          )}

          <div className="ms-auto shrink-0">
            <NotificationTrigger />
          </div>
        </div>
      </div>
      <PublicAdPlacementSlot placementPage={resolvedPlacementPage} />
    </>
  );
}
