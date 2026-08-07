from pathlib import Path

path = Path("src/routes/profile/listings.tsx")
source = path.read_text()


def replace_once(old: str, new: str) -> None:
    global source
    if old not in source:
        raise SystemExit(f"missing compact owner parity anchor: {old[:160]!r}")
    source = source.replace(old, new, 1)


replace_once("  CheckSquare,\n  Clock3,", "  CheckSquare,\n  ChevronDown,\n  Clock3,")

replace_once(
    "        <OwnerPerformanceOverview summary={performanceSummary} />",
    '''        <OwnerPerformanceOverview
          summary={performanceSummary}
          scopeNote={text(
            performanceWindow === "all"
              ? "الأرقام تراكمية لكل الإعلانات المتتبعة."
              : `الأرقام تراكمية للإعلانات المنشورة خلال آخر ${performanceWindow} يوماً، وليست سجلاً يومياً لوقت حدوث التفاعل.`,
            performanceWindow === "all"
              ? "Metrics are lifetime totals for all tracked listings."
              : `Metrics are lifetime totals for listings published in the last ${performanceWindow} days, not event-by-event history.`,
          )}
        />''',
)

# Compact labels are deliberate: the sticky workspace must remain usable on mobile.
replace_once(
    '''            <TabButton
              active={activeTab === "approved"}
              label={text("الإعلانات المعتمدة", "Approved listings")}
              count={grouped.approved.length}
              onClick={() => setActiveTab("approved")}
            />
            <TabButton
              active={activeTab === "pending"}
              label={text("قيد المراجعة", "Pending review")}
              count={grouped.pending.length}
              onClick={() => setActiveTab("pending")}
            />
            <TabButton
              active={activeTab === "needs_edit"}
              label={text("تحتاج تعديل / مرفوضة", "Needs edit / rejected")}
              count={grouped.needs_edit.length}
              onClick={() => setActiveTab("needs_edit")}
            />
            <TabButton
              active={activeTab === "closed"}
              label={text("مغلقة / منتهية", "Closed / expired")}
              count={grouped.closed.length}
              onClick={() => setActiveTab("closed")}
            />
            <TabButton
              active={activeTab === "reviews"}
              label={text("التقييمات", "Reviews")}
              count={ratingCount}
              onClick={() => setActiveTab("reviews")}
            />''',
    '''            <TabButton active={activeTab === "approved"} label={text("نشطة", "Live")} count={grouped.approved.length} onClick={() => setActiveTab("approved")} />
            <TabButton active={activeTab === "pending"} label={text("مراجعة", "Review")} count={grouped.pending.length} onClick={() => setActiveTab("pending")} />
            <TabButton active={activeTab === "needs_edit"} label={text("تعديل", "Edit")} count={grouped.needs_edit.length} onClick={() => setActiveTab("needs_edit")} />
            <TabButton active={activeTab === "closed"} label={text("مغلقة", "Closed")} count={grouped.closed.length} onClick={() => setActiveTab("closed")} />
            <TabButton active={activeTab === "reviews"} label={text("تقييمات", "Reviews")} count={ratingCount} onClick={() => setActiveTab("reviews")} />''',
)

