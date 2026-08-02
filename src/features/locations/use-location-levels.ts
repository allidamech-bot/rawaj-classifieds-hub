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

const LOCATION_ROOT_SOURCE_PRIORITY = ["iso3166"];

function preferredCountryRoot(nodes: CanonicalLocationNode[]) {
  const countries = nodes.filter((node) => node.nodeType === "country");
  for (const source of LOCATION_ROOT_SOURCE_PRIORITY) {
    const match = countries.find((node) => node.externalSource === source);
    if (match) return match;
  }
  return countries[0] ?? nodes[0] ?? null;
}

export function useLocationLevels(value?: string | null) {
  const [levels, setLevels] = useState<LocationLevel[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setError(null);
      const roots = await fetchLocationRoots("SA");
      if (cancelled) return;
      if (!roots.ok) return setError(roots.error.message);

      if (!value) {
        const country = preferredCountryRoot(roots.data);
        if (!country) return setError("Locations could not be loaded.");
        const first = await fetchLocationChildren(country.id);
        if (cancelled) return;
        if (!first.ok) return setError(first.error.message);
        setLevels([{ parentId: country.id, options: first.data, selectedId: "" }]);
        return;
      }

      const path = await fetchLocationPath(value);
      if (cancelled) return;
      if (!path.ok || path.data.length === 0) {
        const country = preferredCountryRoot(roots.data);
        if (!country) return setError("Locations could not be loaded.");
        const first = await fetchLocationChildren(country.id);
        if (cancelled) return;
        if (!first.ok) return setError(first.error.message);
        setLevels([{ parentId: country.id, options: first.data, selectedId: "" }]);
        setError(path.ok ? "Selected location is unavailable." : path.error.message);
        return;
      }

      const country =
        path.data.find((node) => node.nodeType === "country") ?? preferredCountryRoot(roots.data);
      if (!country) return setError("Locations could not be loaded.");

      const first = await fetchLocationChildren(country.id);
      if (cancelled) return;
      if (!first.ok) return setError(first.error.message);

      const selectedPath = path.data.filter((node) => node.nodeType !== "country");
      const restored: LocationLevel[] = [];
      let parentId = country.id;
      let options = first.data;

      for (const [index, selected] of selectedPath.entries()) {
        restored.push({ parentId, options, selectedId: selected.id });
        const children = await fetchLocationChildren(selected.id);
        if (cancelled) return;
        if (!children.ok || children.data.length === 0) break;

        if (index === selectedPath.length - 1) {
          restored.push({ parentId: selected.id, options: children.data, selectedId: "" });
          break;
        }

        parentId = selected.id;
        options = children.data;
      }

      setLevels(restored);
    })();

    return () => {
      cancelled = true;
    };
  }, [value]);

  return { levels, setLevels, error, setError };
}
