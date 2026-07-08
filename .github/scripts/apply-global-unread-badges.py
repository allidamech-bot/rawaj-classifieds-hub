from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 anchor, found {count}")
    return text.replace(old, new, 1)

# Messaging mark-read emits a unified refresh signal.
path = Path("src/lib/api/messaging.ts")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    'import {\n  getClient,',
    'import { emitUnreadActivityChanged } from "@/lib/unread-activity-events";\nimport {\n  getClient,',
    "messaging unread event import",
)
text = replace_once(
    text,
    '''  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
}

export async function createMessageReport(
''',
    '''  if (error) return { ok: false, error: mapError(error) };
  emitUnreadActivityChanged();
  return { ok: true, data: null };
}

export async function createMessageReport(
''',
    "messaging read refresh",
)
path.write_text(text, encoding="utf-8")

# Root provider wraps all authenticated app content and BottomNav.
path = Path("src/routes/__root.tsx")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    'import { UiPreferencesProvider, useUiPreferences } from "@/lib/ui-preferences";\n',
    'import { UiPreferencesProvider, useUiPreferences } from "@/lib/ui-preferences";\nimport { UnreadActivityProvider } from "@/lib/unread-activity";\n',
    "root unread provider import",
)
text = replace_once(
    text,
    '''        <AuthProvider>
          <HtmlAttributes />
          <div
            className={`min-h-dvh bg-background text-foreground lg:pb-8 ${
              showBottomNav ? "pb-24" : "pb-6"
            }`}
          >
            {showDraftRecovery && <DraftRecoveryBanner />}
            {listingDetailId && <ViewedBeforeBanner listingId={listingDetailId} />}
            {listingDetailId && <ExistingConversationBanner listingId={listingDetailId} />}
            <Outlet />
            {showFooter && <SiteFooter />}
          </div>
          <BottomNav />
        </AuthProvider>
''',
    '''        <AuthProvider>
          <UnreadActivityProvider>
            <HtmlAttributes />
            <div
              className={`min-h-dvh bg-background text-foreground lg:pb-8 ${
                showBottomNav ? "pb-24" : "pb-6"
              }`}
            >
              {showDraftRecovery && <DraftRecoveryBanner />}
              {listingDetailId && <ViewedBeforeBanner listingId={listingDetailId} />}
              {listingDetailId && <ExistingConversationBanner listingId={listingDetailId} />}
              <Outlet />
              {showFooter && <SiteFooter />}
            </div>
            <BottomNav />
          </UnreadActivityProvider>
        </AuthProvider>
''',
    "root unread provider wrap",
)
path.write_text(text, encoding="utf-8")

# BottomNav shows one combined activity badge on Account without changing the five-item structure.
path = Path("src/components/BottomNav.tsx")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    'import { useUiPreferences } from "@/lib/ui-preferences";\n',
    'import { useUiPreferences } from "@/lib/ui-preferences";\nimport { useUnreadActivityCounts } from "@/lib/unread-activity";\n',
    "bottom nav unread hook import",
)
text = replace_once(
    text,
    '''  const { text } = useUiPreferences();
  const activeSection = resolvePrimaryNavigationSection(pathname);
''',
    '''  const { text } = useUiPreferences();
  const { counts } = useUnreadActivityCounts();
  const activeSection = resolvePrimaryNavigationSection(pathname);
''',
    "bottom nav unread state",
)
text = replace_once(
    text,
    '''          const Icon = item.icon;
          const label = text(item.labelAr, item.labelEn);
''',
    '''          const Icon = item.icon;
          const label = text(item.labelAr, item.labelEn);
          const badgeCount = item.section === "account" ? counts.total : 0;
''',
    "bottom nav badge count",
)
text = replace_once(
    text,
    '''                <Icon className="h-5 w-5" strokeWidth={active ? 2.15 : 1.75} />
              </span>
''',
    '''                <Icon className="h-5 w-5" strokeWidth={active ? 2.15 : 1.75} />
                {badgeCount > 0 && (
                  <span className="absolute -end-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[8px] font-extrabold leading-none text-white ring-2 ring-card">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </span>
''',
    "bottom nav badge render",
)
path.write_text(text, encoding="utf-8")

# My Space shows separate counts on Messages and Notifications shortcuts.
path = Path("src/routes/more.tsx")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    'import { useUiPreferences } from "@/lib/ui-preferences";\n',
    'import { useUiPreferences } from "@/lib/ui-preferences";\nimport { useUnreadActivityCounts } from "@/lib/unread-activity";\n',
    "more unread hook import",
)
text = replace_once(
    text,
    '''  const auth = useAuth();
  const { user } = auth;
''',
    '''  const auth = useAuth();
  const { counts } = useUnreadActivityCounts();
  const { user } = auth;
''',
    "more unread counts",
)
text = replace_once(
    text,
    '''            {primaryShortcuts.map((row) => (
              <PrimaryShortcut key={row.titleEn} row={row} text={text} />
            ))}
''',
    '''            {primaryShortcuts.map((row) => (
              <PrimaryShortcut
                key={row.titleEn}
                row={row}
                text={text}
                badgeCount={
                  row.to === "/chats"
                    ? counts.messages
                    : row.to === "/notifications"
                      ? counts.notifications
                      : 0
                }
              />
            ))}
''',
    "more shortcut badge wiring",
)
text = replace_once(
    text,
    '''function PrimaryShortcut({
  row,
  text,
}: {
  row: AccountRow & { world: string };
  text: (ar: string, en: string) => string;
}) {
''',
    '''function PrimaryShortcut({
  row,
  text,
  badgeCount = 0,
}: {
  row: AccountRow & { world: string };
  text: (ar: string, en: string) => string;
  badgeCount?: number;
}) {
''',
    "primary shortcut badge prop",
)
text = replace_once(
    text,
    '''      <span className="relative grid h-11 w-11 place-items-center rounded-[1rem] bg-primary text-primary-foreground shadow-soft">
        <Icon className="h-5 w-5" />
      </span>
''',
    '''      <span className="relative grid h-11 w-11 place-items-center rounded-[1rem] bg-primary text-primary-foreground shadow-soft">
        <Icon className="h-5 w-5" />
        {badgeCount > 0 && (
          <span className="absolute -end-2 -top-2 grid min-h-5 min-w-5 place-items-center rounded-full bg-destructive px-1.5 text-[9px] font-extrabold text-white ring-2 ring-card">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
      </span>
''',
    "primary shortcut badge render",
)
path.write_text(text, encoding="utf-8")

print("Applied global unread badges")
