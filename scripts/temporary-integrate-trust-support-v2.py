from pathlib import Path


def replace_exact(value: str, old: str, new: str, label: str) -> str:
    if old not in value:
        raise RuntimeError(f"Missing {label}")
    return value.replace(old, new, 1)


# Root stylesheet.
p = Path("src/routes/__root.tsx")
s = p.read_text()
s = replace_exact(
    s,
    'import activityMoreFoundationCss from "../activity-more-foundation.css?url";',
    'import activityMoreFoundationCss from "../activity-more-foundation.css?url";\nimport trustSupportHubV2Css from "../trust-support-hub-v2.css?url";',
    "trust css import",
)
s = replace_exact(
    s,
    '        { rel: "stylesheet", href: activityMoreFoundationCss },',
    '        { rel: "stylesheet", href: activityMoreFoundationCss },\n        { rel: "stylesheet", href: trustSupportHubV2Css },',
    "trust css link",
)
p.write_text(s)

# More hub.
p = Path("src/routes/more.tsx")
s = p.read_text()
s = replace_exact(
    s,
    'import { AppHeader } from "@/components/AppHeader";',
    '''import { AppHeader } from "@/components/AppHeader";
import {
  TrustHubHero,
  TrustSectionHeader,
} from "@/features/trust/TrustSupportExperience";''',
    "more trust imports",
)
s = replace_exact(
    s,
    '<div className="min-h-dvh">',
    '<div className="rawaj-trust-v2 rawaj-more-v2 min-h-dvh">',
    "more root",
)
s = replace_exact(
    s,
    '<main className="container-wide mobile-page-bottom space-y-5 pb-8 pt-3 sm:pt-5">',
    '<main className="container-wide mobile-page-bottom pb-8 pt-3 sm:pt-5">',
    "more main",
)
hero_start = s.index('        <section className="rawaj-id-card')
command_start = s.index('        <section className="mt-7">', hero_start)
hero = '''        <TrustHubHero
          mode="more"
          displayName={displayName}
          location={profile?.cityArea || profile?.governorate || undefined}
          avatarUrl={profile?.avatarUrl}
          signedIn={Boolean(user)}
          verified={profile?.verificationStatus === "verified"}
          unreadActivity={unreadTotal}
        />

'''
s = s[:hero_start] + hero + s[command_start:]
s = replace_exact(
    s,
    '<section className="mt-7">',
    '<section className="rawaj-more-v2__command">',
    "more command",
)
heading_start = s.index('          <div className="rawaj-storefront-section mb-3">')
heading_end = (
    s.index(
        '          </div>\n          <div className="grid grid-cols-2 gap-3">',
        heading_start,
    )
    + len('          </div>')
)
heading = '''          <TrustSectionHeader
            eyebrow={text("الاختصارات", "Shortcuts")}
            title={text("مركز العمليات", "Command center")}
            description={text(
              "وصول سريع إلى الإعلانات والرسائل والتنبيهات.",
              "Quick access to listings, messages, and notifications.",
            )}
          />'''
s = s[:heading_start] + heading + s[heading_end:]
s = s.replace(
    '<div className="grid grid-cols-2 gap-3">',
    '<div className="rawaj-more-v2__command">',
    1,
)
s = s.replace(
    '<section className="grid grid-cols-3 gap-2.5">',
    '<section className="rawaj-more-v2__secondary">',
    1,
)
s = s.replace(
    '<div className="space-y-3">',
    '<div className="rawaj-more-v2__sections">',
    1,
)
s = s.replace(
    'className={`rawaj-color-card rounded-[1.35rem] p-3 ${quiet ? "rawaj-world-gold" : "rawaj-world-indigo"}`}',
    'className="rawaj-account-section" data-tone={quiet ? "muted" : "default"}',
    1,
)
p.write_text(s)