perf_start = source.index("function OwnerPerformanceOverview(")
perf_end = source.index("\nfunction OwnerListingPerformance", perf_start)
owner_performance = '''function OwnerPerformanceOverview({
  summary,
  scopeNote,
}: {
  summary: OwnerPerformanceSummary;
  scopeNote: string;
}) {
  const { text } = useUiPreferences();
  const [expanded, setExpanded] = useState(false);
  const metrics = [
    {
      key: "views",
      label: text("المشاهدات", "Views"),
      value: summary.recordedViews,
      icon: <Eye className="h-4 w-4" />,
    },
    {
      key: "favorites",
      label: text("المفضلة", "Favorites"),
      value: summary.favorites,
      icon: <Heart className="h-4 w-4" />,
    },
    {
      key: "conversations",
      label: text("المحادثات", "Conversations"),
      value: summary.conversations,
      icon: <MessageCircle className="h-4 w-4" />,
    },
    {
      key: "unread",
      label: text("غير المقروء", "Unread"),
      value: summary.unreadMessages,
      icon: <BellRing className="h-4 w-4" />,
    },
  ];
  const visibleMetrics = metrics.filter((metric) => metric.value > 0);

  return (
    <section
      data-owner-performance-overview="true"
      aria-label={text("ملخص أداء الإعلانات", "Listing performance summary")}
      className="rawaj-color-card rawaj-world-blue overflow-hidden rounded-[1.2rem]"
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-start"
      >
        <span className="flex min-w-0 items-center gap-2">
          <TrendingUp className="h-4 w-4 shrink-0 text-primary" />
          <span>
            <span className="block text-sm font-extrabold text-foreground">
              {text("أداء إعلاناتك", "Your listing performance")}
            </span>
            <span className="block text-[10px] text-muted-foreground">
              {text(
                "ملخص سريع للتفاعل وحالة الإعلانات",
                "A quick summary of engagement and listing health",
              )}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs font-bold text-primary">
          {formatOwnerMetric(summary.recordedViews)}
          <Eye className="h-3.5 w-3.5" />
          <ChevronDown
            className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {expanded ? (
        <div className="border-t border-border/60 px-4 pb-4 pt-3">
          <div className="grid grid-flow-col auto-cols-fr gap-2">
            {visibleMetrics.map((metric) => (
              <div
                key={metric.key}
                data-owner-summary-metric={metric.key}
                className="rounded-xl bg-card/80 p-2 text-center hairline"
              >
                <div className="mx-auto flex w-fit items-center text-primary">{metric.icon}</div>
                <p className="mt-1 text-base font-extrabold text-foreground">
                  {formatOwnerMetric(metric.value)}
                </p>
                <p className="truncate text-[9px] font-semibold text-muted-foreground">
                  {metric.label}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[9px] leading-4 text-muted-foreground">{scopeNote}</p>
          {summary.trackedListings === 0 ? (
            <p className="mt-3 rounded-xl bg-muted-surface p-3 text-[11px] text-muted-foreground">
              {text(
                "ستظهر بيانات الأداء بعد اعتماد أول إعلان وبدء التفاعل معه.",
                "Performance data appears after your first approved listing receives activity.",
              )}
            </p>
          ) : summary.expiringSoon > 0 ? (
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-warning/10 p-3 text-[11px] font-bold text-foreground">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
              {text(
                "لديك " + formatOwnerMetric(summary.expiringSoon) + " إعلان ينتهي خلال 7 أيام.",
                formatOwnerMetric(summary.expiringSoon) + " listing(s) expire within 7 days.",
              )}
            </p>
          ) : (
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-trust/10 p-3 text-[11px] font-semibold text-foreground">
              <CircleCheckBig className="h-4 w-4 shrink-0 text-emerald-trust" />
              {text(
                "لا توجد إعلانات تنتهي خلال الأيام السبعة القادمة.",
                "No listings expire within the next seven days.",
              )}
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
'''
source = source[:perf_start] + owner_performance + source[perf_end:]

listing_perf_start = source.index("function OwnerListingPerformance(")
listing_perf_end = source.index("\nfunction ownerListingExpiryInsight", listing_perf_start)
listing_performance = '''function OwnerListingPerformance({
  listing,
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
  const visibleMetrics = metrics.filter((metric) => metric.value > 0);
  const hasActivity = visibleMetrics.length > 0;

  return (
    <div
      data-owner-listing-performance="true"
      className="flex items-center justify-between gap-2 rounded-xl bg-primary/[0.035] px-3 py-2 hairline"
    >
      {hasActivity ? (
        <div className="grid flex-1 grid-flow-col auto-cols-fr gap-1.5">
          {visibleMetrics.map((metric) => (
            <div key={metric.key} data-owner-metric={metric.key} className="text-center">
              <p className="flex items-center justify-center gap-1 text-[9px] text-muted-foreground">
                {metric.icon}
                <span>{formatOwnerMetric(metric.value)}</span>
              </p>
              <p className="mt-0.5 truncate text-[8px] font-semibold text-muted-foreground">
                {metric.label}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="flex-1 text-[10px] font-semibold text-muted-foreground">
          {text("لا يوجد تفاعل بعد", "No activity yet")}
        </p>
      )}
      {(listing.unreadMessageCount ?? 0) > 0 ? (
        <Link
          to="/chats"
          className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-warning/10 px-2 text-[9px] font-bold text-foreground"
        >
          <BellRing className="h-3.5 w-3.5 text-warning" />
          {formatOwnerMetric(listing.unreadMessageCount ?? 0)}
        </Link>
      ) : null}
    </div>
  );
}
'''
source = source[:listing_perf_start] + listing_performance + source[listing_perf_end:]

