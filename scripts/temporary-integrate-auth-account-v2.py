from pathlib import Path


def replace_exact(value: str, old: str, new: str, label: str) -> str:
    if old not in value:
        raise RuntimeError(f"Missing {label}")
    return value.replace(old, new, 1)


# Root stylesheet ordering.
p = Path("src/routes/__root.tsx")
s = p.read_text()
s = replace_exact(
    s,
    'import authAccountFoundationCss from "../auth-account-foundation.css?url";',
    'import authAccountFoundationCss from "../auth-account-foundation.css?url";\nimport authAccountV2Css from "../auth-account-v2.css?url";',
    "root auth account import",
)
s = replace_exact(
    s,
    '        { rel: "stylesheet", href: authAccountFoundationCss },',
    '        { rel: "stylesheet", href: authAccountFoundationCss },\n        { rel: "stylesheet", href: authAccountV2Css },',
    "root auth account link",
)
p.write_text(s)

# Login route.
p = Path("src/routes/login.tsx")
s = p.read_text()
s = replace_exact(
    s,
    'import { PageHeader } from "@/components/PageHeader";',
    '''import { PageHeader } from "@/components/PageHeader";
import {
  AuthExperienceAside,
  AuthExperienceHeader,
} from "@/features/account/AccountExperience";''',
    "login account imports",
)
s = replace_exact(
    s,
    'className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[1rem] border border-border/80 bg-card/85 px-4 py-2.5 text-sm font-semibold text-foreground shadow-soft transition hover:border-gold/40 hover:bg-card disabled:opacity-60"',
    'className="rawaj-auth-google disabled:opacity-60"',
    "google button class",
)
s = replace_exact(
    s,
    '<main className="container-wide pb-10 pt-3 sm:pt-5">',
    '<main className="rawaj-auth-v2 container-wide pb-10 pt-3 sm:pt-5">',
    "login main class",
)
s = replace_exact(
    s,
    '<section className="rawaj-hero-surface mx-auto max-w-md rounded-[1.65rem] p-5 sm:rounded-[1.9rem] sm:p-6">',
    '''<section className="rawaj-auth-layout">
          <AuthExperienceAside mode={mode} />
          <div className="rawaj-auth-card">''',
    "login layout",
)
header_start = s.index('          <div className="mb-4 flex items-start gap-3">')
tabs_start = s.index('          <div className="mb-5 grid grid-cols-2', header_start)
s = s[:header_start] + '          <AuthExperienceHeader mode={mode} />\n\n' + s[tabs_start:]
s = replace_exact(
    s,
    'className="mb-5 grid grid-cols-2 gap-1 rounded-[1.05rem] border border-border/65 bg-card-warm/65 p-1.5"',
    'className="rawaj-auth-tabs"',
    "auth tabs class",
)
first_button_class = 'className={`rounded-[0.8rem] px-3 py-2.5 text-xs font-semibold transition ${mode === "login" ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:text-primary"}`}'
s = replace_exact(s, first_button_class, 'data-active={mode === "login"}', "login tab active")
second_button_class = 'className={`rounded-[0.8rem] px-3 py-2.5 text-xs font-semibold transition ${mode === "register" ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:text-primary"}`}'
s = replace_exact(s, second_button_class, 'data-active={mode === "register"}', "register tab active")
s = replace_exact(
    s,
    'className="mt-5 rounded-[1rem] border border-border/65 bg-card-warm/65 p-3.5 text-[11px] leading-6 text-muted-foreground"',
    'className="rawaj-auth-security-note"',
    "auth security note",
)
s = replace_exact(
    s,
    '''          </Link>
        </section>''',
    '''          </Link>
          </div>
        </section>''',
    "login card close",
)
p.write_text(s)

# Profile account center.
p = Path("src/routes/profile.tsx")
s = p.read_text()
s = replace_exact(
    s,
    'import { PageHeader } from "@/components/PageHeader";',
    '''import { PageHeader } from "@/components/PageHeader";
import {
  AccountIdentityHero,
  AccountQuickLinks,
  AccountSection,
  accountSectionIcons,
} from "@/features/account/AccountExperience";''',
    "profile account imports",
)
s = replace_exact(
    s,
    '<main className="container-wide mobile-page-bottom space-y-5 pt-4">',
    '<main className="rawaj-account-v2 container-wide mobile-page-bottom space-y-5 pb-8 pt-4">',
    "profile main class",
)
hero_start = s.index('        <section className="rounded-2xl bg-card p-4 shadow-soft hairline">')
account_start = s.index('        <section\n          id="account-info"', hero_start)
hero = '''        <AccountIdentityHero
          displayName={displayName}
          email={auth.profile?.email}
          avatarUrl={auth.profile?.avatarUrl}
          coverUrl={auth.profile?.coverUrl}
          location={auth.profile?.cityArea || auth.profile?.governorate}
          roleLabel={roleLabel(auth.profile?.role, text)}
          statusLabel={accountStatusLabel(auth.profile?.accountStatus, text)}
          verified={auth.profile?.verificationStatus === "verified"}
          signedIn={auth.status === "signedIn"}
          actions={
            auth.status === "signedIn" ? (
              <>
                <a href="#account-info"><Pencil className="h-4 w-4" />{text("تعديل الحساب", "Edit account")}</a>
                <Link to="/profile/listings"><FileSpreadsheet className="h-4 w-4" />{text("متجري", "My store")}</Link>
                <Link to="/verification"><BadgeCheck className="h-4 w-4" />{text("التوثيق", "Verification")}</Link>
                <button type="button" onClick={handleLogout}><LogOut className="h-4 w-4" />{text("خروج", "Log out")}</button>
              </>
            ) : (
              <Link to="/login"><LogIn className="h-4 w-4" />{text("تسجيل الدخول", "Log in")}</Link>
            )
          }
        />
        {logoutError ? <p className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive">{logoutError}</p> : null}
        {auth.status === "signedIn" ? <AccountQuickLinks /> : null}

'''
s = s[:hero_start] + hero + s[account_start:]

account_start = s.index('        <section\n          id="account-info"')
form_start = s.index('          {auth.status === "signedIn" ? (', account_start)
next_section = s.index('        <section className="grid gap-4 lg:grid-cols-2">', form_start)
segment = s[form_start:next_section]
closing = segment.rfind('        </section>')
if closing < 0:
    raise RuntimeError("Missing account info closing section")
form_content = segment[:closing].rstrip()
account_section = '''        <AccountSection
          id="account-info"
          eyebrow={text("الهوية والتواصل", "Identity and contact")}
          title={text("معلومات الحساب", "Account information")}
          description={text(
            "حدّث الصور والاسم والموقع ووسائل التواصل التي تستخدمها في متجرك وإعلاناتك.",
            "Update the images, name, location, and contact methods used by your store and listings.",
          )}
          icon={accountSectionIcons.identity}
        >
''' + form_content + '''
        </AccountSection>

'''
s = s[:account_start] + account_section + s[next_section:]
s = s.replace(
    '<section className="grid gap-4 lg:grid-cols-2">',
    '<section className="rawaj-account-overview-grid">',
    1,
)
s = s.replace(
    '<section className="rounded-2xl bg-card p-4 hairline">',
    '<section className="rawaj-account-card">',
    2,
)
s = s.replace(
    '<section className="rounded-2xl bg-card p-4 hairline">',
    '<section className="rawaj-account-card">',
    1,
)
p.write_text(s)
