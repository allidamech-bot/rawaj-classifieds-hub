import { useEffect, useState } from "react";
import {
  fetchLocationChildren,
  fetchLocationRoots,
  type CanonicalLocationNode,
} from "@/lib/api/location-taxonomy";

export type LocationLevel = {
  parentId: string;
  options: CanonicalLocationNode[];
  selectedId: string;
};

export function useLocationLevels() {
  const [levels, setLevels] = useState<LocationLevel[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const roots = await fetchLocationRoots("SY");
      if (cancelled) return;
      if (!roots.ok) return setError(roots.error.message);
      const country = roots.data.find((node) => node.nodeType === "country") ?? roots.data[0];
      if (!country) return setError("Locations could not be loaded.");
      const children = await fetchLocationChildren(country.id);
      if (cancelled) return;
      if (!children.ok) return setError(children.error.message);
      setLevels([{ parentId: country.id, options: children.data, selectedId: "" }]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { levels, setLevels, error, setError };
}