replace_once(
    '  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);\n',
    '  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);\n  const [managementOpen, setManagementOpen] = useState(false);\n',
)
replace_once(
    '  const canEdit = listing.status === "draft" || listing.status === "rejected";',
    '  const canEdit = listing.status !== "pending_review" && !isClosedListingStatus(listing.status);',
)

controls_start = source.index('          {canReducePrice ? (', source.index('function StoreListingCard('))
controls_end = source.index('        </div>\n      </article>', controls_start)
compact_controls = '''          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {listing.status === "approved" ? (
                <Link
                  to="/listings/$id"
                  params={{ id: listing.id }}
                  aria-label={text("عرض الإعلان", "View listing")}
                  title={text("عرض الإعلان", "View listing")}
                  className="grid h-10 w-10 place-items-center rounded-xl bg-muted-surface text-foreground transition hover:bg-secondary hairline"
                >
                  <Eye className="h-4 w-4" />
                </Link>
              ) : null}
              {canEdit ? (
                <Link
                  to="/profile/listings/$id"
                  params={{ id: listing.id }}
                  aria-label={text("تعديل الإعلان", "Edit listing")}
                  title={text("تعديل الإعلان", "Edit listing")}
                  className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary transition hover:bg-primary/15 hairline"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
              ) : null}
              <button
                type="button"
                disabled={duplicating}
                onClick={() => void onDuplicate(listing)}
                aria-label={text("نسخ الإعلان كمسودة", "Duplicate listing as draft")}
                title={text("نسخ كمسودة بدون الصور", "Duplicate as a draft without images")}
                className="grid h-10 w-10 place-items-center rounded-xl bg-muted-surface text-foreground transition hover:bg-secondary hairline disabled:opacity-50"
              >
                <Copy className={`h-4 w-4 ${duplicating ? "animate-pulse" : ""}`} />
              </button>
            </div>
            <button
              type="button"
              aria-expanded={managementOpen}
              onClick={() => setManagementOpen((current) => !current)}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-muted-surface px-3 text-[10px] font-bold text-foreground hairline"
            >
              {text("إدارة الإعلان", "Manage listing")}
              <ChevronDown
                className={`h-4 w-4 transition-transform ${managementOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          {managementOpen ? (
            <div className="space-y-3 rounded-xl bg-muted-surface/55 p-3 hairline">
              {canReducePrice ? (
                <div className="rounded-xl bg-brand-orange/5 p-2.5 hairline">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold text-primary">
                    <BadgePercent className="h-3.5 w-3.5 text-brand-orange" />
                    {text("تخفيض السعر", "Reduce price")}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      inputMode="decimal"
                      value={priceDropDraft}
                      onChange={(event) => setPriceDropDraft(event.target.value)}
                      disabled={priceDropBusy}
                      aria-label={text("السعر الجديد", "New price")}
                      className="min-h-10 min-w-0 flex-1 rounded-xl bg-card px-3 py-2 text-xs font-bold outline-none hairline disabled:opacity-60"
                    />
                    <button
                      type="button"
                      disabled={priceDropBusy}
                      onClick={() => void handlePriceDrop()}
                      className="min-h-10 rounded-xl bg-brand-orange px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {priceDropBusy ? text("جارٍ الحفظ", "Saving") : text("خفض", "Reduce")}
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                {canManageReservation ? (
                  <button
                    type="button"
                    disabled={reservationBusy}
                    onClick={() => void handleReservationToggle()}
                    className={`min-h-10 rounded-xl px-3 py-2 text-[10px] font-bold disabled:opacity-60 ${listing.reservedAt ? "bg-warning/12 text-warning" : "bg-card text-foreground hairline"}`}
                  >
                    {listing.reservedAt
                      ? text("إلغاء الحجز", "Clear reservation")
                      : text("وضع محجوز", "Mark reserved")}
                  </button>
                ) : null}
                {canClose ? (
                  <button
                    type="button"
                    disabled={lifecycleBusy}
                    onClick={() => void handleAvailabilityConfirm()}
                    className="min-h-10 rounded-xl bg-emerald-trust/10 px-3 py-2 text-[10px] font-bold text-emerald-trust disabled:opacity-60"
                  >
                    {text("تأكيد أنه متوفر", "Confirm availability")}
                  </button>
                ) : null}
              </div>

              {canClose ? (
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <select
                    value={String(expiryOption)}
                    disabled={lifecycleBusy}
                    onChange={(event) => {
                      const value = event.target.value;
                      setExpiryOption(
                        value === "never" ? "never" : (Number(value) as 30 | 60 | 90),
                      );
                    }}
                    aria-label={text("مدة صلاحية الإعلان", "Listing expiry duration")}
                    className="min-h-10 rounded-xl border border-border/70 bg-card px-3 text-[10px] font-bold text-foreground disabled:opacity-60"
                  >
                    <option value="30">{text("30 يوم", "30 days")}</option>
                    <option value="60">{text("60 يوم", "60 days")}</option>
                    <option value="90">{text("90 يوم", "90 days")}</option>
                    <option value="never">{text("بدون انتهاء", "No automatic expiry")}</option>
                  </select>
                  <button
                    type="button"
                    disabled={lifecycleBusy}
                    onClick={() => void handleExpiryUpdate()}
                    className="min-h-10 rounded-xl bg-primary/10 px-3 text-[10px] font-bold text-primary disabled:opacity-60"
                  >
                    {text("تطبيق", "Apply")}
                  </button>
                </div>
              ) : null}

              {canClose ? (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={lifecycleBusy}
                    onClick={() =>
                      setPendingLifecycleConfirmation({ action: "close", targetStatus: "sold" })
                    }
                    className="min-h-10 rounded-xl bg-card px-2 text-[10px] font-bold hairline disabled:opacity-60"
                  >
                    {text("تم البيع", "Sold")}
                  </button>
                  <button
                    type="button"
                    disabled={lifecycleBusy}
                    onClick={() =>
                      setPendingLifecycleConfirmation({ action: "close", targetStatus: "rented" })
                    }
                    className="min-h-10 rounded-xl bg-card px-2 text-[10px] font-bold hairline disabled:opacity-60"
                  >
                    {text("تم التأجير", "Rented")}
                  </button>
                  <button
                    type="button"
                    disabled={lifecycleBusy}
                    onClick={() =>
                      setPendingLifecycleConfirmation({
                        action: "close",
                        targetStatus: "unavailable",
                      })
                    }
                    className="min-h-10 rounded-xl bg-warning/10 px-2 text-[10px] font-bold text-warning disabled:opacity-60"
                  >
                    {text("غير متاح", "Unavailable")}
                  </button>
                </div>
              ) : null}

              {canReactivate ? (
                <button
                  type="button"
                  disabled={lifecycleBusy}
                  onClick={() => setPendingLifecycleConfirmation({ action: "reactivate" })}
                  className="min-h-10 w-full rounded-xl bg-primary px-3 text-[10px] font-bold text-primary-foreground disabled:opacity-60"
                >
                  {text("إعادة التفعيل للمراجعة", "Reactivate for review")}
                </button>
              ) : null}

              {canDelete ? (
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError("");
                    setShowDeleteConfirm(true);
                  }}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-1 rounded-xl bg-destructive/10 px-3 text-[10px] font-bold text-destructive transition hover:bg-destructive/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {listing.status === "draft"
                    ? text("حذف المسودة", "Delete draft")
                    : text("حذف الإعلان", "Delete listing")}
                </button>
              ) : null}
            </div>
          ) : null}
'''
source = source[:controls_start] + compact_controls + source[controls_end:]

path.write_text(source)
