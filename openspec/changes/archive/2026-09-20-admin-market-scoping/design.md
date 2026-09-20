# Design

## Context

See proposal.md for motivation. The panel already bootstraps `AdminUser` from `GET /api/v1/admin/me` on every load (`AuthContext`); only the access token is persisted. Invite and roles dialogs send `role` without `market`. Dashboard catalog health is hardcoded to `market=BR&currency=BRL`. Coupons default `account` to `us`. Billing and production always link `/users/:id` and `/onboarding/sessions/:id`. Production Cliente still expects WordPress `displayName`. Sibling backend change `admin-market-scoping` owns SQL, JWT-unchanged identity, `customerProfileInScope`, and 403/404.

Existing shell patterns to reuse: `PageFrame`, `Section`, `Dialog` + `form-grid`, `FiltersBar`, `MetricCard`, `badge-*`, `div.alert` / `div.warning`. Do not introduce a new font, palette, or marketing layout.

## Goals / Non-Goals

**Goals:**

- One session field (`markets`) driving every picker and default
- Fail closed on profile links when `customerProfileInScope` is missing
- Keep staff assignment on the current Users/Roles dialogs (labeled select next to Papel)
- Apply after the backend contract is available so `/admin/me` already returns `markets`

**Non-Goals:**

- Implementing scoping SQL or the flag in this repo
- Topbar market chip, new SPA routes, or a markets settings page
- Letting operator hold both markets
- Changing nutritionist-only shell routing (`/nutrition/simulate`)

## Decisions

### 1. Session `markets` array is the UI source of truth

Extend `AdminUser` with `markets: Array<'BR' | 'US'>` populated from `/admin/me`. Pickers and defaults read that array (helper in `src/lib/markets.ts`: `sessionMarkets`, `hasBothMarkets`, `defaultMarket`, `stripeAccountForMarket`, `currencyForMarket`). Do not persist markets next to `eden-bowls-admin-token`. Do not treat `market.br` as a grantable panel role in `roles.ts`; those strings stay API-derived permissions.

Alternative considered: infer market from `hasPermission('market.br')` only. Rejected because invite/roles need an explicit `BR`/`US` value and permissions can lag a missing array during partial deploys.

### 2. Lock options instead of sending and catching 403

Single-market staff get a disabled or single-option control; “todas” and the other country are omitted so the client never sends `market=US` / `account=us` / `country=US`. Admin keeps both plus all where that filter already exists. If the API still returns `market_forbidden` or `market_required`, show `error.message` in the existing `div.alert` and do not rewrite the query.

Screens: `DashboardPage`, `ProductsPage`, `BillingPage`, `ProductionQueuePage`, `CouponsPage` (default account = session market, not `us`), `FeedbacksPage` / `FeedbackFormPage`, `PrivacyRequestsPage`, `ShippingPage` tabs, `NutritionSimulatePage` (country locked), `BusinessRulesPage` if it remains a free-text market filter — constrain to session values.

Alternative considered: keep both options and rely on API 403. Rejected: the picker itself would leak that the other market exists as a selectable target.

### 3. Profile links fail closed on `customerProfileInScope`

Billing detail and production row actions render `<Link>` to Cliente / 360 only when the flag is strictly `true`. False or omitted → same label as `<span>` (or muted text), still showing snapshot email/name. Do not `GET /admin/users/:id` from these screens to decide.

Alternative considered: probe the customer detail and hide on 404. Rejected: extra request per row and a timing leak.

### 4. Mercado field on existing access dialogs

`UsersPage` create/edit and `RolesPage` save add a required `<select>` Mercado after Papel, using the same `form-grid` / stacked labels. Role `admin` clears and hides Mercado. PUT/POST bodies: `{ role, market }` for non-admin; `{ role }` for admin. Preserve allowlist disabled state and last-admin errors from the API.

### 5. Conflicts card is dashboard-only, admin-only

New `Section` on `DashboardPage` for `hasRole('admin')`, loading `GET /api/v1/admin/markets/conflicts`. Table columns: email, profile market, Stripe account. Empty copy: “Nenhum conflito perfil vs Stripe.” Backend sibling must expose this read (admin + both markets). If the endpoint 403s for a non-admin, the card is already not mounted.

Alternative considered: a dedicated `/settings/markets` page. Rejected: one admin card matches the plan and avoids a new menu item.

### 6. Visual system

Reuse current admin tokens: one grotesk already on the panel, gray surfaces, accent only on primary buttons, semantic badges for BR/US as `badge-info` (not store parchment/moss). No new icon set. Skeleton already used on the production table stays as-is.

## Risks / Trade-offs

- [Admin SPA ships before `/admin/me` returns `markets`] → Mitigation: tasks start after backend identity; fixtures include `markets` so tests fail closed if the field is dropped.
- [Backend omits `GET /admin/markets/conflicts`] → Mitigation: dashboard card is a named backend contract in this change; implement the route in the sibling repo before the card task, or the card shows the existing alert on failure without breaking other dashboard metrics (`Promise.all` should not abort health/metrics if conflicts fail — load conflicts in a separate try).
- [Old production spec requires WordPress `displayName`] → Mitigation: delta on `operations/production-queue` replaces that column contract.
- [Operator still types `market=US` in a leftover text input] → Mitigation: replace free-text market on billing catalog sync and business rules with the same constrained select.

## Migration Plan

1. Backend identity + write path + backfill (sibling change), flag still off.
2. Deploy this SPA: assigned staff are already scoped by API; UI stops offering the other market; admins assign Mercado on remaining staff.
3. Backend sets `ADMIN_ENFORCE_STAFF_MARKET`. Unassigned staff get `market_required` in `div.alert`.
4. Rollback: revert the SPA deploy. Assigned staff remain API-scoped; pickers would again show both markets (cosmetic leak only if the flag is still on, API still 403s).

## Open Questions

None — conflict endpoint shape can stay `{ items: [{ userId, email, profileMarket, stripeAccount }] }` without changing specs.
