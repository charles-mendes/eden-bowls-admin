# Tasks

Apply after the sibling backend change `admin-market-scoping` exposes `/admin/me` `markets`, `market` on invite/roles, `customerProfileInScope`, and `GET /admin/markets/conflicts`. Do not edit `eden-bowls` or `eden-bowls-backend` in this apply.

## 1. Session identity

- [x] 1.1 Add `src/lib/markets.ts` with `sessionMarkets`, `hasBothMarkets`, `defaultMarket`, `stripeAccountForMarket`, and `currencyForMarket`. Verify with `npx vitest run src/lib/markets.test.ts` (admin both → default BR; operator `["US"]` → US/`us`/`USD`; empty markets → no out-of-scope default).
- [x] 1.2 Extend `AdminUser` with `markets` and set fixtures (`adminUser` both, operator/readonly/nutritionist one market, `market.br`/`market.us` on permissions only as API-derived strings — not in `ROLE_OPTIONS`). Verify `npx vitest run --related src/contexts/AuthContext.tsx src/lib/roles.ts` still bootstraps from `/admin/me` and does not write markets to `localStorage`.

## 2. Staff assignment

- [x] 2.1 Add required Mercado select to the Users access dialog (hidden for role `admin`; required for operator/readonly/nutritionist). Create/PATCH bodies include `market` only for non-admin. Preserve allowlist lock. Verify `npx vitest run --related src/pages/UsersPage.tsx` (invite without market does not call the API; invite operator US sends `market: "US"`; list `403 market_required` shows `div.alert` and not an empty success table).
- [x] 2.2 Add the same Mercado field on Roles save (`PUT` `{ role, market }` for non-admin). Verify `npx vitest run --related src/pages/RolesPage.tsx` (admin save omits `market`; allowlist still disables the form).

## 3. Locked pickers

- [x] 3.1 Constrain catalog, billing, feedbacks, privacy, shipping, business-rules, and nutrition pickers to `sessionMarkets`; omit “todas”/the other country for single-market staff; replace billing/business-rules free-text market with the select. Verify `npx vitest run --related src/pages/ProductsPage.tsx src/pages/BillingPage.tsx src/pages/FeedbacksPage.tsx src/pages/FeedbackFormPage.tsx src/pages/PrivacyRequestsPage.tsx src/pages/ShippingPage.tsx src/pages/NutritionSimulatePage.tsx src/pages/BusinessRulesPage.tsx` (operator BR never requests `market=US`, `account=us`, or `country=US`; nutrition country is locked).
- [x] 3.2 Default Coupons account from the session market (`br`/`us`), not `us`. Verify `npx vitest run --related src/pages/CouponsPage.tsx` (operator BR first load is `account=br`).

## 4. Dashboard and conflicts

- [x] 4.1 Drive dashboard catalog health from the session market (`BR`/`BRL`, `US`/`USD`) with an admin-only market select when `hasBothMarkets`. Verify `npx vitest run --related src/pages/DashboardPage.tsx` (operator US requests `market=US&currency=USD`; copy is not hardcoded Brasil unless that is the selection).
- [x] 4.2 Add the admin-only conflitos `Section` loading `GET /admin/markets/conflicts` in a separate try so metrics/health still render; mock the route. Verify `npx vitest run --related src/pages/DashboardPage.tsx` (admin sees a row; operator does not request the endpoint; empty copy is “Nenhum conflito perfil vs Stripe.”).

## 5. Ledger identity and production queue

- [x] 5.1 Gate Cliente and 360 on `customerProfileInScope === true` in `SubscriptionDetailPage` (and billing list if it links customers). Snapshot email/name only. Verify `npx vitest run --related src/pages/SubscriptionDetailPage.tsx src/pages/BillingPage.tsx` (false/omitted → text without `href` to `/users/` or `/onboarding/sessions/`).
- [x] 5.2 Update `ProductionQueuePage`: Cliente from ledger snapshot (not WordPress `displayName`); account filter follows session markets; Assinante/Cliente and Onboarding 360 are links only when `customerProfileInScope === true`. Verify `npx vitest run --related src/pages/ProductionQueuePage.tsx` (operator BR has no US/todas option; out-of-scope row shows identity as text without `href` to `/users/` or `/onboarding/sessions/`).

## 6. Playwright

- [x] 6.1 Extend `e2e/helpers/mockAdminApi.ts` with `markets` and `customerProfileInScope`, then update touched specs: users invite/roles market, catalog/billing/feedbacks locked filters, production account + 360, dashboard health. Verify `npx playwright test e2e/specs/admin-users.spec.ts e2e/specs/admin-catalog.spec.ts e2e/specs/admin-billing.spec.ts e2e/specs/admin-feedbacks.spec.ts e2e/specs/admin-production.spec.ts --workers=4`.
- [x] 6.2 If readonly filters or production actions changed, extend `e2e/specs/admin-readonly.spec.ts` so readonly still has no mutations and cannot pick the other market. Verify `npx playwright test e2e/specs/admin-readonly.spec.ts --workers=4`.
