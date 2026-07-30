import {
  BellRing,
  Bookmark,
  Heart,
  MessageCircle,
  ScrollText,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
  const loadedProfileIdRef = useRef<string | null>(null);
  const profileId = auth.profile?.id ?? null;
  const profileIdRef = useRef<string | null>(profileId);
  const savingPreferenceProfilesRef = useRef<Set<string>>(new Set());
  const pushBusyProfilesRef = useRef<Set<string>>(new Set());
  profileIdRef.current = profileId;

  useEffect(() => {
    if (auth.status !== "signedIn" || !profileId) {
      requestIdRef.current += 1;
      loadedProfileIdRef.current = null;
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

    if (loadedProfileIdRef.current !== profileId) {
      requestIdRef.current += 1;
      loadedProfileIdRef.current = profileId;
      setPreferences(null);
      setPushCapability({ available: false, platform: "web" });
      setPushStatus(EMPTY_PUSH_STATUS);
      setSavingKey(null);
      setPushBusy(false);
      setError("");
      setPushMessage("");
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");
    setPushMessage("");

    void (async () => {
      const capability = await getNativePushCapability();
      if (requestId !== requestIdRef.current || profileId !== profileIdRef.current) return;
      setPushCapability(capability);

      const preferencesResult = await fetchNotificationPreferences();
      if (requestId !== requestIdRef.current || profileId !== profileIdRef.current) return;
      if (!preferencesResult.ok) {
        setLoading(false);
        setError(preferencesResult.error.message);
        return;
      }
      setPreferences(preferencesResult.data);

      if (capability.available) {
        const deviceKey = getOrCreatePushDeviceKey();
        const statusResult = await fetchPushChannelStatus(deviceKey);
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
      const result = await updateNotificationPreference(key, nextEnabled);
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

  async function handleDevicePushToggle() {
    const currentProfileId = profileId;
    if (!currentProfileId || !preferences || pushBusyProfilesRef.current.has(currentProfileId)) {
      return;
    }

    const currentPreferences = preferences;
    const currentCapability = pushCapability;
    const currentStatus = pushStatus;
    pushBusyProfilesRef.current.add(currentProfileId);
    setPushBusy(true);
    setError("");
    setPushMessage("");
    try {
      if (currentStatus.registered) {
        const result = await disableNativePush(false);
        if (currentProfileId !== profileIdRef.current) return;
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        setPushStatus({
          ...currentStatus,
          pushEnabled: currentPreferences.pushEnabled,
          registered: false,
          lastSeenAt: null,
        });
        setPushMessage(
          text(
            "تم فصل هذا الجهاز فقط، وبقيت قناة الإشعارات في الحساب كما هي.",
            "This device was detached. The account push channel was left unchanged.",
          ),
        );
        return;
      }

      const result = await enableNativePush(language, true);
      if (currentProfileId !== profileIdRef.current) return;
      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      const enabled = result.data.permissionStatus === "granted" && result.data.registered;
      const accountPushEnabled = currentPreferences.pushEnabled || enabled;
      setPreferences({ ...currentPreferences, pushEnabled: accountPushEnabled });
      setPushStatus({
        pushEnabled: accountPushEnabled,
        registered: result.data.registered,
        permissionStatus: result.data.permissionStatus,
        platform: currentCapability.platform,
        lastSeenAt: enabled ? new Date().toISOString() : null,
      });
      setPushMessage(
        enabled
          ? text(
              "تم تسجيل هذا الجهاز وتفعيل قناة الإشعارات للحساب.",
              "This device was registered and the account push channel was enabled.",
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

  async function handleAccountPushToggle() {
    const currentProfileId = profileId;
    if (!currentProfileId || !preferences || pushBusyProfilesRef.current.has(currentProfileId)) {
      return;
    }

    const currentPreferences = preferences;
    const currentStatus = pushStatus;
    pushBusyProfilesRef.current.add(currentProfileId);
    setPushBusy(true);
    setError("");
    setPushMessage("");
    try {
      if (currentPreferences.pushEnabled) {
        const result = await disableNativePush(true);
        if (currentProfileId !== profileIdRef.current) return;
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        setPreferences({ ...currentPreferences, pushEnabled: false });
        setPushStatus({
          ...currentStatus,
          pushEnabled: false,
          registered: false,
          lastSeenAt: null,
        });
        setPushMessage(
          text(
            "تم تعطيل قناة الإشعارات على مستوى الحساب بناءً على طلبك.",
            "The account push channel was disabled as requested.",
          ),
        );
        return;
      }

      const result = await enableNativePush(language, true);
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
        platform: pushCapability.platform,
        lastSeenAt: enabled ? new Date().toISOString() : null,
      });
      setPushMessage(
        enabled
          ? text(
              "تم تفعيل قناة الحساب وتسجيل هذا الجهاز.",
              "Account push and this device are enabled.",
            )
          : text(
              "لم يمنح الهاتف إذن الإشعارات، لذلك بقيت قناة الحساب متوقفة.",
              "Permission was not granted, so the account push channel remains disabled.",
            ),
      );
    } finally {
      pushBusyProfilesRef.current.delete(currentProfileId);
      if (currentProfileId === profileIdRef.current) setPushBusy(false);
    }
  }

  if (auth.status !== "signedIn") return null;

  const accountPushEnabled = Boolean(preferences?.pushEnabled);
  const devicePushEnabled = Boolean(accountPushEnabled && pushStatus.registered);
  const controlsDisabled = pushBusy || !pushCapability.available || loading || !preferences;

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
              "تحكم بقناة الحساب بشكل مستقل عن تسجيل هذا الهاتف، ثم اختر أنواع التنبيهات التي تريدها.",
              "Control the account channel separately from this device, then choose the alerts you want.",
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3 rounded-2xl bg-muted-surface p-3 hairline">
        <PushControlRow
          icon={<BellRing className="h-4 w-4" />}
          title={text("قناة الإشعارات للحساب", "Account push channel")}
          hint={
            accountPushEnabled
              ? text(
                  "القناة مفعّلة للحساب. إيقافها إجراء صريح يوقف Push على مستوى الحساب.",
                  "The account channel is enabled. Turning it off explicitly disables account push.",
                )
              : text(
                  "القناة متوقفة ولن تُرسل إشعارات Push للحساب.",
                  "The channel is disabled and account push will not be sent.",
                )
          }
          checked={accountPushEnabled}
          disabled={controlsDisabled}
          busy={pushBusy}
          onClick={() => void handleAccountPushToggle()}
          label={text("قناة الإشعارات للحساب", "Account push channel")}
        />

        <div className="border-t border-border/70 pt-3">
          <PushControlRow
            icon={<Smartphone className="h-4 w-4" />}
            title={text("هذا الجهاز", "This device")}
            hint={
              pushCapability.available
                ? devicePushEnabled
                  ? text(
                      "هذا الجهاز مسجل ويستقبل التنبيهات.",
                      "This device is registered for push alerts.",
                    )
                  : pushStatus.permissionStatus === "denied"
                    ? text(
                        "إذن Android مرفوض من إعدادات الهاتف ولم يتم تغييره من رواج.",
                        "Android permission is blocked in system settings and was not changed by RAWAJ.",
                      )
                    : text(
                        "الجهاز غير مسجل. فصله لا يعطّل قناة الحساب.",
                        "This device is detached. Detaching it does not disable the account channel.",
                      )
                : text(
                    "إدارة الجهاز متاحة داخل تطبيق رواج على Android.",
                    "Device management is available in the RAWAJ Android app.",
                  )
            }
            checked={devicePushEnabled}
            disabled={controlsDisabled}
            busy={pushBusy}
            onClick={() => void handleDevicePushToggle()}
            label={text("تسجيل هذا الجهاز", "Register this device")}
          />
        </div>

        {pushMessage ? (
          <p className="text-[10px] font-semibold leading-5 text-muted-foreground">{pushMessage}</p>
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

function PushControlRow({
  icon,
  title,
  hint,
  checked,
  disabled,
  busy,
  onClick,
  label,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  busy: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-card text-primary hairline">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-extrabold">{title}</p>
          <p className="mt-0.5 text-[10px] leading-5 text-muted-foreground">{hint}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onClick}
        className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${
          checked ? "bg-primary" : "bg-card hairline"
        }`}
        aria-label={label}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-card shadow-soft transition-all ${
            checked ? "start-6" : "start-1"
          }`}
        />
        <span className="sr-only">{busy ? "Saving" : ""}</span>
      </button>
    </div>
  );
}
