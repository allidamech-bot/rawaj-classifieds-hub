import {
  BellRing,
  Bookmark,
  Heart,
  MessageCircle,
  RadioTower,
  ScrollText,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  fetchNotificationPreferences,
  updateNotificationPreference,
  type NotificationPreferenceKey,
  type NotificationPreferences,
} from "@/lib/classifieds-api";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

const preferenceItems = [
  {
    key: "messagesEnabled",
    titleAr: "الرسائل والمحادثات",
    titleEn: "Messages and conversations",
    hintAr: "تنبيهات مرتبطة بالمحادثات والرسائل الجديدة.",
    hintEn: "Notifications related to conversations and new messages.",
    icon: MessageCircle,
  },
  {
    key: "priceChangesEnabled",
    titleAr: "تغيّر السعر",
    titleEn: "Price changes",
    hintAr: "تغيّر سعر إعلان محفوظ أو مرتبط بنشاطك.",
    hintEn: "Price changes for saved listings or related activity.",
    icon: Heart,
  },
  {
    key: "savedSearchMatchesEnabled",
    titleAr: "نتائج البحث المحفوظ",
    titleEn: "Saved search matches",
    hintAr: "إعلانات جديدة تطابق عمليات البحث التي حفظتها.",
    hintEn: "New listings matching searches you saved.",
    icon: Bookmark,
  },
  {
    key: "listingStatusEnabled",
    titleAr: "حالة الإعلان",
    titleEn: "Listing status",
    hintAr: "المراجعة والموافقة والرفض وتغيّرات دورة حياة الإعلان.",
    hintEn: "Review, approval, rejection, and listing lifecycle changes.",
    icon: ScrollText,
  },
  {
    key: "reviewsEnabled",
    titleAr: "التقييمات",
    titleEn: "Reviews",
    hintAr: "أحداث التقييم والمراجعات المرتبطة بحسابك.",
    hintEn: "Review activity associated with your account.",
    icon: BellRing,
  },
  {
    key: "promotionsEnabled",
    titleAr: "عروض رواج والترويج",
    titleEn: "RAWAJ offers and promotions",
    hintAr: "تحديثات طلبات الترويج والعروض داخل رواج.",
    hintEn: "Promotion request updates and RAWAJ in-app offers.",
    icon: Sparkles,
  },
] as const satisfies ReadonlyArray<{
  key: NotificationPreferenceKey;
  titleAr: string;
  titleEn: string;
  hintAr: string;
  hintEn: string;
  icon: typeof BellRing;
}>;

export function NotificationPreferencesPanel() {
  const auth = useAuth();
  const { text } = useUiPreferences();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<NotificationPreferenceKey | null>(null);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);
  const profileId = auth.profile?.id ?? null;

  useEffect(() => {
    if (auth.status !== "signedIn" || !profileId) {
      requestIdRef.current += 1;
      setPreferences(null);
      setLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");
    void fetchNotificationPreferences(profileId).then((result) => {
      if (requestId !== requestIdRef.current) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setPreferences(result.data);
    });
  }, [auth.status, profileId]);

  async function handleToggle(key: NotificationPreferenceKey) {
    if (!profileId || !preferences || savingKey) return;
    const nextEnabled = !preferences[key];
    const previous = preferences;
    setPreferences({ ...preferences, [key]: nextEnabled });
    setSavingKey(key);
    setError("");

    const result = await updateNotificationPreference(profileId, key, nextEnabled);
    setSavingKey(null);
    if (!result.ok) {
      setPreferences(previous);
      setError(result.error.message);
      return;
    }
    setPreferences(result.data);
  }

  if (auth.status !== "signedIn") return null;

  return (
    <section className="rounded-2xl bg-card p-4 shadow-soft hairline">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/8 text-primary">
          <BellRing className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-sm font-extrabold">
            {text("تفضيلات الإشعارات", "Notification preferences")}
          </h2>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">
            {text(
              "تحكم بفئات الإشعارات داخل رواج. لا نعرض قنوات بريد أو Push قبل توفر توصيل فعلي لها.",
              "Control in-app notification categories. Email and push channels are not shown until real delivery exists.",
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-2xl bg-muted-surface/70 p-3 hairline">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-card text-primary shadow-soft">
          <RadioTower className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold">
            {text("جاهزية Push", "Push readiness")}
          </p>
          <p className="mt-1 text-[10px] leading-5 text-muted-foreground">
            {text(
              "رواج يجهّز البنية التقنية لـ Push، لكن لا يوجد اشتراك أو إرسال Push فعلي مفعّل حتى الآن.",
              "RAWAJ is preparing the technical foundation for push, but no push subscription or real push delivery is enabled yet.",
            )}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 text-xs text-muted-foreground">
          {text("جارٍ تحميل التفضيلات...", "Loading preferences...")}
        </p>
      ) : preferences ? (
        <div className="mt-4 divide-y divide-border/70">
          {preferenceItems.map((item) => {
            const Icon = item.icon;
            const enabled = preferences[item.key];
            const saving = savingKey === item.key;
            return (
              <div key={item.key} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted-surface text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold">{text(item.titleAr, item.titleEn)}</p>
                    <p className="mt-0.5 text-[10px] leading-5 text-muted-foreground">
                      {text(item.hintAr, item.hintEn)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  disabled={savingKey !== null}
                  onClick={() => void handleToggle(item.key)}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-60 ${
                    enabled ? "bg-primary" : "bg-muted-surface hairline"
                  }`}
                  aria-label={text(item.titleAr, item.titleEn)}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-card shadow-soft transition-all ${
                      enabled ? "start-6" : "start-1"
                    }`}
                  />
                  <span className="sr-only">{saving ? text("جارٍ الحفظ", "Saving") : ""}</span>
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {error && (
        <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
