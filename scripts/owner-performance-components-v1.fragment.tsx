interface OwnerPerformanceSummary {
  trackedListings: number;
  recordedViews: number;
  favorites: number;
  conversations: number;
  unreadMessages: number;
  expiringSoon: number;
}

interface OwnerExpiryInsight {
  tone: "safe" | "warning" | "danger" | "neutral";
  title: string;
  description: string;
}

function summarizeOwnerListingPerformance(
  listings: ClassifiedListing[],
): OwnerPerformanceSummary {
  return listings.reduce<OwnerPerformanceSummary>(
    (summary, listing) => {
      if (!isPerformanceEligibleListing(listing)) return summary;
      summary.trackedListings += 1;
      summary.recordedViews += listing.recordedViewCount ?? 0;
      summary.favorites += listing.favoriteCount ?? 0;
      summary.conversations += listing.conversationCount ?? 0;
      summary.unreadMessages += listing.unreadMessageCount ?? 0;
      const daysRemaining =
        listing.status === "approved" ? daysUntilExpiry(listing.expiresAt) : null;
      if (daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 7) {
        summary.expiringSoon += 1;
      }
      return summary;
    },
    {
      trackedListings: 0,
      recordedViews: 0,
      favorites: 0,
      conversations: 0,
      unreadMessages: 0,
      expiringSoon: 0,
    },
  );
}

function OwnerPerformanceOverview({ summary }: { summary: OwnerPerformanceSummary }) {
  const { text } = useUiPreferences();
  const metrics = [
    {
      key: "views",
      label: text("المشاهدات المسجلة", "Recorded views"),
      value: summary.recordedViews,
      icon: <Eye className="h-4 w-4" />,
    },
    {
      key: "favorites",
      label: text("مرات الإضافة للمفضلة", "Favorites"),
      value: summary.favorites,
      icon: <Heart className="h-4 w-4" />,
    },
    {
      key: "conversations",
      label: text("محادثات الإعلانات", "Listing conversations"),
      value: summary.conversations,
      icon: <MessageCircle className="h-4 w-4" />,
    },
    {
      key: "unread",
      label: text("رسائل غير مقروءة", "Unread messages"),
      value: summary.unreadMessages,
      icon: <BellRing className="h-4 w-4" />,
    },
  ];

  return (
    <section
      data-owner-performance-overview="true"
      aria-label={text("ملخص أداء الإعلانات", "Listing performance summary")}
      className="rawaj-color-card rawaj-world-blue rounded-[1.4rem] p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-extrabold text-foreground">
            <TrendingUp className="h-4 w-4 text-primary" />
            {text("أداء إعلاناتك", "Your listing performance")}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
            {text(
              "إجمالي النشاط الحقيقي للإعلانات المعتمدة والمغلقة. المشاهدات تشمل المستخدمين المسجلين فقط.",
              "Real activity across approved and closed listings. Views include signed-in users only.",
            )}
          </p>
        </div>
        <span className="rounded-full bg-primary/8 px-3 py-1 text-[10px] font-bold text-primary">
          {text("إعلانات متتبعة", "Tracked listings")}: {formatOwnerMetric(summary.trackedListings)}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.key}
            data-owner-summary-metric={metric.key}
            className="rounded-xl bg-card/80 p-3 hairline"
          >
            <div className="flex items-center gap-1.5 text-primary">{metric.icon}</div>
            <p className="mt-2 text-xl font-extrabold text-foreground">
              {formatOwnerMetric(metric.value)}
            </p>
            <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
              {metric.label}
            </p>
          </div>
        ))}
      </div>
      {summary.trackedListings === 0 ? (
        <p className="mt-3 rounded-xl bg-muted-surface p-3 text-[11px] text-muted-foreground">
          {text(
            "ستظهر بيانات الأداء بعد اعتماد أول إعلان وبدء تفاعل المستخدمين معه.",
            "Performance data appears after your first listing is approved and receives activity.",
          )}
        </p>
      ) : summary.expiringSoon > 0 ? (
        <p
          data-owner-expiry-alert="warning"
          className="mt-3 flex items-center gap-2 rounded-xl bg-warning/10 p-3 text-[11px] font-bold text-foreground"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
          {text(
            "لديك " +
              formatOwnerMetric(summary.expiringSoon) +
              " إعلان ينتهي خلال 7 أيام ويحتاج مراجعة المدة.",
            formatOwnerMetric(summary.expiringSoon) +
              " listing(s) expire within 7 days and need attention.",
          )}
        </p>
      ) : (
        <p
          data-owner-expiry-alert="safe"
          className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-trust/10 p-3 text-[11px] font-semibold text-foreground"
        >
          <CircleCheckBig className="h-4 w-4 shrink-0 text-emerald-trust" />
          {text(
            "لا توجد إعلانات معتمدة تنتهي خلال الأيام السبعة القادمة.",
            "No approved listings expire within the next seven days.",
          )}
        </p>
      )}
    </section>
  );
}

