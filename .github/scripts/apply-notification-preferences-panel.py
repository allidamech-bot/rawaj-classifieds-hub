from pathlib import Path

path = Path("src/routes/notifications.tsx")
text = path.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one anchor, found {count}")
    text = text.replace(old, new, 1)


replace_once(
    'import { PageHeader } from "@/components/PageHeader";\n',
    'import { PageHeader } from "@/components/PageHeader";\n'
    'import { NotificationPreferencesPanel } from "@/features/notifications/NotificationPreferencesPanel";\n',
    "preferences panel import",
)

replace_once(
    '''        <section className="rounded-2xl bg-card p-4 hairline">
          <h2 className="text-sm font-extrabold">{text("متابعة سريعة", "Quick follow-up")}</h2>
''',
    '''        <NotificationPreferencesPanel />

        <section className="rounded-2xl bg-card p-4 hairline">
          <h2 className="text-sm font-extrabold">{text("متابعة سريعة", "Quick follow-up")}</h2>
''',
    "preferences panel placement",
)

path.write_text(text, encoding="utf-8")
print("Applied notification preferences panel")