# Support.
p = Path("src/routes/support.tsx")
s = p.read_text()
s = replace_exact(
    s,
    'import { PageHeader } from "@/components/PageHeader";',
    '''import { PageHeader } from "@/components/PageHeader";
import {
  SupportRequestTimeline,
  TrustHubHero,
  TrustSectionHeader,
} from "@/features/trust/TrustSupportExperience";''',
    "support trust imports",
)
s = replace_exact(
    s,
    '<main className="container-wide mobile-page-bottom space-y-5 pt-4">',
    '<main className="rawaj-trust-v2 rawaj-support-v2 container-wide mobile-page-bottom space-y-5 pb-8 pt-4">',
    "support main",
)
hero_start = s.index('        <section className="rounded-2xl bg-primary')
form_start = s.index(
    '        <section className="rounded-2xl bg-card p-4 hairline">', hero_start
)
hero = '''        <TrustHubHero
          mode="support"
          signedIn={auth.status === "signedIn"}
          displayName={auth.profile?.displayName}
          location={auth.profile?.cityArea || auth.profile?.governorate || undefined}
          avatarUrl={auth.profile?.avatarUrl}
          verified={auth.profile?.verificationStatus === "verified"}
        />
        <div className="rawaj-support-v2__layout">
          <div className="rawaj-support-v2__main">
'''
s = s[:hero_start] + hero + s[form_start:]
s = replace_exact(
    s,
    '<section className="rounded-2xl bg-card p-4 hairline">',
    '<section className="rawaj-support-panel">',
    "support form panel",
)
s = replace_exact(
    s,
    '''          <h3 className="text-sm font-extrabold">
            {text("إرسال طلب دعم حقيقي", "Submit a real support request")}
          </h3>''',
    '''          <TrustSectionHeader
            eyebrow={text("طلب جديد", "New request")}
            title={text("إرسال طلب دعم محفوظ", "Submit a stored support request")}
            description={text(
              "اكتب الموضوع والتفاصيل واربط الطلب بإعلان عند الحاجة.",
              "Describe the issue and link the request to a listing when relevant.",
            )}
          />''',
    "support form heading",
)
s = s.replace('className="mt-3 space-y-3"', "", 1)
s = s.replace(
    'className="mt-1 w-full rounded-xl bg-muted-surface px-3 py-2 text-sm outline-none hairline"',
    "",
    4,
)
s = s.replace(
    'className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-60"',
    "",
    1,
)
s = s.replace(
    'className="rounded-xl bg-muted-surface p-3 text-center text-xs font-semibold text-foreground"',
    'className="rawaj-support-notice"',
    1,
)
requests_start = s.index('        {auth.status === "signedIn" && (')
help_start = s.index(
    '        <section>\n          <h3 className="mb-3 text-sm font-extrabold">{text("مواضيع المساعدة"',
    requests_start,
)
requests = '''        {auth.status === "signedIn" ? (
          <section className="rawaj-support-requests">
            <TrustSectionHeader
              eyebrow={text("المتابعة", "Tracking")}
              title={text("طلباتي", "My requests")}
              description={text(
                "آخر طلبات الدعم المحفوظة وحالة مراجعتها.",
                "Your latest stored support requests and review status.",
              )}
            />
            {requestsError ? (
              <p className="rawaj-support-notice">{requestsError.message}</p>
            ) : (
              <SupportRequestTimeline requests={requests} language={language} />
            )}
          </section>
        ) : null}

'''
s = s[:requests_start] + requests + s[help_start:]
s = s.replace(
    '<section>\n          <h3 className="mb-3 text-sm font-extrabold">{text("مواضيع المساعدة", "Help topics")}</h3>',
    '<section className="rawaj-support-topics">\n          <TrustSectionHeader eyebrow={text("الإرشاد", "Guidance")} title={text("مواضيع المساعدة", "Help topics")} />',
    1,
)
s = s.replace(
    '<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">',
    '<div className="rawaj-support-topic-grid">',
    1,
)
s = s.replace(
    '<article key={topic.en} className="rounded-2xl bg-card p-4 hairline">',
    '<article key={topic.en} className="rawaj-support-topic">',
    1,
)
s = s.replace(
    '<section className="rounded-2xl bg-card p-4 hairline">',
    '<section className="rawaj-support-topics">',
    1,
)
s = s.replace(
    '<section className="rounded-2xl bg-warning/10 p-4 text-xs leading-6 hairline">',
    '<section className="rawaj-support-notice">',
    1,
)
s = s.replace(
    '<section>\n          <h3 className="mb-3 text-sm font-extrabold">{text("الأسئلة الشائعة", "FAQ")}</h3>',
    '<section className="rawaj-support-faq">\n          <TrustSectionHeader eyebrow={text("الأسئلة", "Questions")} title={text("الأسئلة الشائعة", "FAQ")} />',
    1,
)
s = s.replace(
    '<div className="overflow-hidden rounded-2xl bg-card hairline">',
    '<div>',
    1,
)
actions_start = s.index('        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">')
insert = '''          </div>
          <aside className="rawaj-support-v2__aside">
            <section className="rawaj-support-topics">
              <TrustSectionHeader
                eyebrow={text("قبل الإرسال", "Before submitting")}
                title={text("معلومات تساعد فريق الدعم", "Details that help support")}
              />
              <div className="rawaj-support-topic-grid">
                <SupportDetail label={text("رابط الإعلان أو رقمه عند وجوده", "Listing link or ID when relevant")} />
                <SupportDetail label={text("وصف مختصر للمشكلة", "Short issue description")} />
                <SupportDetail label={text("وقت حدوث المشكلة", "When the issue happened")} />
                <SupportDetail label={text("وسيلة تواصل للرد", "Contact method for reply")} />
              </div>
            </section>
          </aside>
        </div>

'''
s = s[:actions_start] + insert + s[actions_start:]
details_start = s.find(
    '        <section className="rawaj-support-topics">\n          <h3 className="text-sm font-extrabold">\n            {text("معلومات تساعد فريق الدعم"'
)
if details_start >= 0:
    warning_start = s.index(
        '        <section className="rawaj-support-notice">', details_start
    )
    s = s[:details_start] + s[warning_start:]