function OwnerListingPerformance({
  listing,
  language,
}: {
  listing: ClassifiedListing;
  language: Language;
}) {
  const { text } = useUiPreferences();
  if (!isPerformanceEligibleListing(listing)) return null;
  const metrics = [
    {
      key: "views",
      label: text("مشاهدات", "Views"),
      value: listing.recordedViewCount ?? 0,
      icon: <Eye className="h-3.5 w-3.5" />,
    },
    {
      key: "favorites",
      label: text("مفضلة", "Favorites"),
      value: listing.favoriteCount ?? 0,
      icon: <Heart className="h-3.5 w-3.5" />,
    },
    {
      key: "conversations",
      label: text("محادثات", "Conversations"),
      value: listing.conversationCount ?? 0,
      icon: <MessageCircle className="h-3.5 w-3.5" />,
    },
    {
      key: "unread",
      label: text("غير مقروء", "Unread"),
      value: listing.unreadMessageCount ?? 0,
      icon: <BellRing className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <div
      data-owner-listing-performance="true"
      className="rounded-xl bg-primary/[0.035] p-2.5 hairline"
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.key}
            data-owner-metric={metric.key}
            className={
              "rounded-lg bg-card px-2.5 py-2 " +
              (metric.key === "unread" && metric.value > 0 ? "ring-1 ring-warning/35" : "")
            }
          >
            <p className="flex items-center gap-1 text-[9px] font-semibold text-muted-foreground">
              {metric.icon}
              {metric.label}
            </p>
            <p className="mt-1 text-sm font-extrabold text-foreground">
              {formatOwnerMetric(metric.value)}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] leading-4 text-muted-foreground">
          {text(
            "المشاهدات المسجلة لا تشمل الزوار غير المسجلين.",
            "Recorded views do not include signed-out visitors.",
          )}
          {listing.lastInquiryAt
            ? " · " +
              text("آخر استفسار", "Last inquiry") +
              ": " +
              formatSavedAt(listing.lastInquiryAt, language)
            : ""}
        </p>
        {(listing.unreadMessageCount ?? 0) > 0 ? (
          <Link
            to="/chats"
            className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-warning/10 px-2.5 py-1 text-[10px] font-bold text-foreground"
          >
            <BellRing className="h-3.5 w-3.5 text-warning" />
            {text("فتح الرسائل", "Open messages")}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function ownerListingExpiryInsight(
  listing: ClassifiedListing,
  text: (ar: string, en: string) => string,
): OwnerExpiryInsight | null {
  if (listing.status !== "approved" && listing.status !== "expired") return null;
  if (listing.status === "expired") {
    return {
      tone: "danger",
      title: text("انتهت صلاحية الإعلان", "Listing expired"),
      description: text(
        "أعد تفعيل الإعلان وأرسله للمراجعة إذا كان ما زال متاحاً.",
        "Reactivate and resubmit the listing if it is still available.",
      ),
    };
  }
  if (!listing.expiresAt) {
    return {
      tone: "safe",
      title: text("بدون انتهاء تلقائي", "No automatic expiry"),
      description: text(
        "سيبقى الإعلان منشوراً حتى تغيّر حالته أو تحدد مدة صلاحية.",
        "The listing remains published until you change its status or set an expiry period.",
      ),
    };
  }
  const daysRemaining = daysUntilExpiry(listing.expiresAt);
  if (daysRemaining === null) return null;
  if (daysRemaining <= 0) {
    return {
      tone: "danger",
      title: text("تنتهي صلاحية الإعلان اليوم", "Listing expires today"),
      description: text(
        "جدد المدة الآن لتجنب اختفاء الإعلان من النتائج.",
        "Renew the duration now to prevent the listing from leaving search results.",
      ),
    };
  }
  if (daysRemaining <= 3) {
    return {
      tone: "danger",
      title: text(
        "ينتهي الإعلان خلال " + formatOwnerMetric(daysRemaining) + " يوم",
        "Listing expires in " + formatOwnerMetric(daysRemaining) + " day(s)",
      ),
      description: text(
        "هذا تنبيه عاجل: راجع توفر الإعلان وجدّد المدة.",
        "Urgent: confirm availability and renew the listing duration.",
      ),
    };
  }
  if (daysRemaining <= 7) {
    return {
      tone: "warning",
      title: text(
        "متبقي " + formatOwnerMetric(daysRemaining) + " يوم على انتهاء الإعلان",
        formatOwnerMetric(daysRemaining) + " day(s) remain",
      ),
      description: text(
        "راجع الإعلان وجدّد المدة قبل انتهائها.",
        "Review the listing and renew it before expiry.",
      ),
    };
  }
  return {
    tone: "neutral",
    title: text(
      "متبقي " + formatOwnerMetric(daysRemaining) + " يوم",
      formatOwnerMetric(daysRemaining) + " day(s) remaining",
    ),
    description: text("مدة الإعلان فعالة حالياً.", "The listing duration is currently active."),
  };
}

function ownerExpiryInsightClassName(tone: OwnerExpiryInsight["tone"]): string {
  if (tone === "danger") return "border-destructive/25 bg-destructive/10 text-destructive";
  if (tone === "warning") return "border-warning/30 bg-warning/10 text-foreground";
  if (tone === "safe") return "border-emerald-trust/25 bg-emerald-trust/10 text-foreground";
  return "border-border/70 bg-muted-surface text-foreground";
}

function daysUntilExpiry(value: string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.ceil((timestamp - Date.now()) / 86_400_000);
}

function isPerformanceEligibleListing(listing: ClassifiedListing): boolean {
  return listing.status === "approved" || isClosedListingStatus(listing.status);
}

function formatOwnerMetric(value: number): string {
  return Math.max(0, Math.trunc(value)).toLocaleString("en-US");
}

