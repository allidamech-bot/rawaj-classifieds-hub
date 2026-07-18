import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { installClientErrorMonitoring } from "@/lib/client-error-monitoring";
import { routeTree } from "./routeTree.gen";

let clientErrorMonitoringCleanup: (() => void) | undefined;

export const getRouter = () => {
  if (typeof window !== "undefined" && !clientErrorMonitoringCleanup) {
    clientErrorMonitoringCleanup = installClientErrorMonitoring();
  }

  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