s = s.replace(
    '<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">',
    '<div className="rawaj-safety-actions">',
    1,
)
p.write_text(s)

# Safety.
p = Path("src/routes/safety.tsx")
s = p.read_text()
s = replace_exact(
    s,
    'import { ShieldAlert, ShoppingCart, Store, CreditCard, Flag } from "lucide-react";',
    'import { ShoppingCart, Store, CreditCard, Flag } from "lucide-react";',
    "safety icons",
)
s = replace_exact(
    s,
    'import { PageHeader } from "@/components/PageHeader";',
    '''import { PageHeader } from "@/components/PageHeader";
import {
  SafetyGuideCard,
  TrustHubHero,
} from "@/features/trust/TrustSupportExperience";''',
    "safety trust imports",
)
s = replace_exact(
    s,
    '<main className="container-wide mobile-page-bottom space-y-4 pt-4">',
    '<main className="rawaj-trust-v2 rawaj-safety-v2 container-wide mobile-page-bottom space-y-4 pb-8 pt-4">',
    "safety main",
)
hero_start = s.index('        <section className="rounded-2xl bg-primary')
map_start = s.index('        {sections.map((s) => (', hero_start)
hero = '''        <TrustHubHero mode="safety" />
        <div className="rawaj-safety-guide-grid">
'''
s = s[:hero_start] + hero + s[map_start:]
map_end = s.index('        ))}', map_start) + len('        ))}')
map_replacement = '''        {sections.map((section) => (
          <SafetyGuideCard
            key={section.title}
            icon={section.icon}
            title={safetyText(section.title, language)}
            items={section.items.map((item) => safetyText(item, language))}
            warning={section.tone === "warn"}
          />
        ))}
        </div>'''
s = s[:map_start] + map_replacement + s[map_end:]
s = s.replace(
    '<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">',
    '<div className="rawaj-safety-actions">',
    1,
)
p.write_text(s)
