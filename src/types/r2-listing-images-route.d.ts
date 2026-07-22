import type { AnyRoute } from "@tanstack/react-router";

declare module "@tanstack/react-router" {
  interface FileRoutesByPath {
    "/api/listing-images": {
      id: "/api/listing-images";
      path: "/api/listing-images";
      fullPath: "/api/listing-images";
      preLoaderRoute: AnyRoute;
      parentRoute: AnyRoute;
    };
  }
}
