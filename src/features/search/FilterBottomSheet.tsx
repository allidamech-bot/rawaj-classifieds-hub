import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetTitle,
} from "@/components/shell/spatial-primitives";
import { beginFilterDraftSession } from "@/features/search/filter-draft-session";

interface FilterBottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeCount: number;
  onReset: () => void;
  onApply: () => void;
  children: ReactNode;
  text: (ar: string, en: string) => string;
}

export function FilterBottomSheet({
  open,
  onOpenChange,
  activeCount,
  onReset,
  onApply,
  children,
  text,
}: FilterBottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    return beginFilterDraftSession();
  }, [open]);

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      shouldScaleBackground={false}
      dismissible={false}
      handleOnly
    >
      <BottomSheetContent
        className="rawaj-filter-sheet"
        data-filter-state="draft"
        data-scroll-mode="content"
        style={{
          height: "min(88dvh, calc(var(--app-viewport-height, 100dvh) - 0.5rem))",
          maxHeight: "calc(var(--app-viewport-height, 100dvh) - 0.5rem)",
        }}
      >
        <div className="rawaj-filter-sheet__header" style={{ flex: "0 0 auto" }}>
          <div>
            <BottomSheetTitle>{text("فلترة الإعلانات", "Filter listings")}</BottomSheetTitle>
            <BottomSheetDescription>
              {activeCount > 0
                ? text(`${activeCount} فلاتر نشطة`, `${activeCount} active filters`)
                : text("اختر ما يناسب بحثك", "Choose what fits your search")}
            </BottomSheetDescription>
          </div>
          <div className="rawaj-filter-sheet__header-actions">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label={text("إغلاق الفلاتر", "Close filters")}
            >
              <X aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          className="rawaj-filter-sheet__body"
          data-vaul-no-drag
          tabIndex={0}
          aria-label={text("خيارات فلترة الإعلانات", "Listing filter options")}
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            overflowY: "auto",
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-y",
            paddingBottom: "1rem",
          }}
        >
          {children}
        </div>

        <div
          className="rawaj-filter-sheet__footer"
          data-vaul-no-drag
          style={{
            position: "relative",
            inset: "auto",
            flex: "0 0 auto",
          }}
        >
          <button type="button" onClick={onReset} disabled={activeCount === 0}>
            {text("مسح الفلاتر", "Clear filters")}
          </button>
          <button type="button" onClick={onApply}>
            {text("تطبيق وعرض النتائج", "Apply and show results")}
          </button>
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}
