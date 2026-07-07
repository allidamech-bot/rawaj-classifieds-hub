import { useEffect, useRef, useState } from "react";
import {
  fetchLocationChildren,
  fetchLocationPath,
  fetchLocationRoots,
  type CanonicalLocationNode,
} from "@/lib/api/location-taxonomy";
import { useUiPreferences } from "@/lib/ui-preferences";

type Level = {
  parentId: string;
  options: CanonicalLocationNode[];
  selectedId: string;
};

export function CanonicalLocationSelector({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (id: string | null, node: CanonicalLocationNode | null) => void;
}) {
  const { language, text } = useUiPreferences();
  const [levels, setLevels] = useState<Level[]>([]);
  const [error, setError] = useState<string | null>(null);
  const operationRef = useRef(0);

  useEffect(() => {
    const operation = ++operationRef.current;
    void (async () => {
      const roots = await fetchLocationRoots("SY");
      if (operation !== operationRef.current) return;
      if (!roots.ok) return setError(roots.error.message);
      const country = roots.data.find((node) => node.nodeType === "country") ?? roots.data[0];
      if (!country) return setError(text("تعذر تحميل المواقع.", "Locations could not be loaded."));
      const first = await fetchLocationChildren(country.id);
      if (operation !== operationRef.current) return;
      if (!first.ok) return setError(first.error.message);
      if (!value) return setLevels([{ parentId: country.id, options: first.data, selectedId: "" }]);
      const path = await fetchLocationPath(value);
      if (operation !== operationRef.current) return;
      if (!path.ok || path.data.length === 0) {
        setLevels([{ parentId: country.id, options: first.data, selectedId: "" }]);
        return setError(path.ok ? text("الموقع المحدد غير متاح.", "Selected location is unavailable.") : path.error.message);
      }
      const selectedPath = path.data.filter((node) => node.nodeType !== "country");
      const restored: Level[] = [];
      let options = first.data;
      let parentId = country.id;
      for (const selected of selectedPath) {
        restored.push({ parentId, options, selectedId: selected.id });
        const children = await fetchLocationChildren(selected.id);
        if (operation !== operationRef.current) return;
        if (!children.ok || children.data.length === 0) break;
        parentId = selected.id;
        options = children.data;
      }
      const last = selectedPath.at(-1);
      if (last) {
        const children = await fetchLocationChildren(last.id);
        if (operation !== operationRef.current) return;
        if (children.ok && children.data.length > 0) restored.push({ parentId: last.id, options: children.data, selectedId: "" });
      }
      setLevels(restored);
    })();
    return () => { operationRef.current += 1; };
  }, [text, value]);

  async function selectAt(index: number, selectedId: string) {
    const selected = levels[index]?.options.find((option) => option.id === selectedId) ?? null;
    const next = levels.slice(0, index + 1).map((level, i) => i === index ? { ...level, selectedId } : level);
    setError(null);
    setLevels(next);
    if (!selected) return onChange(null, null);
    onChange(selected.id, selected);
    const children = await fetchLocationChildren(selected.id);
    if (!children.ok) return setError(children.error.message);
    if (children.data.length > 0) setLevels([...next, { parentId: selected.id, options: children.data, selectedId: "" }]);
  }

  return <div className="space-y-3">
    {levels.map((level, index) => <select
      key={`${level.parentId}-${index}`}
      value={level.selectedId}
      onChange={(event) => void selectAt(index, event.target.value)}
      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
    >
      <option value="">{text("اختر الموقع", "Choose location")}</option>
      {level.options.map((option) => <option key={option.id} value={option.id}>
        {language === "en" ? option.nameEn || option.nameAr : option.nameAr}
      </option>)}
    </select>)}
    {error ? <p className="text-sm text-red-600">{error}</p> : null}
  </div>;
}
