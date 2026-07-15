import {
  BellRing,
  Bookmark,
  Heart,
  MessageCircle,
  ScrollText,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  fetchNotificationPreferences,
  fetchPushChannelStatus,
  updateNotificationPreference,
  type NotificationPreferenceKey,
  type NotificationPreferences,
  type PushChannelStatus,
} from "@/lib/classifieds-api";
import {
  disableNativePush,
  enableNativePush,
  getNativePushCapability,
  getOrCreatePushDeviceKey,
  type NativePushCapability,
} from "@/lib/native-push";
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

const EMPTY_PUSH_STATUS: PushChannelStatus = {
  pushEnabled: false,
  registered: false,
  permissionStatus: "prompt",
  platform: "android",
  lastSeenAt: null,
};

export function NotificationPreferencesPanel() {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [pushCapability, setPushCapability] = useState<NativePushCapability>({
    available: false,
    platform: "web",
  });
  const [pushStatus, setPushStatus] = useState<PushChannelStatus>(EMPTY_PUSH_STATUS);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<NotificationPreferenceKey | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [error, setError] = useState("");
  const [pushMessage, setPushMessage] = useState("");
  const requestIdRef = useRef(0);
  const profileId = auth.profile?.id ?? null;
  const profileIdRef = useRef<string | null>(profileId);
  const savingPreferenceProfilesRef = useRef<Set<string>>(new Set());
  const pushBusyProfilesRef = useRef<Set<string>>(new Set());
  profileIdRef.current = profileId;

  useEffect(() => {
    if (auth.status !== "signedIn" || !profileId) {
      requestIdRef.current += 1;
      setPreferences(null);
      setPushCapability({ available: false, platform: "web" });
      setPushStatus(EMPTY_PUSH_STATUS);
      setLoading(false);
      setSavingKey(null);
      setPushBusy(false);
      setError("");
      setPushMessage("");
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");
    setPushMessage("");

    void (async () => {
      const capability = await getNativePushCapability();
      if (requestId !== requestIdRef.current || profileId !== profileIdRef.current) return;
      setPushCapability(capability);

      const preferencesResult = await fetchNotificationPreferences(profileId);
      if (requestId !== requestIdRef.current || profileId !== profileIdRef.current) return;
      if (!preferencesResult.ok) {
        setLoading(false);
        setError(preferencesResult.error.message);
        return;
      }
      setPreferences(preferencesResult.data);

      if (capability.available) {
        const deviceKey = getOrCreatePushDeviceKey();
        const statusResult = await fetchPushChannelStatus(profileId, deviceKey);
        if (requestId !== requestIdRef.current || profileId !== profileIdRef.current) return;
        if (statusResult.ok) setPushStatus(statusResult.data);
      }
      setLoading(false);
    })();

    return () => {
      requestIdRef.current += 1;
    };
  }, [auth.status, profileId]);

  async function handleToggle(key: NotificationPreferenceKey) {
    const currentProfileId = profileId;
    if (
      !currentProfileId ||
      !preferences ||
      savingPreferenceProfilesRef.current.has(currentProfileId)
    )
      return;

    const nextEnabled = !preferences[key];
    const previous = preferences;
    savingPreferenceProfilesRef.current.add(currentProfileId);
    setPreferences({ ...preferences, [key]: nextEnabled });
    setSavingKey(key);
    setError("");
    try {
      const result = await updateNotificationPreference(currentProfileId, key, nextEnabled);
      if (currentProfileId !== profileIdRef.current) return;
      if (!result.ok) {
        setPreferences(previous);
        setError(result.error.message);
        return;
      }
      setPreferences(result.data);
    } finally {
      savingPreferenceProfilesRef.current.delete(currentProfileId);
      if (currentProfileId === profileIdRef.current) setSavingKey(null);
    }
  }

  async function handlePushToggle() {
    const currentProfileId = profileId;
    if (!currentProfileId || !preferences || pushBusyProfilesRef.current.has(currentProfileId))
      return;

    const currentPreferences = preferences;
    const currentCapability = pushCapability;
    pushBusyProfilesRef.current.add(currentProfileId);
    setPushBusy(true);
    setError("");
    setPushMessage("");
    try {
      if (currentPreferences.pushEnabled || pushStatus.registered) {
        const result = await disableNativePush(currentProfileId);
        if (currentProfileId !== profileIdRef.current) return;
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        setPreferences({ ...currentPreferences, pushEnabled: false });
        setPushStatus({ ...EMPTY_PUSH_STATUS, platform: currentCapability.platform });
        setPushMessage(
          text(
            "تم إيقاف الإشعارات الفورية على هذا الجهاز.",
            "Push notifications were disabled on this device.",
          ),
        );
        return;
      }

      const result = await enableNativePush(currentProfileId, language, true);
      if (currentProfileId !== profileIdRef.current) return;
      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      const enabled = result.data.permissionStatus === "granted" && result.data.registered;
      setPreferences({ ...currentPreferences, pushEnabled: enabled });
      setPushStatus({
        pushEnabled: enabled,
        registered: result.data.registered,
        permissionStatus: result.data.permissionStatus,
        platform: currentCapability.platform,
        lastSeenAt: enabled ? new Date().toISOString() : null,
      });
      setPushMessage(
        enabled
          ? text(
              "تم تفعيل الإشعارات الفورية على هذا الجهاز.",
              "Push notifications are enabled on this device.",
            )
          : text(
              "لم يمنح الهاتف إذن الإشعارات. يمكنك تفعيله من إعدادات النظام.",
              "Notification permission was not granted. You can enable it in system settings.",
            ),
      );
    } finally {
      pushBusyProfilesRef.current.delete(currentProfileId);
      if (currentProfileId === profileIdRef.current) setPushBusy(false);
    }
  }

  if (auth.status !== "signedIn") return null;

  const pushEnabled = Boolean(preferences?.pushEnabled && pushStatus.registered);

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
              "تحكم بفئات الإشعارات داخل رواج، وفعّل Push من تطبيق الهاتف لتصلك التنبيهات حتى عند إغلاقه.",
              "Control notification categories and enable push in the mobile app to receive alerts while it is closed.",
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-muted-surface p-3 hairline">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-card text-primary hairline">
              <Smartphone className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-extrabold">
                {text("إشعارات الهاتف الفورية", "Mobile push notifications")}
              </p>
              <p className="mt-0.5 text-[10px] leading-5 text-muted-foreground">
                {pushCapability.available
                  ? pushEnabled
                    ? text(
                        "هذا الجهاز مسجل ويستقبل التنبيهات.",
                        "This device is registered for push alerts.",
                      )
                    : pushStatus.permissionStatus === "denied"
                      ? text(
                          "الإذن مرفوض من إعدادات الهاتف.",
                          "Permission is blocked in system settings.",
                        )
                      : text(
                          "فعّلها لاستقبال الرسائل ونتائج البحث الجديدة.",
                          "Enable push for messages and new saved-search matches.",
                        )
                  : text(
                      "متاحة داخل تطبيق رواج على Android.",
                      "Available in the RAWAJ Android app.",
                    )}
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={pushEnabled}
            disabled={pushBusy || !pushCapability.available || loading || !preferences}
            onClick={() => void handlePushToggle()}
            className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${
              pushEnabled ? "bg-primary" : "bg-card hairline"
            }`}
            aria-label={text("إشعارات الهاتف الفورية", "Mobile push notifications")}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-card shadow-soft transition-all ${
                pushEnabled ? "start-6" : "start-1"
              }`}
            />
            <span className="sr-only">{pushBusy ? text("جارٍ الحفظ", "Saving") : ""}</span>
          </button>
        </div>
        {pushMessage ? (
          <p className="mt-2 text-[10px] font-semibold text-muted-foreground">{pushMessage}</p>
        ) : null}
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

      {error ? (
        <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
