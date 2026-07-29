/**
 * Backward-compatible public module name.
 * Ad placement reads, writes and media now run only through Cloudflare + D1 + R2.
 */
export * from "@/lib/api/ad-placements-cloudflare";
