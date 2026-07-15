import json
from pathlib import Path


def replace_once(path: str, old: str, new: str, *, required: bool = True) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if old not in text:
        if required:
            raise SystemExit(f"Expected text not found in {path}: {old[:120]!r}")
        return
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


package_path = Path("package.json")
package = json.loads(package_path.read_text(encoding="utf-8"))
package["scripts"]["test:saved-search-push"] = "node --test scripts/saved-search-push-v1.test.mjs"
check = package["scripts"]["check"]
marker = "npm run test:retention-discovery &&"
if "npm run test:saved-search-push" not in check:
    if marker not in check:
        raise SystemExit("Retention test marker missing from package check script")
    check = check.replace(marker, f"{marker} npm run test:saved-search-push &&", 1)
package["scripts"]["check"] = check
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

ledger_path = Path("docs/production-schema/migration-ledger.json")
ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
migrations = ledger["classifications"]["canonical"]
migration_name = "202607150002_saved_search_alerts_push_v1.sql"
if migration_name not in migrations:
    migrations.append(migration_name)
ledger_path.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

quality_path = Path(".github/workflows/quality-gate.yml")
quality = quality_path.read_text(encoding="utf-8")
if "Saved Search Alerts and Push V1 contract" not in quality:
    quality_marker = "      - name: Retention and Discovery V1 contract\n        run: npm run test:retention-discovery\n\n"
    if quality_marker not in quality:
        raise SystemExit("Quality Gate retention marker missing")
    quality = quality.replace(
        quality_marker,
        quality_marker
        + "      - name: Saved Search Alerts and Push V1 contract\n"
        + "        run: npm run test:saved-search-push\n\n",
        1,
    )
quality_path.write_text(quality, encoding="utf-8")

notifications_path = Path("src/routes/notifications.tsx")
notifications = notifications_path.read_text(encoding="utf-8")
if 'target.kind === "saved_search"' not in notifications:
    old = (
        '      } else if (target.kind === "seller") {\n'
        '        void navigate({ to: "/seller/$id", params: { id: target.sellerId } });\n'
        '      } else if (target.kind === "browse_listings") {'
    )
    new = (
        '      } else if (target.kind === "seller") {\n'
        '        void navigate({ to: "/seller/$id", params: { id: target.sellerId } });\n'
        '      } else if (target.kind === "saved_search") {\n'
        '        void navigate({ to: "/saved-searches" });\n'
        '      } else if (target.kind === "browse_listings") {'
    )
    if old not in notifications:
        raise SystemExit("Notification target navigation marker missing")
    notifications = notifications.replace(old, new, 1)
if 'target === "saved_search"' not in notifications:
    old = '    (target === "listing" || target === "conversation" || target === "seller"),'
    new = (
        '    (target === "listing" ||\n'
        '      target === "conversation" ||\n'
        '      target === "seller" ||\n'
        '      target === "saved_search"),'
    )
    if old not in notifications:
        raise SystemExit("Navigable notification marker missing")
    notifications = notifications.replace(old, new, 1)
notifications_path.write_text(notifications, encoding="utf-8")

more_path = Path("src/routes/more.tsx")
more = more_path.read_text(encoding="utf-8")
if 'from "@/lib/native-push"' not in more:
    import_marker = 'import { TrustHubHero, TrustSectionHeader } from "@/features/trust/TrustSupportExperience";\n'
    if import_marker not in more:
        raise SystemExit("More route import marker missing")
    more = more.replace(
        import_marker,
        import_marker + 'import { disableNativePush } from "@/lib/native-push";\n',
        1,
    )
if "await disableNativePush(auth.profile.id, false)" not in more:
    logout_marker = "    try {\n      const result = await auth.signOut();"
    replacement = (
        "    try {\n"
        "      if (auth.profile?.id) {\n"
        "        await disableNativePush(auth.profile.id, false).catch(() => undefined);\n"
        "      }\n"
        "      const result = await auth.signOut();"
    )
    if logout_marker not in more:
        raise SystemExit("Logout marker missing")
    more = more.replace(logout_marker, replacement, 1)
more_path.write_text(more, encoding="utf-8")

