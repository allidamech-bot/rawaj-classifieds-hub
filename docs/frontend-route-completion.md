# RAWAJ frontend route completion checklist

This document tracks the frontend-only product shell. Backend/Supabase work is intentionally frozen for this batch.

## Route map

| Route               | Frontend status                    | Boundary                                                                                              |
| ------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `/`                 | Complete shell                     | Homepage includes search, categories, governorates, demo listings, safety, and add-listing handoff.   |
| `/categories`       | Complete shell                     | Category counts are a UI/demo indicator; listing results open through `/listings`.                    |
| `/listings`         | Backend-dependent route            | Search, filters, sort, reset, empty, unavailable, and browse/add CTAs are present.                    |
| `/listings/$id`     | Backend-dependent route            | Detail, contact readiness, favorite/report handling, unavailable, and not-found states are present.   |
| `/add-listing`      | Backend-dependent route            | Multi-step form, signed-out, unavailable, images, review, and pending-review explanation are present. |
| `/login`            | Backend-dependent route            | Login form and account-readiness states are present; signup remains postponed.                        |
| `/profile`          | Backend-dependent route            | Signed-out/signed-in shell, account levels, my listings, and quick actions are present.               |
| `/favorites`        | Backend-dependent route            | Signed-out, empty, unavailable, browse, and add-listing handoffs are present.                         |
| `/saved-searches`   | Backend-dependent route            | Signed-out, empty, unavailable, browse, and category handoffs are present.                            |
| `/seller/$id`       | Demo/reference route               | Public seller shell is labeled as a display model until public seller schema is finalized.            |
| `/chats`            | Future route                       | Messaging is clearly marked as coming soon with a disabled composer and safety handoffs.              |
| `/promotion`        | Future route                       | Promotion packages and payment proof UI are coming soon; no live checkout is implied.                 |
| `/support`          | Future/support shell               | Help topics, FAQ, and disabled support form are present.                                              |
| `/safety`           | Complete content route             | Buyer/seller/payment/reporting guidance is present with support/prohibited links.                     |
| `/prohibited`       | Complete content route             | Prohibited categories and report/support handoffs are present.                                        |
| `/terms`            | Complete content route             | Beta-appropriate terms, moderation, and transaction boundaries are present.                           |
| `/privacy`          | Complete content route             | Beta-appropriate privacy/data explanation is present.                                                 |
| `/admin`            | Owner-only shell                   | Guarded owner/admin control center remains demo/readiness where actions are not backed.               |
| `/admin/pending`    | Owner-only backend-dependent route | Real queue area plus demo reference section are present.                                              |
| `/admin/reports`    | Owner-only backend-dependent route | Real reports area plus demo reference section are present.                                            |
| `/admin/users`      | Owner-only demo/reference route    | User/admin management is labeled demo/future.                                                         |
| `/admin/promotions` | Owner-only demo/reference route    | Promotion/payment review is labeled demo/future.                                                      |

## Primary user flows

1. Visitor lands on `/`, searches, opens `/listings`, resets filters, or browses `/categories`.
2. Visitor opens listing details, then sees safe contact/favorite/report readiness states.
3. Visitor tries account-bound actions and is handed to `/login` or a clear readiness state.
4. Signed-in user can open `/profile`, `/add-listing`, `/favorites`, and `/saved-searches`.
5. Owner opens `/admin`, then pending listings and reports through guarded admin navigation.
6. Future features such as chats, promotions, support submission, payments, and seller verification are marked clearly.

## Coming-soon surfaces

- Real signup/onboarding.
- Real messaging.
- Real support ticket submission.
- Real promotions/payment checkout.
- Public seller profile schema and production seller ratings.
- Full admin user actions, verification actions, notifications, and audit writes.

## Manual frontend QA checklist

- Check mobile width around 390px for every listed route.
- Confirm bottom navigation links to home, categories, add listing, chats, and profile/login.
- Confirm footer links point to valid public routes.
- Confirm admin links are not public and owner access remains role-based.
- Confirm public pages do not show raw technical env names or backend setup errors.
- Confirm demo/reference content is labeled as نموذج تجريبي, واجهة تمهيدية, قيد التجهيز, or قريباً.

## Later visual pass

After product structure is accepted, run a separate visual polish pass for spacing, typography rhythm, richer card states, and final brand refinement.
