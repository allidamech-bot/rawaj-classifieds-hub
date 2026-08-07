from pathlib import Path

page = Path("src/routes/profile/listings.tsx")
source = page.read_text()


def replace_once(old: str, new: str) -> None:
    global source
    if old not in source:
        raise SystemExit(f"missing parity anchor: {old[:120]!r}")
    source = source.replace(old, new, 1)


replace_once("  CircleCheckBig,\n  Clock3,", "  CircleCheckBig,\n  CheckSquare,\n  Clock3,\n  Copy,")
replace_once("  Plus,\n  Star,", "  Plus,\n  Square,\n  Star,")
replace_once(
    '} from "@/features/storefront/StorefrontIdentityHero";\nimport {\n  closeOwnerListing,',
    '} from "@/features/storefront/StorefrontIdentityHero";\nimport {\n'
    '  filterAndSortOwnerListings,\n'
    '  filterOwnerPerformanceWindow,\n'
    '  OwnerBulkActionBar,\n'
    '  OwnerListingsToolbar,\n'
    '  OwnerWorkspaceInsights,\n'
    '  type OwnerListingSort,\n'
    '  type OwnerPerformanceWindow,\n'
    '} from "@/features/storefront/OwnerListingsWorkspaceTools";\nimport {\n  closeOwnerListing,',
)
replace_once(
    "  confirmOwnerListingAvailability,\n  deleteOwnerListing,",
    "  confirmOwnerListingAvailability,\n  createOwnerDraftCopyRequestId,\n  createOwnerDraftListingCopy,\n  deleteOwnerListing,",
)
replace_once(
    'type StoreTab = "approved" | "pending" | "needs_edit" | "closed" | "reviews";\n',
    'type StoreTab = "approved" | "pending" | "needs_edit" | "closed" | "reviews";\n\nconst OWNER_LISTINGS_PAGE_SIZE = 12;\n',
)
replace_once(
    '  const [activeTab, setActiveTab] = useState<StoreTab>(search.tab ?? "approved");\n  const listingsRequestIdRef',
    '  const [activeTab, setActiveTab] = useState<StoreTab>(search.tab ?? "approved");\n'
    '  const [listingSearch, setListingSearch] = useState("");\n'
    '  const [listingSort, setListingSort] = useState<OwnerListingSort>("updated_desc");\n'
    '  const [performanceWindow, setPerformanceWindow] = useState<OwnerPerformanceWindow>("all");\n'
    '  const [visibleCount, setVisibleCount] = useState(OWNER_LISTINGS_PAGE_SIZE);\n'
    '  const [selectedListingIds, setSelectedListingIds] = useState<Set<string>>(() => new Set());\n'
    '  const [bulkExpiryOption, setBulkExpiryOption] = useState<ListingExpiryOption>(30);\n'
    '  const [bulkBusy, setBulkBusy] = useState(false);\n'
    '  const [bulkFeedback, setBulkFeedback] = useState("");\n'
    '  const [workspaceMessage, setWorkspaceMessage] = useState("");\n'
    '  const [duplicatingListingId, setDuplicatingListingId] = useState<string | null>(null);\n'
    '  const duplicateRequestIdsRef = useRef<Map<string, string>>(new Map());\n'
    '  const listingsRequestIdRef',
)
replace_once(
    '  useEffect(() => {\n    if (search.tab) setActiveTab(search.tab);\n  }, [search.tab]);\n\n  const loadListings',
    '  useEffect(() => {\n    if (search.tab) setActiveTab(search.tab);\n  }, [search.tab]);\n\n'
    '  useEffect(() => {\n'
    '    setVisibleCount(OWNER_LISTINGS_PAGE_SIZE);\n'
    '    setSelectedListingIds(new Set());\n'
    '    setBulkFeedback("");\n'
    '  }, [activeTab, listingSearch, listingSort]);\n\n'
    '  useEffect(() => {\n'
    '    setSelectedListingIds((current) => {\n'
    '      const validIds = new Set(\n'
    '        listings\n'
    '          .filter((listing) => listing.status === "approved" && current.has(listing.id))\n'
    '          .map((listing) => listing.id),\n'
    '      );\n'
    '      return validIds.size === current.size ? current : validIds;\n'
    '    });\n'
    '  }, [listings]);\n\n'
    '  const loadListings',
)
replace_once(
    '  const performanceSummary = useMemo(() => summarizeOwnerListingPerformance(listings), [listings]);\n',
    '  const performanceListings = useMemo(\n'
    '    () => filterOwnerPerformanceWindow(listings, performanceWindow),\n'
    '    [listings, performanceWindow],\n'
    '  );\n'
    '  const performanceSummary = useMemo(\n'
    '    () => summarizeOwnerListingPerformance(performanceListings),\n'
    '    [performanceListings],\n'
    '  );\n'
    '  const tabListings = grouped[activeTab === "reviews" ? "approved" : activeTab];\n'
    '  const filteredListings = useMemo(\n'
    '    () => filterAndSortOwnerListings(tabListings, listingSearch, listingSort),\n'
    '    [tabListings, listingSearch, listingSort],\n'
    '  );\n'
    '  const visibleListings = filteredListings.slice(0, visibleCount);\n'
    '  const hasMoreListings = visibleCount < filteredListings.length;\n'
    '  const visibleApprovedIds = visibleListings\n'
    '    .filter((listing) => listing.status === "approved")\n'
    '    .map((listing) => listing.id);\n'
    '  const allVisibleApprovedSelected =\n'
    '    visibleApprovedIds.length > 0 && visibleApprovedIds.every((id) => selectedListingIds.has(id));\n'
    '  const selectedApprovedListings = listings.filter(\n'
    '    (listing) => listing.status === "approved" && selectedListingIds.has(listing.id),\n'
    '  );\n\n'
    '  function handleSelectionChange(listingId: string, selected: boolean) {\n'
    '    setSelectedListingIds((current) => {\n'
    '      const next = new Set(current);\n'
    '      if (selected) next.add(listingId);\n'
    '      else next.delete(listingId);\n'
    '      return next;\n'
    '    });\n'
    '  }\n\n'
    '  function toggleVisibleApprovedSelection() {\n'
    '    setSelectedListingIds((current) => {\n'
    '      const next = new Set(current);\n'
    '      if (allVisibleApprovedSelected) visibleApprovedIds.forEach((id) => next.delete(id));\n'
    '      else visibleApprovedIds.forEach((id) => next.add(id));\n'
    '      return next;\n'
    '    });\n'
    '  }\n\n'
    '  async function handleDuplicateListing(listing: ClassifiedListing) {\n'
    '    if (!profileId || duplicatingListingId) return;\n'
    '    setDuplicatingListingId(listing.id);\n'
    '    setWorkspaceMessage("");\n'
    '    try {\n'
    '      const requestId = duplicateRequestIdsRef.current.get(listing.id) ?? createOwnerDraftCopyRequestId();\n'
    '      duplicateRequestIdsRef.current.set(listing.id, requestId);\n'
    '      const result = await createOwnerDraftListingCopy(\n'
    '        profileId,\n'
    '        {\n'
    '          categoryId: listing.categoryId,\n'
    '          subcategoryId: listing.subcategoryId,\n'
    '          governorateId: listing.governorateId,\n'
    '          title: `${listing.title} ${text("نسخة", "copy")}`.slice(0, 120),\n'
    '          description: listing.description,\n'
    '          price: listing.price,\n'
    '          priceType: listing.priceType,\n'
    '          condition: listing.condition,\n'
    '          districtAr: listing.locationNodeId ? `@${listing.locationNodeId}` : listing.districtAr,\n'
    '          contactName: listing.contactName,\n'
    '          contactOptions: { ...listing.contactOptions },\n'
    '          details: { ...listing.details },\n'
    '        },\n'
    '        requestId,\n'
    '      );\n'
    '      if (!result.ok) {\n'
    '        setWorkspaceMessage(result.error.message);\n'
    '        return;\n'
    '      }\n'
    '      duplicateRequestIdsRef.current.delete(listing.id);\n'
    '      setListings((current) => [result.data, ...current.filter((item) => item.id !== result.data.id)]);\n'
    '      setActiveTab("needs_edit");\n'
    '      setListingSearch("");\n'
    '      setWorkspaceMessage(\n'
    '        text(\n'
    '          "تم إنشاء نسخة كمسودة بدون الصور. افتحها لإضافة الصور ومراجعة البيانات.",\n'
    '          "A draft copy was created without images. Open it to add images and review the details.",\n'
    '        ),\n'
    '      );\n'
    '    } catch (caught) {\n'
    '      setWorkspaceMessage(\n'
    '        caught instanceof Error ? caught.message : text("تعذر نسخ الإعلان.", "Could not duplicate the listing."),\n'
    '      );\n'
    '    } finally {\n'
    '      setDuplicatingListingId(null);\n'
    '    }\n'
    '  }\n\n'
    '  async function runBulkAction(action: "renew" | "availability") {\n'
    '    if (!profileId || bulkBusy || selectedApprovedListings.length === 0) return;\n'
    '    setBulkBusy(true);\n'
    '    setBulkFeedback("");\n'
    '    let successCount = 0;\n'
    '    const failures: string[] = [];\n'
    '    for (const listing of selectedApprovedListings) {\n'
    '      try {\n'
    '        const result = action === "renew"\n'
    '          ? await setOwnerListingExpiry(profileId, listing.id, bulkExpiryOption)\n'
    '          : await confirmOwnerListingAvailability(profileId, listing.id);\n'
    '        if (result.ok) {\n'
    '          successCount += 1;\n'
    '          handleListingChanged(profileId, result.data);\n'
    '        } else failures.push(result.error.message);\n'
    '      } catch (caught) {\n'
    '        failures.push(\n'
    '          caught instanceof Error ? caught.message : text("تعذر تنفيذ الإجراء.", "Could not complete the action."),\n'
    '        );\n'
    '      }\n'
    '    }\n'
    '    setSelectedListingIds(new Set());\n'
    '    setBulkFeedback(\n'
    '      failures.length === 0\n'
    '        ? text(`تم تحديث ${successCount} إعلان بنجاح.`, `${successCount} listing(s) updated successfully.`)\n'
    '        : text(`تم تحديث ${successCount} إعلان، وتعذر تحديث ${failures.length}.`, `${successCount} updated; ${failures.length} failed.`),\n'
    '    );\n'
    '    setBulkBusy(false);\n'
    '  }\n',
)
replace_once('  const visibleListings = grouped[activeTab === "reviews" ? "approved" : activeTab];\n', "")
replace_once(
    '        <OwnerPerformanceOverview summary={performanceSummary} />\n\n        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">',
    '        <OwnerWorkspaceInsights listings={listings} onTabChange={(tab) => setActiveTab(tab)} />\n\n'
    '        <OwnerPerformanceOverview summary={performanceSummary} />\n\n'
    '        <div className="rawaj-owner-workspace-sticky">',
)
replace_once(
    '          </div>\n          <Link to="/add-listing" className="rawaj-button-primary min-h-11 rounded-[1rem] px-4">\n            <Plus className="h-4 w-4" />\n            {text("إضافة إعلان", "Post listing")}\n          </Link>\n        </div>\n\n        {sellerError',
    '          </div>\n'
    '          {activeTab !== "reviews" ? (\n'
    '            <OwnerListingsToolbar\n'
    '              query={listingSearch}\n'
    '              onQueryChange={setListingSearch}\n'
    '              sort={listingSort}\n'
    '              onSortChange={setListingSort}\n'
    '              performanceWindow={performanceWindow}\n'
    '              onPerformanceWindowChange={setPerformanceWindow}\n'
    '              totalCount={filteredListings.length}\n'
    '              shownCount={visibleListings.length}\n'
    '              canSelect={activeTab === "approved" && visibleApprovedIds.length > 0}\n'
    '              selectedCount={selectedApprovedListings.length}\n'
    '              allVisibleSelected={allVisibleApprovedSelected}\n'
    '              onToggleVisibleSelection={toggleVisibleApprovedSelection}\n'
    '            />\n'
    '          ) : null}\n'
    '          {activeTab === "approved" ? (\n'
    '            <OwnerBulkActionBar\n'
    '              selectedCount={selectedApprovedListings.length}\n'
    '              expiryOption={bulkExpiryOption}\n'
    '              busy={bulkBusy}\n'
    '              feedback={bulkFeedback}\n'
    '              onExpiryOptionChange={setBulkExpiryOption}\n'
    '              onRenew={() => void runBulkAction("renew")}\n'
    '              onConfirmAvailability={() => void runBulkAction("availability")}\n'
    '              onClear={() => { setSelectedListingIds(new Set()); setBulkFeedback(""); }}\n'
    '            />\n'
    '          ) : null}\n'
    '        </div>\n\n'
    '        {workspaceMessage ? (\n'
    '          <p role="status" className="rawaj-owner-workspace-feedback">{workspaceMessage}</p>\n'
    '        ) : null}\n\n'
    '        {sellerError',
)
replace_once("            {visibleListings.length === 0 ? (", "            {filteredListings.length === 0 ? (")
replace_once(
    '                    userId={profileId}\n                    onDeleted={handleListingDeleted}',
    '                    userId={profileId}\n'
    '                    selected={selectedListingIds.has(listing.id)}\n'
    '                    selectable={activeTab === "approved" && listing.status === "approved"}\n'
    '                    duplicating={duplicatingListingId === listing.id}\n'
    '                    onSelectionChange={handleSelectionChange}\n'
    '                    onDuplicate={handleDuplicateListing}\n'
    '                    onDeleted={handleListingDeleted}',
)
replace_once(
    '              </div>\n            )}\n          </>\n',
    '              </div>\n'
    '              {hasMoreListings ? (\n'
    '                <button\n'
    '                  type="button"\n'
    '                  className="rawaj-owner-load-more"\n'
    '                  onClick={() => setVisibleCount((current) => current + OWNER_LISTINGS_PAGE_SIZE)}\n'
    '                >\n'
    '                  {text("عرض المزيد", "Load more")} · {visibleListings.length}/{filteredListings.length}\n'
    '                </button>\n'
    '              ) : null}\n'
    '            )}\n'
    '          </>\n',
)
replace_once(
    '  userId,\n  onDeleted,',
    '  userId,\n  selected,\n  selectable,\n  duplicating,\n  onSelectionChange,\n  onDuplicate,\n  onDeleted,',
)
replace_once(
    '  userId: string | null;\n  onDeleted:',
    '  userId: string | null;\n'
    '  selected: boolean;\n'
    '  selectable: boolean;\n'
    '  duplicating: boolean;\n'
    '  onSelectionChange: (listingId: string, selected: boolean) => void;\n'
    '  onDuplicate: (listing: ClassifiedListing) => Promise<void>;\n'
    '  onDeleted:',
)
replace_once(
    '          <ListingCardImage\n            src={listing.primaryImageUrl}',
    '          {selectable ? (\n'
    '            <button\n'
    '              type="button"\n'
    '              aria-pressed={selected}\n'
    '              aria-label={selected ? text("إلغاء تحديد الإعلان", "Unselect listing") : text("تحديد الإعلان", "Select listing")}\n'
    '              title={selected ? text("إلغاء التحديد", "Unselect") : text("تحديد للإجراءات الجماعية", "Select for bulk actions")}\n'
    '              onClick={() => onSelectionChange(listing.id, !selected)}\n'
    '              className="rawaj-owner-listing-select"\n'
    '              data-selected={selected}\n'
    '            >\n'
    '              {selected ? <CheckSquare aria-hidden="true" /> : <Square aria-hidden="true" />}\n'
    '            </button>\n'
    '          ) : null}\n'
    '          <ListingCardImage\n            src={listing.primaryImageUrl}',
)
replace_once(
    '            {canManageReservation ? (',
    '            <button\n'
    '              type="button"\n'
    '              disabled={duplicating}\n'
    '              onClick={() => void onDuplicate(listing)}\n'
    '              aria-label={text("نسخ الإعلان كمسودة", "Duplicate listing as draft")}\n'
    '              title={text("نسخ كمسودة بدون الصور", "Duplicate as a draft without images")}\n'
    '              className="inline-flex items-center gap-1 rounded-lg bg-muted-surface px-2 py-1 text-[10px] font-bold transition hover:bg-secondary disabled:opacity-50"\n'
    '            >\n'
    '              <Copy className={`h-3 w-3 ${duplicating ? "animate-pulse" : ""}`} />\n'
    '              {text("نسخ", "Duplicate")}\n'
    '            </button>\n'
    '            {canManageReservation ? (',
)