saved_search_path = Path("src/routes/saved-searches.tsx")
saved_search = saved_search_path.read_text(encoding="utf-8")
saved_search = saved_search.replace(
    "أنشئ بحثاً باسم واضح واضبط تكرار تنبيه حقيقي داخل رواج. يتم الفحص بشكل محدود عند استخدامك لرواج، مع منع تكرار نفس الإعلان.",
    "أنشئ بحثاً باسم واضح واضبط تكرار التنبيه. يطابق الخادم الإعلانات الجديدة عند اعتمادها ويجمع النتائج دون تكرار.",
)
saved_search = saved_search.replace(
    "Create a clearly named search and set a real in-app alert cadence. RAWAJ runs bounded checks while you use the app and deduplicates the same listing.",
    "Create a clearly named search and choose an alert cadence. The server matches newly approved listings and aggregates results without duplicates.",
)
saved_search_path.write_text(saved_search, encoding="utf-8")

Path("capacitor.config.ts").write_text(
    '''/// <reference types="@capacitor/push-notifications" />

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.rawaj.marketplace",
  appName: "RAWAJ",
  webDir: ".output/public",
  server: {
    url: "https://rawa-j.com",
    cleartext: false,
    allowNavigation: ["rawa-j.com", "*.rawa-j.com"],
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["sound", "alert"],
    },
  },
};

export default config;
''',
    encoding="utf-8",
)

native_path = Path("src/lib/native-push.ts")
native = native_path.read_text(encoding="utf-8")
if "PushNotifications.createChannel" not in native:
    marker = "    await ensureNativePushListeners(userId);\n    const tokenResult"
    replacement = (
        '    if (capability.platform === "android") {\n'
        "      await PushNotifications.createChannel({\n"
        '        id: "rawaj_activity",\n'
        '        name: "تنبيهات رواج",\n'
        '        description: "الرسائل ونتائج البحث وتحديثات الحساب",\n'
        "        importance: 4,\n"
        "        vibration: true,\n"
        "      });\n"
        "    }\n\n"
        "    await ensureNativePushListeners(userId);\n"
        "    const tokenResult"
    )
    if marker not in native:
        raise SystemExit("Native channel marker missing")
    native = native.replace(marker, replacement, 1)

disable_start = native.index("export async function disableNativePush(")
disable_end = native.index("export async function initializeNativePush", disable_start)
if disable_start < 0 or disable_end < 0:
    raise SystemExit("Native disable function markers missing")
native_disable = '''export async function disableNativePush(
  userId: string | null,
  disableChannel = true,
): Promise<ClassifiedsResult<boolean>> {
  const deviceKey = getOrCreatePushDeviceKey();
  const result = await disablePushDevice(userId, deviceKey, disableChannel);
  if (result.ok) {
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      await PushNotifications.unregister();
    } catch {
      // Database unlink remains authoritative when the native plugin is unavailable.
    }
    await clearNativePushListeners();
  }
  return result;
}

'''
native = native[:disable_start] + native_disable + native[disable_end:]

function_start = native.index("async function waitForRegistrationToken(")
function_end = native.index("async function ensureNativePushListeners", function_start)
if function_start < 0 or function_end < 0:
    raise SystemExit("Native registration function markers missing")
native_registration = '''async function waitForRegistrationToken(
  PushNotifications: typeof import("@capacitor/push-notifications").PushNotifications,
): Promise<ClassifiedsResult<string>> {
  let registrationHandle: PluginListenerHandle | null = null;
  let errorHandle: PluginListenerHandle | null = null;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  return new Promise<ClassifiedsResult<string>>((resolve) => {
    let finished = false;
    const finish = (result: ClassifiedsResult<string>) => {
      if (finished) return;
      finished = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      void registrationHandle?.remove();
      void errorHandle?.remove();
      resolve(result);
    };

    void (async () => {
      registrationHandle = await PushNotifications.addListener("registration", (token) => {
        const value = token.value?.trim();
        if (!value) {
          finish({
            ok: false,
            error: { code: "unknown", message: "لم يُرجع الهاتف رمز الإشعارات." },
          });
          return;
        }
        finish({ ok: true, data: value });
      });

      errorHandle = await PushNotifications.addListener("registrationError", (error) => {
        finish({
          ok: false,
          error: {
            code: "unknown",
            message: "فشل تسجيل الهاتف للإشعارات الفورية.",
            details: JSON.stringify(error),
          },
        });
      });

      timeoutHandle = setTimeout(() => {
        finish({
          ok: false,
          error: { code: "unknown", message: "انتهت مهلة تسجيل الإشعارات على الهاتف." },
        });
      }, REGISTRATION_TIMEOUT_MS);

      await PushNotifications.register();
    })().catch((error) => {
      finish({
        ok: false,
        error: {
          code: "unknown",
          message: "فشل بدء تسجيل الإشعارات الفورية.",
          details: error instanceof Error ? error.message : String(error),
        },
      });
    });
  });
}

'''
native = native[:function_start] + native_registration + native[function_end:]
native_path.write_text(native, encoding="utf-8")

