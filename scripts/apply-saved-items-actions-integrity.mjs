import { readFile, rm, writeFile } from "node:fs/promises";

async function transform(path, mutate) {
  const source = await readFile(path, "utf8");
  const next = mutate(source);
  if (next === source) throw new Error(`${path}: transformation made no changes`);
  await writeFile(path, next);
}
function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}
function replaceRegexOnce(source, pattern, replacement, label) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const count = [...source.matchAll(new RegExp(pattern.source, flags))].length;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(pattern, replacement);
}

await transform("src/features/favorites/FavoriteListingCard.tsx", (initial) => {
  let source = initial;
  source = replaceOnce(
    source,
    `  onRemove,\n}: {\n  listing: ClassifiedListing;\n  onRemove: () => void;\n})`,
    `  onRemove,\n  removing = false,\n}: {\n  listing: ClassifiedListing;\n  onRemove: () => void;\n  removing?: boolean;\n})`,
    "favorite card removing prop",
  );
  source = replaceOnce(
    source,
    `          onClick={onRemove}\n          aria-label=`,
    `          onClick={onRemove}\n          disabled={removing}\n          aria-busy={removing}\n          aria-label=`,
    "favorite card disabled button",
  );
  source = replaceOnce(
    source,
    `          className="text-destructive"`,
    `          className="text-destructive disabled:cursor-wait disabled:opacity-50"`,
    "favorite card disabled style",
  );
  return source;
});

await transform("src/routes/favorites.tsx", (initial) => {
  let source = initial;
  source = replaceOnce(
    source,
    `  const [actionMessage, setActionMessage] = useState("");\n  const removeInFlightRef`,
    `  const [actionMessage, setActionMessage] = useState("");\n  const [removingIds, setRemovingIds] = useState<Set<string>>(() => new Set());\n  const removeInFlightRef`,
    "favorites removing state",
  );
  source = replaceRegexOnce(
    source,
    /  const loadFavorites = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[auth\.profile\?\.id, profileId\]\);/,
    `  const loadFavorites = useCallback(async () => {
    if (!profileId) return;

    const currentProfileId = profileId;
    const requestId = ++loadRequestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFavoriteJourneyItems(currentProfileId);
      if (requestId !== loadRequestIdRef.current || currentProfileId !== profileIdRef.current) return;
      if (result.ok) {
        setItems(result.data);
        setHasLoaded(true);
      } else {
        setError(result.error);
      }
    } catch (caught) {
      if (requestId !== loadRequestIdRef.current || currentProfileId !== profileIdRef.current) return;
      setError({
        code: "unknown",
        message:
          caught instanceof Error
            ? caught.message
            : text("تعذر تحميل المفضلة. حاول مرة أخرى.", "Could not load favorites. Try again."),
        operation: "favorite_journey_load",
      });
    } finally {
      if (requestId === loadRequestIdRef.current && currentProfileId === profileIdRef.current) {
        setLoading(false);
      }
    }
  }, [profileId, text]);`,
    "favorites load lifecycle",
  );
  source = replaceOnce(
    source,
    `      setActionMessage("");\n      return;`,
    `      setActionMessage("");\n      setRemovingIds(new Set());\n      return;`,
    "favorites auth reset removing state",
  );
  source = replaceRegexOnce(
    source,
    /  async function remove\(listingId: string\) \{[\s\S]*?\n  \}\n\n  if \(auth\.status === "loading"\)/,
    `  async function remove(listingId: string) {
    const currentProfileId = profileId;
    if (!currentProfileId) return;
    const scopeKey = [currentProfileId, listingId].join(":");
    if (removeInFlightRef.current.has(scopeKey)) return;

    removeInFlightRef.current.add(scopeKey);
    setRemovingIds((current) => new Set(current).add(listingId));
    setActionMessage("");
    try {
      const result = await unfavoriteListing(currentProfileId, listingId);
      if (currentProfileId !== profileIdRef.current) return;
      if (!result.ok) {
        setActionMessage(result.error.message);
        return;
      }
      setItems((current) => current.filter((item) => item.listingId !== listingId));
    } catch (caught) {
      if (currentProfileId !== profileIdRef.current) return;
      setActionMessage(
        caught instanceof Error
          ? caught.message
          : text("تعذر إزالة الإعلان من المفضلة.", "Could not remove the listing from favorites."),
      );
    } finally {
      removeInFlightRef.current.delete(scopeKey);
      if (currentProfileId === profileIdRef.current) {
        setRemovingIds((current) => {
          const next = new Set(current);
          next.delete(listingId);
          return next;
        });
      }
    }
  }

  if (auth.status === "loading")`,
    "favorites remove lifecycle",
  );
  source = replaceOnce(
    source,
    `                        listing={listing}\n                        onRemove={() => void remove(item.listingId)}\n                      />`,
    `                        listing={listing}\n                        removing={removingIds.has(item.listingId)}\n                        onRemove={() => void remove(item.listingId)}\n                      />`,
    "favorite card removing binding",
  );
  source = replaceOnce(
    source,
    `                           type="button"\n                           onClick={() => void remove(item.listingId)}\n                           className="grid h-9 w-9 place-items-center rounded-full bg-muted-surface text-destructive"`,
    `                           type="button"\n                           onClick={() => void remove(item.listingId)}\n                           disabled={removingIds.has(item.listingId)}\n                           aria-busy={removingIds.has(item.listingId)}\n                           className="grid h-9 w-9 place-items-center rounded-full bg-muted-surface text-destructive disabled:cursor-wait disabled:opacity-50"`,
    "unavailable favorite remove disabled",
  );
  return source;
});

