import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  const first = source.indexOf(from);
  const last = source.lastIndexOf(from);
  if (first === -1 || first !== last) {
    throw new Error(`${label}: expected exactly one source match`);
  }
  return source.slice(0, first) + to + source.slice(first + from.length);
}

function replacePattern(source, pattern, to, label) {
  if (source.includes(to)) return source;
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const matches = [...source.matchAll(new RegExp(pattern.source, flags))];
  if (matches.length !== 1) {
    throw new Error(`${label}: expected exactly one regex match, found ${matches.length}`);
  }
  return source.replace(pattern, to);
}

function updateNotificationsRoute() {
  const path = "src/routes/notifications.tsx";
  let source = readFileSync(path, "utf8");

  source = replaceOnce(
    source,
    `const NOTIFICATIONS_PAGE_SIZE = 20;`,
    `const NOTIFICATIONS_PAGE_SIZE = 20;\n\nfunction notificationActionScope(profileId: string, notificationId: string) {\n  return [profileId, notificationId].join(":");\n}`,
    "notification action scope helper",
  );

  source = replaceOnce(
    source,
    `  const markAllReadAtRef = useRef<string | null>(null);\n  const loadedProfileIdRef = useRef<string | null>(null);`,
    `  const markAllReadAtRef = useRef<string | null>(null);\n  const loadedProfileIdRef = useRef<string | null>(null);\n  const profileIdRef = useRef<string | null>(profileId);\n  const markingReadScopesRef = useRef<Set<string>>(new Set());\n  const openingTargetScopesRef = useRef<Set<string>>(new Set());\n  const markingAllProfilesRef = useRef<Set<string>>(new Set());\n  profileIdRef.current = profileId;`,
    "notification action refs",
  );

  source = source.replaceAll("currentProfileId !== profileId", "currentProfileId !== profileIdRef.current");
  source = source.replaceAll(
    "currentProfileId !== auth.profile?.id",
    "currentProfileId !== profileIdRef.current",
  );

  source = replacePattern(
    source,
    /  async function markOne\(notificationId: string\) \{[\s\S]*?\n  \}\n\n  async function markAll/,
    `  async function markOne(notificationId: string) {\n    const currentProfileId = profileId;\n    if (!currentProfileId) return false;\n    const scopeKey = notificationActionScope(currentProfileId, notificationId);\n    if (markingReadScopesRef.current.has(scopeKey)) return false;\n\n    const wasUnread = notifications.some((item) => item.id === notificationId && !item.readAt);\n    markingReadScopesRef.current.add(scopeKey);\n    setMarkingReadIds((current) => new Set(current).add(notificationId));\n    setActionMessage(null);\n    try {\n      const result = await markNotificationRead(currentProfileId, notificationId);\n      if (currentProfileId !== profileIdRef.current) return false;\n      if (!result.ok) {\n        setActionMessage(result.error.message);\n        return false;\n      }\n      readNotificationIdsRef.current.add(notificationId);\n      const readAt = new Date().toISOString();\n      setNotifications((current) =>\n        current.map((item) => (item.id === notificationId ? { ...item, readAt } : item)),\n      );\n      if (wasUnread) setUnreadTotal((current) => Math.max(0, current - 1));\n      void refreshUnreadActivity();\n      return true;\n    } finally {\n      markingReadScopesRef.current.delete(scopeKey);\n      if (currentProfileId === profileIdRef.current) {\n        setMarkingReadIds((current) => {\n          const next = new Set(current);\n          next.delete(notificationId);\n          return next;\n        });\n      }\n    }\n  }\n\n  async function markAll`,
    "account-scoped mark one",
  );

  source = replacePattern(
    source,
    /  async function markAll\(\) \{[\s\S]*?\n  \}\n\n  async function openNotificationTarget/,
    `  async function markAll() {\n    const currentProfileId = profileId;\n    if (!currentProfileId || markingAllProfilesRef.current.has(currentProfileId)) return;\n\n    markingAllProfilesRef.current.add(currentProfileId);\n    setMarkingAll(true);\n    setActionMessage(null);\n    try {\n      const result = await markAllNotificationsRead(currentProfileId);\n      if (currentProfileId !== profileIdRef.current) return;\n      if (!result.ok) {\n        setActionMessage(result.error.message);\n        return;\n      }\n      const readAt = new Date().toISOString();\n      markAllReadAtRef.current = readAt;\n      notifications.forEach((item) => readNotificationIdsRef.current.add(item.id));\n      setNotifications((current) => current.map((item) => ({ ...item, readAt })));\n      setUnreadTotal(0);\n      setUnreadCountExact(true);\n      void refreshUnreadActivity();\n    } finally {\n      markingAllProfilesRef.current.delete(currentProfileId);\n      if (currentProfileId === profileIdRef.current) setMarkingAll(false);\n    }\n  }\n\n  async function openNotificationTarget`,
    "account-scoped mark all",
  );

  source = replacePattern(
    source,
    /  async function openNotificationTarget\(notification: NotificationItem\) \{[\s\S]*?\n  \}\n\n  const hasUnreadEvidence/,
    `  async function openNotificationTarget(notification: NotificationItem) {\n    const currentProfileId = profileId;\n    if (!currentProfileId) return;\n    const scopeKey = notificationActionScope(currentProfileId, notification.id);\n    if (openingTargetScopesRef.current.has(scopeKey)) return;\n\n    openingTargetScopesRef.current.add(scopeKey);\n    setOpeningTargetIds((current) => new Set(current).add(notification.id));\n    setActionMessage(null);\n    try {\n      const result = await resolveNotificationTarget(currentProfileId, notification);\n      if (currentProfileId !== profileIdRef.current) return;\n      if (!result.ok) {\n        setActionMessage(result.error.message);\n        return;\n      }\n      const target = result.data;\n      if (!target) {\n        if (!notification.readAt) {\n          await markOne(notification.id);\n          if (currentProfileId !== profileIdRef.current) return;\n        }\n        setActionMessage(\n          text(\n            "لم يعد الهدف المرتبط بهذا التنبيه متاحًا.",\n            "The item linked to this notification is no longer available.",\n          ),\n        );\n        return;\n      }\n      if (!notification.readAt) {\n        await markOne(notification.id);\n        if (currentProfileId !== profileIdRef.current) return;\n      }\n      if (target.kind === "listing") {\n        void navigate({ to: "/listings/$id", params: { id: target.listingId } });\n      } else if (target.kind === "conversation" || target.kind === "conversation_missing") {\n        void navigate({ to: "/chats", search: { conversation: target.conversationId } });\n      } else if (target.kind === "seller") {\n        void navigate({ to: "/seller/$id", params: { id: target.sellerId } });\n      } else if (target.kind === "saved_search") {\n        void navigate({\n          to: "/saved-searches",\n          search: {\n            q: "",\n            category: "",\n            subcategory: "",\n            gov: "",\n            district: "",\n            price_min: "",\n            price_max: "",\n            car_make: "",\n            car_model: "",\n            fuel: "",\n            transmission: "",\n            property_purpose: "",\n            property_type: "",\n            rooms: "",\n            rental_duration: "",\n            electronics_brand: "",\n            detail_condition: "",\n            employment_type: "",\n            salary_type: "",\n            sort: "latest",\n          },\n        });\n      } else if (target.kind === "browse_listings") {\n        void navigate({ to: "/listings" });\n      }\n    } finally {\n      openingTargetScopesRef.current.delete(scopeKey);\n      if (currentProfileId === profileIdRef.current) {\n        setOpeningTargetIds((current) => {\n          const next = new Set(current);\n          next.delete(notification.id);\n          return next;\n        });\n      }\n    }\n  }\n\n  const hasUnreadEvidence`,
    "account-scoped target opening",
  );

  writeFileSync(path, source);
}

