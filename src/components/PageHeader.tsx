import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { NotificationTrigger } from "@/components/NotificationTrigger";
import { PublicAdPlacementSlot } from "@/components/PublicAdPlacementSlot";
import { BrandLockup } from "@/components/shell/BrandLockup";
import { ShellHeaderFrame, type ShellHeaderVariant } from "@/components/shell/ShellHeaderFrame";
import { resolveAdPlacementPage } from "@/lib/ad-placement-route";
import type { AdPlacementPage } from "@/lib/api/ad-placements";
import { useUiPreferences } from "@/lib/ui-preferences";

interface Props {
  title?: string;
  to?: string;
  back?: boolean;
  backMode?: "link" | "history";
  placementPage?: AdPlacementPage | null;
  titleIsPageHeading?: boolean;
}

function resolveTitlePlacement(title?: string): AdPlacementPage | null {
  const normalizedTitle = title?.trim().toLocaleLowerCase();
  if (!normalizedTitle) return null;
  if (normalizedTitle === "الأقسام" || normalizedTitle === "categories") return "categories";
  if (normalizedTitle === "الإعلانات" || normalizedTitle === "listings") return "search_results";
  if (normalizedTitle === "العروض" || normalizedTitle === "offers") return "offers";
  return null;
}

function resolveHeaderVariant(pathname: string): ShellHeaderVariant {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "workspace";
  return "context";
}

export function PageHeader({
  title,
  to = "/",
  back = true,
  backMode = "link",
  placementPage,
  titleIsPageHeading = true,
}: Props) {
  const { language, text } = useUiPreferences();
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.resolvedLocation?.pathname ?? state.location.pathname,
  });
  const resolvedPlacementPage =
    placementPage === undefined
      ? (resolveAdPlacementPage(pathname) ?? resolveTitlePlacement(title))
      : placementPage;
  const headerVariant = resolveHeaderVariant(pathname);
  const BackIcon = language === "ar" ? ArrowRight : ArrowLeft;

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }
    void navigate({ to: to as "/" });
  }

  const backClassName =
    "rawaj-shell-header__back rawaj-icon-button rawaj-touch-target grid shrink-0 place-items-center shadow-none";

  const backControl = !back ? null : backMode === "history" ? (
    <button
      type="button"
      onClick={handleBack}
      aria-label={text("رجوع", "Back")}
      title={text("رجوع", "Back")}
      className={backClassName}
    >
      <BackIcon className="h-[1.1rem] w-[1.1rem]" strokeWidth={1.9} />
    </button>
  ) : (
    <Link
      to={to}
      aria-label={text("رجوع", "Back")}
      title={text("رجوع", "Back")}
      className={backClassName}
    >
      <BackIcon className="h-[1.1rem] w-[1.1rem]" strokeWidth={1.9} />
    </Link>
  );

  return (
    <>
      <ShellHeaderFrame pathname={pathname} variant={headerVariant}>
        <Link
          to="/"
          className="rawaj-shell-header__brand min-w-0"
          aria-label={text("رواج — الرئيسية", "RAWAJ — Home")}
        >
          <BrandLockup compact />
        </Link>

        <div className="rawaj-shell-header__title min-w-0">
          {title ? (
            titleIsPageHeading ? (
              <h1 className="truncate text-[15px] font-bold leading-tight sm:text-base">{title}</h1>
            ) : (
              <p className="truncate text-[15px] font-bold leading-tight sm:text-base">{title}</p>
            )
          ) : (
            <span className="sr-only">{text("رواج", "RAWAJ")}</span>
          )}
        </div>

        <div className="rawaj-shell-header__actions flex shrink-0 items-center gap-1.5 sm:gap-2">
          <NotificationTrigger tone="light" />
          {backControl}
        </div>
      </ShellHeaderFrame>
      <PublicAdPlacementSlot placementPage={resolvedPlacementPage} />
    </>
  );
}
