# RAWAJ redesign coverage

Source inventory for the local redesign based on main edc31c8. Acceptance requires rendered evidence.

## Active remediation in PR #857

- The canonical light canvas is now applied to the application shell, browser theme color, contextual header, and footer at their existing ownership points; no new late-loaded override stylesheet was added.
- Shared card, badge, menu, dialog, and data-table legacy dark values have been replaced with semantic surface/foreground tokens in the original shared component stylesheet.
- The Categories acceptance contract now targets the new directory components rather than retired atlas classes.
- These changes remain **unverified until CI and rendered visual acceptance pass**. Do not mark the affected rows Accepted based on source edits alone.
- Other route families shown as Pending below have **not** been redesigned or accepted in this batch.
- Shared component badges/buttons and the previous /more and /profile CSS legacy palette now use semantic light/status tokens; all affected rendered states remain subject to acceptance.



| Route or state | Role | Family | Implementation source | Status | Visual evidence | Responsive | RTL/LTR | Accessibility | Functional regression | Acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/activity` | Buyer / seller | Account | `src/routes/activity.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/add-listing` | Seller | Seller | `src/routes/add-listing.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/admin/ad-placements` | Administrator | Administration | `src/routes/admin.ad-placements.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/admin/audit` | Administrator | Administration | `src/routes/admin.audit.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/admin/campaigns` | Administrator | Administration | `src/routes/admin.campaigns.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/admin/data-quality` | Administrator | Administration | `src/routes/admin.data-quality.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/admin/` | Administrator | Administration | `src/routes/admin.index.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/admin/listings` | Administrator | Administration | `src/routes/admin.listings.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/admin/message-reports` | Administrator | Administration | `src/routes/admin.message-reports.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/admin/notifications` | Administrator | Administration | `src/routes/admin.notifications.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/admin/owner-controls` | Administrator | Administration | `src/routes/admin.owner-controls.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/admin/pending` | Administrator | Administration | `src/routes/admin.pending.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/admin/promotions` | Administrator | Administration | `src/routes/admin.promotions.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/admin/reports` | Administrator | Administration | `src/routes/admin.reports.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/admin/reviews` | Administrator | Administration | `src/routes/admin.reviews.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/admin/safety` | Administrator | Administration | `src/routes/admin.safety.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/admin` | Administrator | Administration | `src/routes/admin.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/admin/users` | Administrator | Administration | `src/routes/admin.users.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/admin/verifications` | Administrator | Administration | `src/routes/admin.verifications.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/auth/callback` | Buyer / seller | Account | `src/routes/auth.callback.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/categories` | Public | Marketplace | `src/routes/categories.tsx` | Local search and taxonomy cards migrated | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/category/$slug` | Public | Marketplace | `src/routes/category.$slug.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/chats` | Buyer / seller | Account | `src/routes/chats.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/favorites` | Buyer / seller | Account | `src/routes/favorites.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/` | Public | Marketplace | `src/routes/index.tsx` | Local search, categories and listing cards migrated | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/listings/$id` | Public | Marketplace | `src/routes/listings.$id.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/listings/` | Public | Marketplace | `src/routes/listings.index.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/listings` | Public | Marketplace | `src/routes/listings.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/login` | Buyer / seller | Account | `src/routes/login.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/more` | Buyer / seller | Account | `src/routes/more.tsx` | Local workspace migrated | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/notifications` | Buyer / seller | Account | `src/routes/notifications.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/offers` | Public | Marketplace | `src/routes/offers.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/privacy` | Public | Trust | `src/routes/privacy.tsx` | Legal reading layout rebuilt; acceptance pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/profile/listings` | Seller | Seller | `src/routes/profile/listings.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/profile/listings_/$id` | Seller | Seller | `src/routes/profile/listings_.$id.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/profile` | Buyer / seller | Account | `src/routes/profile.tsx` | Local identity and shortcut migration | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/prohibited` | Public | Trust | `src/routes/prohibited.tsx` | Prohibited policy layout rebuilt; acceptance pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/promotion-request` | Seller | Seller | `src/routes/promotion-request.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/promotion` | Seller | Seller | `src/routes/promotion.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/reset-password` | Buyer / seller | Account | `src/routes/reset-password.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/safety` | Public | Trust | `src/routes/safety.tsx` | Shared safety layout rebuilt; acceptance pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/saved-searches` | Buyer / seller | Account | `src/routes/saved-searches.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/seller/$id` | Public | Marketplace | `src/routes/seller.$id.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/support` | Public | Trust | `src/routes/support.tsx` | Shared support layout rebuilt; acceptance pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/syria/$slug` | Public | Marketplace | `src/routes/syria.$slug.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/terms` | Public | Trust | `src/routes/terms.tsx` | Legal reading layout rebuilt; acceptance pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `/verification` | Seller | Seller | `src/routes/verification.tsx` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `Shared mobile dock` | Public / signed-in | Shell | `BottomDock` | Local migration | Pending | Pending | Pending | Pending | Pending | Unverified |
| `My Store management at 480, 500, 520px` | Owner | Seller | `MyStoreIdentity / Dialog` | Browser test authored, unrun | Pending | Pending | Pending | Pending | Pending | Unverified |
| `Advanced filters open` | Public | Marketplace | `Filter sheet` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `Chat with keyboard open` | Buyer / seller | Account | `Chat composer / shell` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `Listing upload and validation` | Seller | Seller | `Listing studio` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
| `Moderation confirmation` | Administrator | Administration | `Admin dialog` | Pending | Pending | Pending | Pending | Pending | Pending | Unverified |