await transform("src/routes/saved-searches.tsx", (initial) => {
  let source = initial;
  source = replaceOnce(
    source,
    `  const [message, setMessage] = useState("");\n  const [savingFrequencyId`,
    `  const [message, setMessage] = useState("");\n  const [creating, setCreating] = useState(false);\n  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set());\n  const [savingFrequencyId`,
    "saved search action states",
  );
  source = replaceRegexOnce(
    source,
    /  const loadSavedSearches = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[auth\.profile\?\.id, profileId, text\]\);/,
    `  const loadSavedSearches = useCallback(async () => {
    if (!profileId) return;

    const currentProfileId = profileId;
    const requestId = ++loadRequestIdRef.current;
    setLoading(true);
    setLoadError(null);
    setScanMessage("");
    try {
      const result = await fetchSavedSearches(currentProfileId);
      if (requestId !== loadRequestIdRef.current || currentProfileId !== profileIdRef.current) return;
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }

      setItems(result.data);
      setHasLoaded(true);
      setLoading(false);

      try {
        const scanResult = await scanDueSavedSearchAlerts(currentProfileId);
        if (requestId !== loadRequestIdRef.current || currentProfileId !== profileIdRef.current) return;
        if (!scanResult.ok) {
          setScanMessage(
            text(
              "تم تحميل عمليات البحث، لكن تعذر فحص النتائج الجديدة الآن.",
              "Saved searches loaded, but new matches could not be scanned right now.",
            ),
          );
          return;
        }
        if (scanResult.data.createdNotifications > 0) {
          setScanMessage(
            text(
              `تم العثور على ${scanResult.data.createdNotifications} نتيجة جديدة وإضافتها إلى إشعاراتك.`,
              `${scanResult.data.createdNotifications} new matches were added to your notifications.`,
            ),
          );
        }
        const refreshed = await fetchSavedSearches(currentProfileId);
        if (requestId !== loadRequestIdRef.current || currentProfileId !== profileIdRef.current) return;
        if (refreshed.ok) {
          setItems(refreshed.data);
        } else {
          setScanMessage(
            text(
              "تم فحص التنبيهات، لكن تعذر تحديث تفاصيل عمليات البحث فورًا.",
              "Alerts were scanned, but saved-search details could not refresh immediately.",
            ),
          );
        }
      } catch {
        if (requestId !== loadRequestIdRef.current || currentProfileId !== profileIdRef.current) return;
        setScanMessage(
          text(
            "تم تحميل عمليات البحث، لكن تعذر فحص النتائج الجديدة الآن.",
            "Saved searches loaded, but new matches could not be scanned right now.",
          ),
        );
      }
    } catch (caught) {
      if (requestId !== loadRequestIdRef.current || currentProfileId !== profileIdRef.current) return;
      setLoadError({
        code: "unknown",
        message:
          caught instanceof Error
            ? caught.message
            : text(
                "تعذر تحميل عمليات البحث المحفوظة.",
                "Could not load saved searches.",
              ),
        operation: "saved_searches_load",
      });
    } finally {
      if (requestId === loadRequestIdRef.current && currentProfileId === profileIdRef.current) {
        setLoading(false);
      }
    }
  }, [profileId, text]);`,
    "saved searches load lifecycle",
  );
  source = replaceOnce(
    source,
    `      setSavingFrequencyId(null);\n      setMessage("");`,
    `      setSavingFrequencyId(null);\n      setCreating(false);\n      setDeletingIds(new Set());\n      setMessage("");`,
    "saved searches reset action states",
  );
  source = replaceRegexOnce(
    source,
    /  async function addSavedSearch\(event: FormEvent\) \{[\s\S]*?\n  \}\n\n  function toLocalFilters/,
    `  async function addSavedSearch(event: FormEvent) {
    event.preventDefault();
    const currentProfileId = profileId;
    if (!currentProfileId || creatingSearchProfilesRef.current.has(currentProfileId)) return;

    const label = name.trim() || text("بحث محفوظ", "Saved search");
    const filters = buildListingFilters();
    const currentFrequency = frequency;
    const saveLocally = () => {
      setLocalItems((current) => [
        {
          id: `local-${currentProfileId}-${Date.now()}`,
          nameAr: label,
          filters: toLocalFilters(filters),
          createdAt: new Date().toISOString(),
          frequency: currentFrequency,
        },
        ...current,
      ]);
      setMessage(
        text(
          "تعذر حفظ البحث في الحساب، فتم حفظه لهذه الجلسة فقط.",
          "Could not save this search to the account, so it was saved for this session only.",
        ),
      );
    };

    creatingSearchProfilesRef.current.add(currentProfileId);
    setCreating(true);
    setMessage("");
    try {
      const result = await createSavedSearch(currentProfileId, {
        nameAr: label,
        filters,
        alertFrequency: currentFrequency,
      });
      if (currentProfileId !== profileIdRef.current) return;
      if (result.ok) {
        setItems((current) => [
          result.data,
          ...current.filter((item) => item.id !== result.data.id),
        ]);
        setHasLoaded(true);
        setMessage(text("تم حفظ البحث في حسابك.", "Search saved to your account."));
      } else {
        saveLocally();
      }
      setName("");
      setKeyword("");
    } catch {
      if (currentProfileId !== profileIdRef.current) return;
      saveLocally();
      setName("");
      setKeyword("");
    } finally {
      creatingSearchProfilesRef.current.delete(currentProfileId);
      if (currentProfileId === profileIdRef.current) setCreating(false);
    }
  }

  function toLocalFilters`,
    "saved search create lifecycle",
  );
  source = replaceOnce(
    source,
    `      setItems((current) => current.map((item) => (item.id === id ? result.data : item)));\n      setMessage(text("تم تحديث تكرار التنبيه.", "Alert frequency updated."));\n    } finally {`,
    `      setItems((current) => current.map((item) => (item.id === id ? result.data : item)));\n      setMessage(text("تم تحديث تكرار التنبيه.", "Alert frequency updated."));\n    } catch (caught) {\n      if (currentProfileId !== profileIdRef.current) return;\n      setItems(previous);\n      setMessage(\n        caught instanceof Error\n          ? caught.message\n          : text("تعذر تحديث تكرار التنبيه.", "Could not update alert frequency."),\n      );\n    } finally {`,
    "saved search frequency exception rollback",
  );
  source = replaceRegexOnce(
    source,
    /  async function removeSavedSearch\(id: string\) \{[\s\S]*?\n  \}\n\n  if \(auth\.status === "loading"\)/,
    `  async function removeSavedSearch(id: string) {
    const currentProfileId = profileId;
    if (!currentProfileId) return;
    const scopeKey = [currentProfileId, id].join(":");
    if (deletingSearchScopesRef.current.has(scopeKey)) return;

    deletingSearchScopesRef.current.add(scopeKey);
    setDeletingIds((current) => new Set(current).add(id));
    setMessage("");
    try {
      const result = await deleteSavedSearch(currentProfileId, id);
      if (currentProfileId !== profileIdRef.current) return;
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      setItems((current) => current.filter((item) => item.id !== id));
      setMessage(text("تم حذف البحث المحفوظ.", "Saved search removed."));
    } catch (caught) {
      if (currentProfileId !== profileIdRef.current) return;
      setMessage(
        caught instanceof Error
          ? caught.message
          : text("تعذر حذف البحث المحفوظ.", "Could not remove the saved search."),
      );
    } finally {
      deletingSearchScopesRef.current.delete(scopeKey);
      if (currentProfileId === profileIdRef.current) {
        setDeletingIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }
    }
  }

  if (auth.status === "loading")`,
    "saved search delete lifecycle",
  );
  source = replaceOnce(
    source,
    `        <form\n          onSubmit={addSavedSearch}\n          className=`,
    `        <form\n          onSubmit={addSavedSearch}\n          aria-busy={creating}\n          className=`,
    "saved search form busy state",
  );
  source = source.replaceAll(
    `            className="rounded-xl border border-input bg-card px-3 py-2.5 text-sm"`,
    `            disabled={creating}\n            className="rounded-xl border border-input bg-card px-3 py-2.5 text-sm disabled:opacity-60"`,
  );
  source = replaceOnce(
    source,
    `            type="submit"\n            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"`,
    `            type="submit"\n            disabled={creating}\n            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:cursor-wait disabled:opacity-60"`,
    "saved search submit disabled",
  );
  source = replaceOnce(
    source,
    `                    frequencyDisabled={savingFrequencyId === item.id}\n                    onFrequencyChange=`,
    `                    frequencyDisabled={savingFrequencyId === item.id}\n                    removeDisabled={deletingIds.has(item.id)}\n                    onFrequencyChange=`,
    "saved search delete state binding",
  );
  source = replaceOnce(
    source,
    `  frequencyDisabled = false,\n  onFrequencyChange,`,
    `  frequencyDisabled = false,\n  removeDisabled = false,\n  onFrequencyChange,`,
    "search row remove disabled default",
  );
  source = replaceOnce(
    source,
    `  frequencyDisabled?: boolean;\n  onFrequencyChange?:`,
    `  frequencyDisabled?: boolean;\n  removeDisabled?: boolean;\n  onFrequencyChange?:`,
    "search row remove disabled type",
  );
  source = replaceOnce(
    source,
    `             type="button"\n             onClick={onRemove}\n             className="grid h-9 w-9 place-items-center rounded-full bg-muted-surface text-destructive"`,
    `             type="button"\n             onClick={onRemove}\n             disabled={removeDisabled}\n             aria-busy={removeDisabled}\n             className="grid h-9 w-9 place-items-center rounded-full bg-muted-surface text-destructive disabled:cursor-wait disabled:opacity-50"`,
    "search row remove disabled button",
  );
  return source;
});

await rm("scripts/apply-saved-items-actions-integrity.mjs", { force: true });
