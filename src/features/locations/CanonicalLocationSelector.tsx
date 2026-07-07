import { useEffect, useState } from "react";
import type {
  CanonicalLocationNode,
  LocationSearchResult,
} from "@/lib/api/location-taxonomy";
import {
  fetchLocationChildren,
  searchLocationNodes,
} from "@/lib/api/location-taxonomy";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useLocationLevels } from "./use-location-levels";

export function CanonicalLocationSelector({
  value,
  onChange,
  disabled = false,
}: {
  value?: string | null;
  onChange: (id: string | null, node: CanonicalLocationNode | null) => void;
  disabled?: boolean;
}) {
  const { language, text } = useUiPreferences();
  const { levels, setLevels, error, setError } = useLocationLevels(value);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const clean = query.trim();
    if (clean.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      setSearchError(null);
      void searchLocationNodes(clean).then((result) => {
        if (cancelled) return;
        setSearching(false);
        if (!result.ok) {
          setResults([]);
          setSearchError(result.error.message);
          return;
        }
        setResults(result.data);
      });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  async function selectAt(index: number, selectedId: string) {
    const selected =
      levels[index]?.options.find((option) => option.id === selectedId) ?? null;
    const next = levels
      .slice(0, index + 1)
      .map((level, currentIndex) =>
        currentIndex === index ? { ...level, selectedId } : level,
      );

    setError(null);
    setLevels(next);
    if (!selected) {
      const previous = next
        .slice(0, index)
        .map((level) =>
          level.options.find((option) => option.id === level.selectedId),
        )
        .filter((node): node is CanonicalLocationNode => Boolean(node))
        .at(-1);
      onChange(previous?.id ?? null, previous ?? null);
      return;
    }

    onChange(selected.id, selected);
    const children = await fetchLocationChildren(selected.id);
    if (!children.ok) return setError(children.error.message);
    if (children.data.length > 0) {
      setLevels([
        ...next,
        { parentId: selected.id, options: children.data, selectedId: "" },
      ]);
    }
  }

  function selectSearchResult(result: LocationSearchResult) {
    setQuery("");
    setResults([]);
    setSearchError(null);
    onChange(result.node.id, result.node);
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={disabled}
          placeholder={text(
            "ابحث باسم الموقع أو اسمه الشائع",
            "Search location or common name",
          )}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:opacity-50"
        />
        {query.trim().length >= 2 ? (
          <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
            {searching ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                {text("جارٍ البحث...", "Searching...")}
              </p>
            ) : null}
            {!searching && results.length === 0 && !searchError ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                {text("لا توجد مواقع مطابقة", "No matching locations")}
              </p>
            ) : null}
            {results.map((result) => (
              <button
                key={result.node.id}
                type="button"
                onClick={() => selectSearchResult(result)}
                className="block w-full rounded-lg px-3 py-2 text-start hover:bg-muted-surface"
              >
                <span className="block text-sm font-bold">
                  {language === "en"
                    ? result.node.nameEn || result.node.nameAr
                    : result.node.nameAr}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {language === "en" ? result.pathEn : result.pathAr}
                </span>
                {result.matchedAlias ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {text("اسم شائع: ", "Matched alias: ")}
                    {result.matchedAlias}
                  </span>
                ) : null}
              </button>
            ))}
            {searchError ? (
              <p className="px-3 py-2 text-sm text-red-600">{searchError}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      {levels.map((level, index) => (
        <select
          key={`${level.parentId}-${index}`}
          value={level.selectedId}
          onChange={(event) => void selectAt(index, event.target.value)}
          disabled={disabled}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:opacity-50"
        >
          <option value="">{text("اختر الموقع", "Choose location")}</option>
          {level.options.map((option) => (
            <option key={option.id} value={option.id}>
              {language === "en"
                ? option.nameEn || option.nameAr
                : option.nameAr}
            </option>
          ))}
        </select>
      ))}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