migration_path = Path("supabase/migrations/202607150002_saved_search_alerts_push_v1.sql")
migration = migration_path.read_text(encoding="utf-8")
if "      search.created_at,\n      search.last_alert_checked_at," not in migration:
    migration = migration.replace(
        "      search.alert_frequency,\n      search.last_alert_checked_at,",
        "      search.alert_frequency,\n      search.created_at,\n      search.last_alert_checked_at,",
        1,
    )
if "search.created_at, search.last_alert_checked_at" not in migration:
    migration = migration.replace(
        "    group by search.id, search.name_ar, search.alert_frequency, search.last_alert_checked_at",
        "    group by search.id, search.name_ar, search.alert_frequency, search.created_at, search.last_alert_checked_at",
        1,
    )
migration = migration.replace(
    "         (v_search.alert_frequency = 'daily' and v_search.last_alert_checked_at > v_now - interval '1 day')\n"
    "         or (v_search.alert_frequency = 'weekly' and v_search.last_alert_checked_at > v_now - interval '7 days')",
    "         (v_search.alert_frequency = 'daily' and coalesce(v_search.last_alert_checked_at, v_search.created_at) > v_now - interval '1 day')\n"
    "         or (v_search.alert_frequency = 'weekly' and coalesce(v_search.last_alert_checked_at, v_search.created_at) > v_now - interval '7 days')",
    1,
)
if "'title_en', 'New saved-search results'" not in migration:
    migration = migration.replace(
        "        'latest_listing_id', v_search.latest_listing_id\n      )",
        "        'latest_listing_id', v_search.latest_listing_id,\n"
        "        'title_en', 'New saved-search results',\n"
        "        'body_en', v_search.pending_count::text || ' new listings match \"' || v_search.name_ar || '\"'\n"
        "      )",
        1,
    )
if "  notification_type text,\n  device_id uuid," not in migration:
    migration = migration.replace(
        "  notification_id uuid,\n  device_id uuid,",
        "  notification_id uuid,\n  notification_type text,\n  device_id uuid,",
        1,
    )
if "    notification.type,\n    claimed.device_id," not in migration:
    migration = migration.replace(
        "    claimed.notification_id,\n    claimed.device_id,",
        "    claimed.notification_id,\n    notification.type,\n    claimed.device_id,",
        1,
    )
migration_path.write_text(migration, encoding="utf-8")

edge_path = Path("supabase/functions/send-push-notifications/index.ts")
edge = edge_path.read_text(encoding="utf-8")
if "  notification_type: string;\n  device_id: string;" not in edge:
    edge = edge.replace(
        "  notification_id: string;\n  device_id: string;",
        "  notification_id: string;\n  notification_type: string;\n  device_id: string;",
        1,
    )
edge = edge.replace(
    '              body: delivery.body_ar || "لديك تحديث جديد في رواج",',
    "              body: safePushBody(delivery),",
    1,
)
if "function safePushBody" not in edge:
    marker = "function isPermanentTokenError(status: number, body: string): boolean {"
    safe_body = '''function safePushBody(delivery: PushDelivery): string {
  const type = delivery.notification_type.toLowerCase();
  if (type.includes("message") || type.includes("conversation")) {
    return "لديك رسالة جديدة على رواج";
  }
  if (type === "saved_search_match") return "توجد نتائج جديدة تطابق أحد بحوثك المحفوظة";
  if (type.includes("price")) return "تغيّر سعر إعلان تتابعه على رواج";
  if (type.includes("review")) return "لديك تحديث جديد متعلق بالتقييمات";
  if (type.includes("promotion")) return "لديك تحديث جديد متعلق بالترويج";
  if (type.includes("listing") || type === "approved" || type === "rejected" || type === "expired") {
    return "لديك تحديث جديد على أحد إعلاناتك";
  }
  return "لديك تحديث جديد في رواج";
}

'''
    if marker not in edge:
        raise SystemExit("FCM permanent-error marker missing")
    edge = edge.replace(marker, safe_body + marker, 1)
edge_path.write_text(edge, encoding="utf-8")
