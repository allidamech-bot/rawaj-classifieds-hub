import { isCloudflarePublicDataProvider } from "@/lib/public-data/config";

export const CLOUDFLARE_ADMIN_MODULES = {
  "/admin": true,
  "/admin/pending": true,
  "/admin/listings": true,
  "/admin/data-quality": false,
  "/admin/reviews": false,
  "/admin/reports": false,
  "/admin/message-reports": false,
  "/admin/safety": false,
  "/admin/verifications": false,
  "/admin/users": true,
  "/admin/promotions": false,
  "/admin/ad-placements": false,
  "/admin/campaigns": false,
  "/admin/audit": true,
  "/admin/owner-controls": false,
} as const;

export type AdminModulePath = keyof typeof CLOUDFLARE_ADMIN_MODULES;

export function isAdminModuleAvailable(pathname: string): boolean {
  if (!isCloudflarePublicDataProvider()) return true;
  const match = Object.keys(CLOUDFLARE_ADMIN_MODULES).find(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  if (!match) return true;
  return CLOUDFLARE_ADMIN_MODULES[match as AdminModulePath];
}

export function getUnavailableAdminModuleMessage(pathname: string): string {
  const match = Object.keys(CLOUDFLARE_ADMIN_MODULES).find(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  if (!match) return "هذه الوحدة غير متاحة حالياً في وضع Cloudflare.";
  return "هذه الوحدة لا تزال migrate إلى البنية الجديدة وستتاح قريباً.";
}
