import * as React from "react";

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

export const PageContainer = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("rawaj-page-container", className)} {...props} />
  ),
);
PageContainer.displayName = "PageContainer";

export const PageTransition = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("rawaj-page-transition", className)} {...props} />
));
PageTransition.displayName = "PageTransition";

export const SpatialCard = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("rawaj-spatial-card", className)} {...props} />
  ),
);
SpatialCard.displayName = "SpatialCard";

export const GlassAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, type = "button", ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    className={cn(
      "rawaj-glass-action rawaj-touch-target inline-flex items-center justify-center rounded-xl",
      className,
    )}
    {...props}
  />
));
GlassAction.displayName = "GlassAction";

export const StickyActionBar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("rawaj-sticky-action-bar", className)}
    data-shell-region="sticky-action-region"
    {...props}
  />
));
StickyActionBar.displayName = "StickyActionBar";

interface SectionHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  action?: React.ReactNode;
}

export function SectionHeader({ title, eyebrow, action, className, ...props }: SectionHeaderProps) {
  return (
    <div
      className={cn("flex items-end justify-between gap-4", className)}
      data-ui="section-header"
      {...props}
    >
      <div className="min-w-0">
        {eyebrow ? <div className="rawaj-eyebrow text-xs font-bold">{eyebrow}</div> : null}
        <h2 className="rawaj-section-title mt-1 text-xl sm:text-2xl">{title}</h2>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export const HorizontalRail = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      className,
    )}
    data-ui="horizontal-rail"
    {...props}
  />
));
HorizontalRail.displayName = "HorizontalRail";

interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn("rawaj-spatial-card px-5 py-10 text-center", className)}
      data-ui="empty-state"
      {...props}
    >
      {icon ? <div className="mx-auto mb-4 grid w-fit place-items-center">{icon}</div> : null}
      <h2 className="text-lg font-extrabold text-primary">{title}</h2>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export const LoadingSkeleton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("animate-pulse rounded-xl bg-muted", className)}
    aria-hidden="true"
    data-ui="loading-skeleton"
    {...props}
  />
));
LoadingSkeleton.displayName = "LoadingSkeleton";

interface NotificationBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  count: number;
}

export function NotificationBadge({ count, className, ...props }: NotificationBadgeProps) {
  if (count <= 0) return null;

  return (
    <span
      className={cn(
        "rawaj-notification-badge grid min-h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-extrabold leading-none",
        className,
      )}
      {...props}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export const BottomSheet = Drawer;
export const BottomSheetTrigger = DrawerTrigger;
export const BottomSheetClose = DrawerClose;
export const BottomSheetHeader = DrawerHeader;
export const BottomSheetFooter = DrawerFooter;
export const BottomSheetTitle = DrawerTitle;
export const BottomSheetDescription = DrawerDescription;

export function BottomSheetContent({
  className,
  ...props
}: React.ComponentProps<typeof DrawerContent>) {
  return <DrawerContent className={cn("rawaj-bottom-sheet", className)} {...props} />;
}
