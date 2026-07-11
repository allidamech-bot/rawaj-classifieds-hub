import { useRouterState } from "@tanstack/react-router";

import { BottomDock } from "@/components/shell/BottomDock";

export function BottomNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return <BottomDock pathname={pathname} />;
}
