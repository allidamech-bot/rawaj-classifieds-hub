import { ChevronUp, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
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

const COLLAPSED_SNAP_POINT = 0.62;
const EXPANDED_SNAP_POINT = 0.94;

export function FilterBottomSheet({
  open,
  onOpenChange,
  activeCount,
  onReset,
  onApply,
  children,
  text,
}: FilterBottomSheetProps) {
  const [activeSnapPoint, setActiveSnapPoint] = useState<number | string | null>(
    COLLAPSED_SNAP_POINT,
  );
  const expanded = activeSnapPoint === EXPANDED_SNAP_POINT;

  useEffect(() => {
    if (!open) return;
    setActiveSnapPoint(COLLAPSED_SNAP_POINT);
    return beginFilterDraftSession();
  }, [open]);

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      shouldScaleBackground={false}
      snapPoints={[COLLAPSED_SNAP_POINT, EXPANDED_SNAP_POINT]}
      activeSnapPoint={activeSnapPoint}
      setActiveSnapPoint={setActiveSnapPoint}
      fadeFromIndex={1}
    >
      <BottomSheetContent
        className="rawaj-filter-sheet"
        data-filter-state="draft"
        data-expanded={expanded}
      >
        <div className="rawaj-filter-sheet__header">
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
              onClick={() =>
                setActiveSnapPoint(expanded ? COLLAPSED_SNAP_POINT : EXPANDED_SNAP_POINT)
              }
              aria-label={
                expanded
                  ? text("تصغير نافذة الفلاتر", "Collapse filter sheet")
                  : text("توسيع نافذة الفلاتر", "Expand filter sheet")
              }
              aria-pressed={expanded}
            >
              <ChevronUp aria-hidden="true" className={expanded ? "rotate-180" : undefined} />
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label={text("إغلاق الفلاتر", "Close filters")}
            >
              <X aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="rawaj-filter-sheet__body">{children}</div>

        <div className="rawaj-filter-sheet__footer">
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
