import { Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  Bell,
  Bookmark,
  Camera,
  CheckCircle2,
  FileSpreadsheet,
  Heart,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Store,
  User,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useUiPreferences } from "@/lib/ui-preferences";

export function AuthExperienceAside({ mode }: { mode: "login" | "register" | "forgot" }) {
  const { text } = useUiPreferences();
  const title =
    mode === "register"
      ? text("ابدأ مساحتك على رواج", "Start your RAWAJ space")
      : mode === "forgot"
        ? text("استعد حسابك بأمان", "Recover your account safely")
        : text("كل نشاطك في مكان واحد", "Everything you do, in one place");
  const description =
    mode === "register"
      ? text(
          "أنشئ حساباً لإدارة الإعلانات، الرسائل، المفضلة والتنبيهات من مساحة شخصية واضحة.",
          "Create an account to manage listings, messages, favorites, and alerts from one clear personal space.",
        )
      : mode === "forgot"
        ? text(
            "سنرسل رابط الاستعادة إلى بريدك فقط. لا نطلب منك كلمة المرور القديمة.",
            "We send recovery only to your email and never ask for your old password.",
          )
        : text(
            "ادخل إلى متجرك وإعلاناتك ورسائلك وتقييماتك دون التنقل بين صفحات مبعثرة.",
            "Access your store, listings, messages, and reviews without a fragmented journey.",
          );

  return (
    <aside className="rawaj-auth-aside" aria-label={text("مزايا الحساب", "Account benefits")}>
      <div className="rawaj-auth-aside__brand">
        <span>
          <Sparkles aria-hidden="true" />
        </span>
        <p>RAWAJ</p>
      </div>
      <div className="rawaj-auth-aside__copy">
        <p>{text("حساب رواج", "RAWAJ account")}</p>
        <h1>{title}</h1>
        <span>{description}</span>
      </div>
      <ul>
        <AuthBenefit icon={Store} label={text("متجرك وإعلاناتك", "Your store and listings")} />
        <AuthBenefit
          icon={MessageCircle}
          label={text("رسائلك ومحادثاتك", "Your messages and conversations")}
        />
        <AuthBenefit
          icon={Bookmark}
          label={text("المفضلة وعمليات البحث", "Favorites and saved searches")}
        />
        <AuthBenefit
          icon={ShieldCheck}
          label={text("إعدادات وأمان الحساب", "Account settings and security")}
        />
      </ul>
      <div className="rawaj-auth-aside__trust">
        <LockKeyhole aria-hidden="true" />
        <span>
          {text(
            "الدخول والصلاحيات عبر نظام المصادقة المعتمد",
            "Sign-in and permissions use the approved authentication system",
          )}
        </span>
      </div>
    </aside>
  );
}

function AuthBenefit({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <li>
      <span>
        <Icon aria-hidden="true" />
      </span>
      <strong>{label}</strong>
      <CheckCircle2 aria-hidden="true" />
    </li>
  );
}

export function AuthExperienceHeader({ mode }: { mode: "login" | "register" | "forgot" }) {
  const { text } = useUiPreferences();
  const title =
    mode === "login"
      ? text("مرحباً بعودتك", "Welcome back")
      : mode === "forgot"
        ? text("إعادة تعيين كلمة المرور", "Reset your password")
        : text("إنشاء حساب جديد", "Create a new account");
  const description =
    mode === "login"
      ? text("ادخل إلى حسابك لمتابعة نشاطك على رواج.", "Sign in to continue your RAWAJ activity.")
      : mode === "forgot"
        ? text(
            "أدخل بريدك وسنرسل رابط الاستعادة الآمن.",
            "Enter your email and we will send a secure recovery link.",
          )
        : text(
            "معلومات بسيطة تفصلك عن نشر أول إعلان.",
            "A few details separate you from posting your first listing.",
          );

  return (
    <header className="rawaj-auth-card__header">
      <span>
        <User aria-hidden="true" />
      </span>
      <div>
        <p>{text("مساحة الحساب", "Account space")}</p>
        <h2>{title}</h2>
        <small>{description}</small>
      </div>
    </header>
  );
}