page.write_text(source)

css = Path("src/owner-listings-workspace-v9.css")
styles = css.read_text()
if "RAWAJ owner listings workspace v10" not in styles:
    styles += r'''

/* RAWAJ owner listings workspace v10: scalable inventory controls. */
.rawaj-owner-smart-insights { display:flex; gap:.5rem; overflow-x:auto; padding-bottom:.15rem; scrollbar-width:thin; }
.rawaj-owner-smart-insights :is(button,a) { display:inline-flex; min-height:2.5rem; flex:0 0 auto; align-items:center; gap:.45rem; border:1px solid var(--rawaj-border); border-radius:.85rem; padding:.48rem .7rem; color:var(--rawaj-text-secondary); background:rgba(255,255,255,.03); font-size:.7rem; font-weight:800; }
.rawaj-owner-smart-insights svg { width:.95rem; height:.95rem; }
.rawaj-owner-smart-insights [data-tone="danger"] { color:#f2aaa4; border-color:rgba(234,113,104,.25); background:rgba(234,113,104,.08); }
.rawaj-owner-smart-insights [data-tone="warning"] { color:#f4d4a0; border-color:rgba(227,160,75,.25); background:rgba(227,160,75,.08); }
.rawaj-owner-smart-insights [data-tone="info"] { color:var(--rawaj-accent-cyan); border-color:rgba(105,217,236,.2); background:rgba(105,217,236,.06); }
.rawaj-owner-workspace-sticky { position:sticky; z-index:20; top:calc(var(--rawaj-header-height,4rem) + .35rem); display:grid; gap:.45rem; border:1px solid var(--rawaj-border); border-radius:1.05rem; padding:.5rem; background:color-mix(in srgb,var(--rawaj-surface) 94%,transparent); box-shadow:0 12px 28px rgba(0,0,0,.18); backdrop-filter:blur(18px); }
.rawaj-owner-listings-toolbar { display:grid; grid-template-columns:minmax(14rem,1fr) repeat(2,minmax(9rem,auto)) auto auto auto; gap:.42rem; align-items:center; }
.rawaj-owner-listings-toolbar__search,.rawaj-owner-listings-toolbar__select { display:flex; min-width:0; min-height:2.5rem; align-items:center; gap:.42rem; border:1px solid var(--rawaj-border); border-radius:.8rem; padding:0 .65rem; background:rgba(255,255,255,.025); }
.rawaj-owner-listings-toolbar__search input,.rawaj-owner-listings-toolbar__select select { width:100%; min-width:0; border:0; outline:0; color:var(--rawaj-text-primary); background:transparent; font-size:.7rem; font-weight:700; }
.rawaj-owner-listings-toolbar__select-visible,.rawaj-owner-listings-toolbar__add { display:inline-flex; min-height:2.5rem; align-items:center; justify-content:center; gap:.35rem; border:1px solid var(--rawaj-border); border-radius:.8rem; padding:0 .65rem; color:var(--rawaj-text-secondary); background:rgba(255,255,255,.03); font-size:.68rem; font-weight:800; }
.rawaj-owner-listings-toolbar__count { white-space:nowrap; color:var(--rawaj-text-muted); font-size:.66rem; font-weight:700; }
.rawaj-owner-bulk-actions { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:.55rem; align-items:center; border:1px solid rgba(105,217,236,.18); border-radius:.85rem; padding:.55rem .65rem; background:rgba(105,217,236,.05); }
.rawaj-owner-bulk-actions__controls { display:flex; flex-wrap:wrap; gap:.35rem; justify-content:flex-end; }
.rawaj-owner-bulk-actions__controls :is(select,button) { min-height:2.3rem; border:1px solid var(--rawaj-border); border-radius:.72rem; padding:0 .6rem; color:var(--rawaj-text-secondary); background:rgba(255,255,255,.035); font-size:.65rem; font-weight:800; }
.rawaj-owner-workspace-feedback { margin:0!important; border:1px solid rgba(105,217,236,.2); border-radius:.85rem; padding:.65rem .8rem; color:var(--rawaj-text-secondary); background:rgba(105,217,236,.06); font-size:.72rem; font-weight:700; }
.rawaj-owner-listing-select { position:absolute; z-index:3; top:.55rem; inset-inline-end:.55rem; display:grid; width:2.15rem; height:2.15rem; place-items:center; border:1px solid rgba(255,255,255,.2); border-radius:.68rem; color:#fff; background:rgba(21,22,26,.72); backdrop-filter:blur(8px); }
.rawaj-owner-listing-select[data-selected="true"] { border-color:rgba(105,217,236,.4); color:var(--rawaj-accent-cyan); background:rgba(22,73,82,.82); }
.rawaj-owner-load-more { display:flex; min-height:2.8rem; width:min(100%,22rem); align-items:center; justify-content:center; margin:.85rem auto 0; border:1px solid var(--rawaj-border); border-radius:.9rem; color:var(--rawaj-text-secondary); background:rgba(255,255,255,.03); font-size:.75rem; font-weight:800; }
@media(max-width:640px){.rawaj-owner-workspace-sticky{top:calc(var(--rawaj-header-height,3.5rem) + .2rem);margin-inline:-.15rem;padding:.4rem}.rawaj-owner-listings-toolbar{display:flex;flex-wrap:wrap}.rawaj-owner-listings-toolbar__search{flex:1 0 100%}.rawaj-owner-listings-toolbar__select{flex:1 1 calc(50% - .25rem)}.rawaj-owner-bulk-actions{grid-template-columns:1fr}}
'''
css.write_text(styles)