function updatePreferencesPanel() {
  const path = "src/features/notifications/NotificationPreferencesPanel.tsx";
  let source = readFileSync(path, "utf8");

  source = replaceOnce(
    source,
    `  const requestIdRef = useRef(0);\n  const profileId = auth.profile?.id ?? null;`,
    `  const requestIdRef = useRef(0);\n  const profileId = auth.profile?.id ?? null;\n  const profileIdRef = useRef<string | null>(profileId);\n  const savingPreferenceProfilesRef = useRef<Set<string>>(new Set());\n  const pushBusyProfilesRef = useRef<Set<string>>(new Set());\n  profileIdRef.current = profileId;`,
    "notification preferences refs",
  );

  source = replaceOnce(
    source,
    `      setPreferences(null);\n      setPushStatus(EMPTY_PUSH_STATUS);\n      setLoading(false);\n      return;`,
    `      setPreferences(null);\n      setPushCapability({ available: false, platform: "web" });\n      setPushStatus(EMPTY_PUSH_STATUS);\n      setLoading(false);\n      setSavingKey(null);\n      setPushBusy(false);\n      setError("");\n      setPushMessage("");\n      return;`,
    "signed-out preferences reset",
  );

  source = source.replaceAll(
    "if (requestId !== requestIdRef.current) return;",
    "if (requestId !== requestIdRef.current || profileId !== profileIdRef.current) return;",
  );

  source = replacePattern(
    source,
    /  async function handleToggle\(key: NotificationPreferenceKey\) \{[\s\S]*?\n  \}\n\n  async function handlePushToggle/,
    `  async function handleToggle(key: NotificationPreferenceKey) {\n    const currentProfileId = profileId;\n    if (\n      !currentProfileId ||\n      !preferences ||\n      savingPreferenceProfilesRef.current.has(currentProfileId)\n    )\n      return;\n\n    const nextEnabled = !preferences[key];\n    const previous = preferences;\n    savingPreferenceProfilesRef.current.add(currentProfileId);\n    setPreferences({ ...preferences, [key]: nextEnabled });\n    setSavingKey(key);\n    setError("");\n    try {\n      const result = await updateNotificationPreference(currentProfileId, key, nextEnabled);\n      if (currentProfileId !== profileIdRef.current) return;\n      if (!result.ok) {\n        setPreferences(previous);\n        setError(result.error.message);\n        return;\n      }\n      setPreferences(result.data);\n    } finally {\n      savingPreferenceProfilesRef.current.delete(currentProfileId);\n      if (currentProfileId === profileIdRef.current) setSavingKey(null);\n    }\n  }\n\n  async function handlePushToggle`,
    "account-scoped preference toggle",
  );

  source = replacePattern(
    source,
    /  async function handlePushToggle\(\) \{[\s\S]*?\n  \}\n\n  if \(auth\.status !== "signedIn"\)/,
    `  async function handlePushToggle() {\n    const currentProfileId = profileId;\n    if (!currentProfileId || !preferences || pushBusyProfilesRef.current.has(currentProfileId))\n      return;\n\n    const currentPreferences = preferences;\n    const currentCapability = pushCapability;\n    pushBusyProfilesRef.current.add(currentProfileId);\n    setPushBusy(true);\n    setError("");\n    setPushMessage("");\n    try {\n      if (currentPreferences.pushEnabled || pushStatus.registered) {\n        const result = await disableNativePush(currentProfileId);\n        if (currentProfileId !== profileIdRef.current) return;\n        if (!result.ok) {\n          setError(result.error.message);\n          return;\n        }\n        setPreferences({ ...currentPreferences, pushEnabled: false });\n        setPushStatus({ ...EMPTY_PUSH_STATUS, platform: currentCapability.platform });\n        setPushMessage(\n          text(\n            "تم إيقاف الإشعارات الفورية على هذا الجهاز.",\n            "Push notifications were disabled on this device.",\n          ),\n        );\n        return;\n      }\n\n      const result = await enableNativePush(currentProfileId, language, true);\n      if (currentProfileId !== profileIdRef.current) return;\n      if (!result.ok) {\n        setError(result.error.message);\n        return;\n      }\n\n      const enabled = result.data.permissionStatus === "granted" && result.data.registered;\n      setPreferences({ ...currentPreferences, pushEnabled: enabled });\n      setPushStatus({\n        pushEnabled: enabled,\n        registered: result.data.registered,\n        permissionStatus: result.data.permissionStatus,\n        platform: currentCapability.platform,\n        lastSeenAt: enabled ? new Date().toISOString() : null,\n      });\n      setPushMessage(\n        enabled\n          ? text(\n              "تم تفعيل الإشعارات الفورية على هذا الجهاز.",\n              "Push notifications are enabled on this device.",\n            )\n          : text(\n              "لم يمنح الهاتف إذن الإشعارات. يمكنك تفعيله من إعدادات النظام.",\n              "Notification permission was not granted. You can enable it in system settings.",\n            ),\n      );\n    } finally {\n      pushBusyProfilesRef.current.delete(currentProfileId);\n      if (currentProfileId === profileIdRef.current) setPushBusy(false);\n    }\n  }\n\n  if (auth.status !== "signedIn")`,
    "account-scoped push toggle",
  );

  writeFileSync(path, source);
}

function updatePackage() {
  const path = "package.json";
  const packageJson = JSON.parse(readFileSync(path, "utf8"));
  const testFile = "scripts/notification-account-action-isolation.test.mjs";
  if (!packageJson.scripts["test:activity-center"].includes(testFile)) {
    packageJson.scripts["test:activity-center"] += ` ${testFile}`;
  }
  writeFileSync(path, `${JSON.stringify(packageJson, null, 2)}\n`);
}

updateNotificationsRoute();
updatePreferencesPanel();
updatePackage();
console.log("Notification account and action isolation applied.");
