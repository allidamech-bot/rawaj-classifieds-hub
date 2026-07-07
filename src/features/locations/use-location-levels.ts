import { useEffect, useState } from "react";
import {
  fetchLocationChildren,
  fetchLocationPath,
  fetchLocationRoots,
  type CanonicalLocationNode,
} from "@/lib/api/location-taxonomy";

export type LocationLevel = {
  parentId: string;
  options: CanonicalLocationNode[];
  selectedId: string;
};

export function useLocationLevels(value?: string | null) {
  const [levels, setLevels] = useState<LocationLevel[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setError(null);
      const roots = await fetchLocationRoots("SY");
      if (cancelled) return;
      if (!roots.ok) return setError(roots.error.message);

      const country = roots.data.find((node) => node.nodeType === "country") ?? roots.data[0];
      if (!country) return setError("Locations could not be loaded.");

      const first = await fetchLocationChildren(country.id);
      if (cancelled) return;
      if (!first.ok) return setError(first.error.message);
      if (!value) {
        setLevels([{ parentId: country.id, options: first.data, selectedId: "" }]);
        return;
      }

      const path = await fetchLocationPath(value);
      if (cancelled) return;
      if (!path.ok || path.data.length === 0) {
        setLevels([{ parentId: country.id, options: first.data, selectedId: "" }]);
        setError(path.ok ? "Selected location is unavailable." : path.error.message);
        return;
      }

      const selectedPath = path.data.filter((node) => node.nodeType !== "country");
      const restored: LocationLevel[] = [];
      let parentId = country.id;
      let options = first.data;

      for (const selected of selectedPath) {
        restored.push({ parentId, options, selectedId: selected.id });
        const children = await fetchLocationChildren(selected.id);
        if (cancelled) return;
        if (!children.ok || children.data.length === 0) break;
        parentId = selected.id;
        options = children.data;
      }

      const last = selectedPath.at(-1);
      if (last) {
        const children = await fetchLocationChildren(last.id);
        if (cancelled) return;
        if (children.ok && children.data.length > 0) {
          restored.push({ parentId: last.id, options: children.data, selectedId: "" });
        }
      }

      setLevels(restored);
    })();

    return () => {
      cancelled = true;
    };
  }, [value]);

  return { levels, setLevels, error, setError };
}