export function AccountIdentityHero({
  displayName,
  email,
  avatarUrl,
  coverUrl,
  location,
  roleLabel,
  statusLabel,
  verified,
  signedIn,
  actions,
}: {
  displayName: string;
  email?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  location?: string | null;
  roleLabel: string;
  statusLabel: string;
  verified: boolean;
  signedIn: boolean;
  actions: ReactNode;
}) {
  const { text } = useUiPreferences();
  return (
    <section className="rawaj-account-identity" data-signed-in={signedIn}>
      <div className="rawaj-account-identity__cover">
        {coverUrl ? <img src={coverUrl} alt="" decoding="async" /> : null}
        <div aria-hidden="true" />
      </div>
      <div className="rawaj-account-identity__content">
        <div className="rawaj-account-identity__avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} decoding="async" />
          ) : (
            <User aria-hidden="true" />
          )}
          {signedIn ? (
            <span>
              <Camera aria-hidden="true" />
            </span>
          ) : null}
        </div>
        <div className="rawaj-account-identity__copy">
          <p>
            {signedIn
              ? text("مساحتي الشخصية", "My personal space")
              : text("حساب رواج", "RAWAJ account")}
          </p>
          <div>
            <h1>{displayName}</h1>
            {verified ? (
              <strong>
                <BadgeCheck aria-hidden="true" />
                {text("موثّق", "Verified")}
              </strong>
            ) : null}
          </div>
          {email ? <small>{email}</small> : null}
          {location ? <span>{location}</span> : null}
          <div className="rawaj-account-identity__badges">
            <b>{roleLabel}</b>
            <b>{statusLabel}</b>
          </div>
        </div>
      </div>
      <div className="rawaj-account-identity__actions">{actions}</div>
    </section>
  );
}

export function AccountQuickLinks() {
  const { text } = useUiPreferences();
  return (
    <nav
      className="rawaj-account-quick-links"
      aria-label={text("اختصارات الحساب", "Account shortcuts")}
    >
      <AccountQuickLink
        to="/profile/listings"
        icon={FileSpreadsheet}
        title={text("إعلاناتي", "My listings")}
        description={text("الإدارة والحالات", "Management and statuses")}
      />
      <AccountQuickLink
        to="/chats"
        icon={MessageCircle}
        title={text("الرسائل", "Messages")}
        description={text("المحادثات النشطة", "Active conversations")}
      />
      <AccountQuickLink
        to="/favorites"
        icon={Heart}
        title={text("المفضلة", "Favorites")}
        description={text("الإعلانات المحفوظة", "Saved listings")}
      />
      <AccountQuickLink
        to="/notifications"
        icon={Bell}
        title={text("التنبيهات", "Notifications")}
        description={text("آخر المستجدات", "Latest updates")}
      />
    </nav>
  );
}

function AccountQuickLink({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: "/profile/listings" | "/chats" | "/favorites" | "/notifications";
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Link to={to}>
      <span>
        <Icon aria-hidden="true" />
      </span>
      <div>
        <strong>{title}</strong>
        <small>{description}</small>
      </div>
    </Link>
  );
}

export function AccountSection({
  id,
  eyebrow,
  title,
  description,
  icon: Icon,
  children,
  tone = "default",
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  children: ReactNode;
  tone?: "default" | "muted" | "security";
}) {
  const sectionClassName =
    id === "account-info"
      ? "rawaj-account-section rawaj-account-profile-editor"
      : "rawaj-account-section";

  return (
    <section id={id} className={sectionClassName} data-tone={tone}>
      <header>
        <span>
          <Icon aria-hidden="true" />
        </span>
        <div>
          <p>{eyebrow}</p>
          <h2>{title}</h2>
          {description ? <small>{description}</small> : null}
        </div>
      </header>
      <div className="rawaj-account-section__body">{children}</div>
    </section>
  );
}

export const accountSectionIcons = {
  identity: User,
  store: Store,
  verification: BadgeCheck,
  security: ShieldCheck,
};
