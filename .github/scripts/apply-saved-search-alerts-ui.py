from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 anchor, found {count}")
    return text.replace(old, new, 1)

# Extend shared types.
path = Path("src/lib/classifieds-types.ts")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    '''export interface SavedSearch {
  id: string;
  userId: string;
  nameAr: string;
  filters: ListingFilters;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavedSearchPayload {
  nameAr: string;
  filters: ListingFilters;
}
''',
    '''export type SavedSearchAlertFrequency = "daily" | "weekly" | "off";

export interface SavedSearch {
  id: string;
  userId: string;
  nameAr: string;
  filters: ListingFilters;
  alertFrequency: SavedSearchAlertFrequency;
  lastAlertCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavedSearchPayload {
  nameAr: string;
  filters: ListingFilters;
  alertFrequency?: SavedSearchAlertFrequency;
}
''',
    "saved search alert types",
)
path.write_text(text, encoding="utf-8")

# Wire persisted alert settings and bounded scan into Saved Searches page.
path = Path("src/routes/saved-searches.tsx")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    'import { createSavedSearch, deleteSavedSearch, fetchSavedSearches } from "@/lib/classifieds-api";\n',
    'import {\n  createSavedSearch,\n  deleteSavedSearch,\n  fetchSavedSearches,\n  scanDueSavedSearchAlerts,\n  updateSavedSearchAlertFrequency,\n} from "@/lib/classifieds-api";\n',
    "saved search alert imports",
)
text = replace_once(
    text,
    'import type { ClassifiedsError, ListingFilters, SavedSearch } from "@/lib/classifieds-types";\n',
    'import type {\n  ClassifiedsError,\n  ListingFilters,\n  SavedSearch,\n  SavedSearchAlertFrequency,\n} from "@/lib/classifieds-types";\n',
    "saved search alert type imports",
)
text = replace_once(
    text,
    '  const [message, setMessage] = useState("");\n',
    '  const [message, setMessage] = useState("");\n  const [savingFrequencyId, setSavingFrequencyId] = useState<string | null>(null);\n  const [scanMessage, setScanMessage] = useState("");\n',
    "saved search alert state",
)
text = replace_once(
    text,
    '''      const result = await fetchSavedSearches(auth.profile?.id ?? null);
      if (cancelled) return;
      if (result.ok) setItems(result.data);
      else {
        setError(result.error);
        setItems([]);
      }
      setLoading(false);
''',
    '''      const userId = auth.profile?.id ?? null;
      const result = await fetchSavedSearches(userId);
      if (cancelled) return;
      if (result.ok) {
        setItems(result.data);
        const scanResult = await scanDueSavedSearchAlerts(userId);
        if (cancelled) return;
        if (scanResult.ok) {
          if (scanResult.data.createdNotifications > 0) {
            setScanMessage(
              text(
                `تم العثور على ${scanResult.data.createdNotifications} نتيجة جديدة وإضافتها إلى إشعاراتك.`,
                `${scanResult.data.createdNotifications} new matches were added to your notifications.`,
              ),
            );
          }
          const refreshed = await fetchSavedSearches(userId);
          if (!cancelled && refreshed.ok) setItems(refreshed.data);
        }
      } else {
        setError(result.error);
        setItems([]);
      }
      setLoading(false);
''',
    "bounded alert scan on load",
)
text = replace_once(
    text,
    '''    const result = await createSavedSearch(auth.profile?.id ?? null, {
      nameAr: label,
      filters,
    });
''',
    '''    const result = await createSavedSearch(auth.profile?.id ?? null, {
      nameAr: label,
      filters,
      alertFrequency: frequency,
    });
''',
    "persist create frequency",
)
text = replace_once(
    text,
    '''  async function removeSavedSearch(id: string) {
''',
    '''  async function changeAlertFrequency(id: string, next: SavedSearchAlertFrequency) {
    setSavingFrequencyId(id);
    setMessage("");
    const previous = items;
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, alertFrequency: next } : item)),
    );
    const result = await updateSavedSearchAlertFrequency(auth.profile?.id ?? null, id, next);
    setSavingFrequencyId(null);
    if (!result.ok) {
      setItems(previous);
      setError(result.error);
      setMessage(result.error.message);
      return;
    }
    setItems((current) => current.map((item) => (item.id === id ? result.data : item)));
    setMessage(text("تم تحديث تكرار التنبيه.", "Alert frequency updated."));
  }

  async function removeSavedSearch(id: string) {
''',
    "frequency update handler",
)
text = replace_once(
    text,
    '''              "أنشئ بحثاً باسم واضح واضبط تكرار التنبيه كإعداد واجهة، ثم افتحه من هنا عند الحاجة.",
              "Create a clearly named search, set an alert frequency as an interface preference, and reopen it from here when needed.",
''',
    '''              "أنشئ بحثاً باسم واضح واضبط تكرار تنبيه حقيقي داخل رواج. يتم الفحص بشكل محدود عند استخدامك لرواج، مع منع تكرار نفس الإعلان.",
              "Create a clearly named search and set a real in-app alert cadence. RAWAJ runs bounded checks while you use the app and deduplicates the same listing.",
''',
    "real alert description",
)
text = replace_once(
    text,
    '''        {message && (
''',
    '''        {scanMessage && (
          <p className="rounded-xl bg-emerald-trust/10 p-3 text-xs font-semibold text-foreground">
            {scanMessage}
          </p>
        )}

        {message && (
''',
    "scan result message",
)
text = replace_once(
    text,
    '''                frequency="weekly"
                onRemove={() => void removeSavedSearch(item.id)}
''',
    '''                frequency={item.alertFrequency}
                frequencyDisabled={savingFrequencyId === item.id}
                onFrequencyChange={(next) => void changeAlertFrequency(item.id, next)}
                onRemove={() => void removeSavedSearch(item.id)}
''',
    "persisted row frequency",
)
text = replace_once(
    text,
    '''  local = false,
  onRemove,
}: {
''',
    '''  local = false,
  frequencyDisabled = false,
  onFrequencyChange,
  onRemove,
}: {
''',
    "search row params",
)
text = replace_once(
    text,
    '''  frequency: LocalSearch["frequency"];
  local?: boolean;
  onRemove?: () => void;
''',
    '''  frequency: SavedSearchAlertFrequency;
  local?: boolean;
  frequencyDisabled?: boolean;
  onFrequencyChange?: (next: SavedSearchAlertFrequency) => void;
  onRemove?: () => void;
''',
    "search row prop types",
)
text = replace_once(
    text,
    '''            <span className="inline-flex items-center gap-1">
              <Bell className="h-3 w-3" />
              {frequencyLabel(frequency, language)}
            </span>
''',
    '''            {onFrequencyChange ? (
              <label className="inline-flex items-center gap-1">
                <Bell className="h-3 w-3" />
                <span className="sr-only">{text("تكرار التنبيه", "Alert frequency")}</span>
                <select
                  value={frequency}
                  disabled={frequencyDisabled}
                  onChange={(event) =>
                    onFrequencyChange(event.target.value as SavedSearchAlertFrequency)
                  }
                  className="rounded-lg border border-border/70 bg-card px-1.5 py-1 text-[10px] font-semibold text-foreground disabled:opacity-60"
                >
                  <option value="daily">{text("يومي", "Daily")}</option>
                  <option value="weekly">{text("أسبوعي", "Weekly")}</option>
                  <option value="off">{text("متوقف", "Off")}</option>
                </select>
              </label>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Bell className="h-3 w-3" />
                {frequencyLabel(frequency, language)}
              </span>
            )}
''',
    "frequency control",
)
path.write_text(text, encoding="utf-8")
print("Applied saved search alert types and UI")
