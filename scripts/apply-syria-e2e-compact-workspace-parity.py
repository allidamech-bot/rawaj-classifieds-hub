from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    source = path.read_text()
    if old not in source:
        raise SystemExit(f"missing E2E parity anchor in {path}: {old[:180]!r}")
    path.write_text(source.replace(old, new, 1))


critical = Path("e2e/authenticated-critical-journey.spec.ts")
replace_once(
    critical,
    '    await page.getByRole("button", { name: /^(Manage listing|إدارة الإعلان)$/ }).click();',
    '    await page.getByRole("link", { name: /^(Manage listing|إدارة الإعلان)$/ }).click();',
)

lifecycle = Path("e2e/authenticated-owner-listing-lifecycle-journey.spec.ts")

replace_once(
    lifecycle,
    '''    const markReservedButton = approvedCard.getByRole("button", {
      name: /وضع محجوز|Mark reserved/i,
    });''',
    '''    await openListingManagement(approvedCard);
    const markReservedButton = approvedCard.getByRole("button", {
      name: /وضع محجوز|Mark reserved/i,
    });''',
)

replace_once(
    lifecycle,
    '''    await reloadCurrentPage(page);
    approvedCard = ownerCard(page, APPROVED_TITLE);
    await expect(
      approvedCard.getByRole("button", { name: /إلغاء الحجز|Clear reservation/i }),
    ).toBeVisible({ timeout: 30_000 });''',
    '''    await reloadCurrentPage(page);
    approvedCard = ownerCard(page, APPROVED_TITLE);
    await openListingManagement(approvedCard);
    await expect(
      approvedCard.getByRole("button", { name: /إلغاء الحجز|Clear reservation/i }),
    ).toBeVisible({ timeout: 30_000 });''',
)

replace_once(
    lifecycle,
    '      name: /خفض السعر|Drop price/i,',
    '      name: /خفض|Reduce/i,',
)
replace_once(
    lifecycle,
    '      name: /تطبيق \\/ تجديد المدة|Apply \\/ renew duration/i,',
    '      name: /تطبيق|Apply/i,',
)
replace_once(
    lifecycle,
    'await clickTwiceInSameTick(approvedCard.getByRole("button", { name: /تم البيع|Mark sold/i }));',
    'await clickTwiceInSameTick(approvedCard.getByRole("button", { name: /تم البيع|Sold|Mark sold/i }));',
)

replace_once(
    lifecycle,
    '''    await reloadCurrentPage(page);
    approvedCard = ownerCard(page, APPROVED_TITLE);
    await expect(approvedCard.getByLabel(/السعر الجديد|New price/i)).toHaveValue(REDUCED_PRICE, {''',
    '''    await reloadCurrentPage(page);
    approvedCard = ownerCard(page, APPROVED_TITLE);
    await openListingManagement(approvedCard);
    await expect(approvedCard.getByLabel(/السعر الجديد|New price/i)).toHaveValue(REDUCED_PRICE, {''',
)

replace_once(
    lifecycle,
    '''    let closedCard = ownerCard(page, APPROVED_TITLE);
    await expect(closedCard).toBeVisible({ timeout: 30_000 });
    await expect(
      closedCard.getByRole("button", {
        name: /إعادة التفعيل للمراجعة|Reactivate for review/i,
      }),
    ).toBeVisible();''',
    '''    let closedCard = ownerCard(page, APPROVED_TITLE);
    await expect(closedCard).toBeVisible({ timeout: 30_000 });
    await openListingManagement(closedCard);
    await expect(
      closedCard.getByRole("button", {
        name: /إعادة التفعيل للمراجعة|Reactivate for review/i,
      }),
    ).toBeVisible();''',
)

replace_once(
    lifecycle,
    '''    await reloadCurrentPage(page);
    closedCard = ownerCard(page, APPROVED_TITLE);
    await expect(closedCard).toBeVisible({ timeout: 30_000 });
    await clickTwiceInSameTick(''',
    '''    await reloadCurrentPage(page);
    closedCard = ownerCard(page, APPROVED_TITLE);
    await expect(closedCard).toBeVisible({ timeout: 30_000 });
    await openListingManagement(closedCard);
    await clickTwiceInSameTick(''',
)

replace_once(
    lifecycle,
    '''    const draftCard = ownerCard(page, DRAFT_TITLE);
    await expect(draftCard).toBeVisible({ timeout: 30_000 });
    await clickTwiceInSameTick(''',
    '''    const draftCard = ownerCard(page, DRAFT_TITLE);
    await expect(draftCard).toBeVisible({ timeout: 30_000 });
    await openListingManagement(draftCard);
    await clickTwiceInSameTick(''',
)

replace_once(
    lifecycle,
    '''async function openOwnerTab(
  page: Page,
  tab: "approved" | "pending" | "needs_edit" | "closed",
): Promise<void> {''',
    '''async function openListingManagement(card: Locator): Promise<void> {
  const manageButton = card.getByRole("button", {
    name: /إدارة الإعلان|Manage listing/i,
  });
  await expect(manageButton).toBeVisible({ timeout: 30_000 });
  if ((await manageButton.getAttribute("aria-expanded")) !== "true") {
    await manageButton.click();
  }
  await expect(manageButton).toHaveAttribute("aria-expanded", "true");
}

async function openOwnerTab(
  page: Page,
  tab: "approved" | "pending" | "needs_edit" | "closed",
): Promise<void> {''',
)
