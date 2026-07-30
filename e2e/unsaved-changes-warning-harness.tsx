import {
  Link,
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { createRoot } from "react-dom/client";

import { useUnsavedChangesWarning } from "@/lib/use-unsaved-changes-warning";

export async function mountUnsavedChangesWarningHarness(
  container: HTMLElement,
  initiallyDirty: boolean,
) {
  let updateDirty: ((dirty: boolean) => void) | undefined;

  function HarnessIndex() {
    const [dirty, setDirty] = useState(initiallyDirty);
    updateDirty = setDirty;
    useUnsavedChangesWarning(dirty, "Unsaved local image");

    return (
      <main data-testid="unsaved-harness-index">
        <Link to="/next" data-testid="unsaved-harness-leave">
          Leave
        </Link>
      </main>
    );
  }

  const rootRoute = createRootRoute({ component: Outlet });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: HarnessIndex,
  });
  const nextRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/next",
    component: () => <main data-testid="unsaved-harness-next">Next</main>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, nextRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();

  const root = createRoot(container);
  root.render(<RouterProvider router={router} />);

  return {
    setDirty(dirty: boolean) {
      updateDirty?.(dirty);
    },
    destroy() {
      root.unmount();
    },
  };
}
