export const CLOUDFLARE_ADMIN_MODULES = {
  "/admin": true,
  "/admin/pending": true,
  "/admin/listings": true,
  "/admin/data-quality": true,
  "/admin/reviews": true,
  "/admin/reports": true,
  "/admin/message-reports": true,
  "/admin/safety": true,
  "/admin/verifications": true,
  "/admin/users": true,
  "/admin/promotions": true,
  "/admin/ad-placements": true,
  "/admin/campaigns": true,
  "/admin/audit": true,
  "/admin/owner-controls": true,
  "/admin/notifications": true,
} as const;

export type AdminModulePath = keyof typeof CLOUDFLARE_ADMIN_MODULES;

export function isAdminModuleAvailable(pathname: string): boolean {
  const match = Object.keys(CLOUDFLARE_ADMIN_MODULES).find(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  if (!match) return true;
  return CLOUDFLARE_ADMIN_MODULES[match as AdminModulePath];
}

export function getUnavailableAdminModuleMessage(_pathname?: string): string {
  return "هذه الوحدة غير متاحة مؤقتاً.";
}
