# RAWAJ Master Defect Register

This register is the launch-program source of truth. Detailed evidence, root cause, affected objects, tests, acceptance criteria, Production state, closing PR, and post-merge verification are added as each item is investigated.

| ID | Title | Severity | Initial evidence | Status |
|---|---|---:|---|---|
| DB-01 | Duplicate migration versions | Blocker | I/R pending inventory | Open |
| DB-02 | Production schema drift | Blocker | S | Open |
| DB-03 | Missing canonical migration ledger | High | R | In progress |
| SEC-01 | Missing full role/RLS test matrix | Blocker | R/T pending | Open |
| SEC-02 | UI and database role-status mismatch | High | I/S/T | Open |
| SEC-03 | Sensitive audit not always atomic | High | I/S/T | Open |
| SEC-04 | CSP hardening | Medium | R/P pending | Open |
| SEC-05 | Storage negative tests missing | High | T/S | Open |
| TRUST-01 | Seller listing count can be truncated | High | I/R/T | Open |
| TRUST-02 | Seller review summary can be inaccurate | High | I/R/T | Open |
| TRUST-03 | Trust summary missing from listing detail | Medium | R/P | Open |
| ALERT-01 | Saved-search alerts are not truly scheduled | High | I/R/S | Open |
| ALERT-02 | Saved-search N+1 scanning | Medium | I/R/T | Open |
| CHAT-01 | No proven realtime messaging | High | R/A/T | Open |
| CHAT-02 | Message history fixed limit | High | I/R/T | Open |
| CHAT-03 | Archived/expired listing conversation state | Medium | A/T | Open |
| LISTING-01 | Primary image not guaranteed in first render | High | I/R/P | Open |
| LISTING-02 | Expiring signed URLs used for public/social images | High | I/R/P | Open |
| LISTING-03 | Related listings missing | Medium | R/P | Open |
| LISTING-04 | Reporting reason too generic | Medium | R/A | Open |
| CREATE-01 | Missing image optimization pipeline | High | R/A/D | Open |
| CREATE-02 | Missing image reorder and primary selection | Medium | R/A | Open |
| CREATE-03 | Orphan file cleanup unproven | Medium | S/A/T | Open |
| AUTH-01 | Account deletion missing | High | R/A/S | Open |
| AUTH-02 | Production auth settings need verification | High | S/A/D | Open |
| ADMIN-01 | Listing reports lack human context | High | R/A | Open |
| ADMIN-02 | Review queue lacks context | High | R/A | Open |
| ADMIN-03 | Missing pagination in admin queues | High | I/R/A | Open |
| ADMIN-04 | Stale moderation protection | High | I/R/T | Open |
| ADMIN-05 | Listing management fragmented | Medium | R/A | Open |
| PERF-01 | Public pages render loading shells | High | I/R/P | Open |
| PERF-02 | Query waterfalls and repeated reference fetches | High | I/R/P | Open |
| PERF-03 | Seller profile expensive and incorrectly bounded | High | I/R/P/T | Open |
| PERF-04 | No real performance budgets | Medium | R/P | Open |
| SEO-01 | Static sitemap incomplete | High | I/R/P | Open |
| SEO-02 | Language and direction client-only | Medium | I/R/P | Open |
| SEO-03 | Expired/deleted listing strategy undefined | Medium | R/P | Open |
| A11Y-01 | iPhone input zoom | Medium | I/R/D | Open |
| A11Y-02 | Dialog focus management | High | I/R/T | Open |
| A11Y-03 | Full keyboard and screen-reader audit missing | Medium | T/A | Open |
| ANDROID-01 | App links missing or unproven | High | R/D | Open |
| ANDROID-02 | OAuth and password recovery in Capacitor unproven | High | D/A | Open |
| ANDROID-03 | Offline and WebView recovery | High | R/D | Open |
| CI-01 | Quality Gate relies heavily on source-inspection contracts | High | R | Open |
| CI-02 | Stale auto-patching workflow | Medium | I/R | Open |
