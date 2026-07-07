import type { CanonicalLocationNode } from "@/lib/api/location-taxonomy";
import { fetchLocationChildren } from "@/lib/api/location-taxonomy";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useLocationLevels } from "./use-location-levels";

export function CanonicalLocationSelector({
  onChange,
}: {
  onChange: (id: string | null, node: CanonicalLocationNode | null) => void;
}) {
  const { language, text } = useUiPreferences();
  const { levels, setLevels, error, setError } = useLocationLevels();

  async function selectAt(index: number, selectedId: string) {
    const selected = levels[index]?.options.find((option) => option.id === selectedId) ?? null;
    const next = levels
      .slice(0, index + 1)
      .map((level, currentIndex) => (currentIndex === index ? { ...level, selectedId } : level));

    setError(null);
    setLevels(next);
    if (!selected) {
      const previous = next
        .slice(0, index)
        .map((level) => level.options.find((option) => option.id === level.selectedId))
        .filter((node): node is CanonicalLocationNode => Boolean(node))
        .at(-1);
      onChange(previous?.id ?? null, previous ?? null);
      return;
    }

    onChange(selected.id, selected);
    const children = await fetchLocationChildren(selected.id);
    if (!children.ok) return setError(children.error.message);
    if (children.data.length > 0) {
      setLevels([...next, { parentId: selected.id, options: children.data, selectedId: "" }]);
    }
  }

  return (
    <div className="space-y-3">
      {levels.map((level, index) => (
        <select
          key={`${level.parentId}-${index}`}
          value={level.selectedId}
          onChange={(event) => void selectAt(index, event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
        >
          <option value="">{text("اختر الموقع", "Choose location")}</option>
          {level.options.map((option) => (
            <option key={option.id} value={option.id}>
              {language === "en" ? option.nameEn || option.nameAr : option.nameAr}
            </option>
          ))}
        </select>
      ))}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
