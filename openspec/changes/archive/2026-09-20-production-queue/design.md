# Design

## Context

See `proposal.md` for motivation and `specs/operations/production-queue/spec.md` for behavior. Assinantes still lists `stripe_subscriptions` with `status=active` exact and `ORDER BY updated_at DESC`. Billing `renewing7d` still does `SELECT *` in Node. Onboarding already LEFT-joins `wp_users.display_name`. Packs/flavors live in `plan_selection` JSON. Latest migration is `1700000000017`. OpenSpec lives in this admin repo; schema and API land in sibling `eden-bowls-backend`.

`subscription-dashboard.js` currently exports only `mapLedgerToDashboardListItem`, `mapLedgerToDashboardDetail`, and `mapLedgerToActionSummary`. `catalogFrom`, `packsPerMonth`, `readPets`, and `planItemsFromCatalog` exist in that file but are not exported. Ledger `id` is `int unsigned` (migration `0009`). `admin_audit_events.actor_user_id` is `bigint unsigned` with no FK to `wp_users`.

Constraints: reuse `PageFrame` / `MetricCard` / `FiltersBar` / `Pager` / `Dialog` / `apiRequest` / `parsePageQuery` / `paginatedEnvelope` / `AdminAuditService` / `requirePermission`. Do not add TanStack Query or a second HTTP client. Do not use MySQL `CONVERT_TZ`.

## Goals / Non-Goals

**Goals:**

- Compute civil-day bounds in the service (Intl) and pass UTC naive datetimes into SQL so membership matches “vence hoje” even after the timestamp has passed.
- Keep production status off the Stripe ledger; persist a cycle only on first successful PATCH.
- Return KPIs in the same GET envelope; paginate with a stable `id` tie-break.
- Flatten packs/flavors in-process from JSON already selected for the page (no N+1).
- Optimistic PATCH: client sends `periodEnd`; mismatch with live `current_period_end` is 409.

**Non-Goals:**

- Changing `GET /admin/billing/subscriptions` or in-memory `renewing7d`.
- Rewriting storefront dashboard mappers beyond exporting the four helpers above.
- Lead time, UPS auto-`ready`, Woo order states, or a production block on `SubscriptionDetailPage`.
- Per-kitchen US timezone in v1 (query `timezone` exists; default remains `America/Sao_Paulo`).
- Different DTO shapes for readonly vs operator.

## Decisions

### 1. New `/admin/production/*` resource, not a Billing filter

Assinantes is a ledger browser. The queue needs civil-window membership, overlay status, flattened projection, and calendar KPIs. Extending the existing GET would couple two UIs to one contract.

**Alternative considered:** add `windowDays` to billing list. Rejected: still dumps JSON, still wrong sort, still mixes sync UI.

### 2. Overlay table keyed by `(subscription_id, period_end)`

`subscription_production_cycles` stores only kitchen workflow. List uses `LEFT JOIN` on `c.subscription_id = s.id AND c.period_end = s.current_period_end` and `COALESCE(c.status, 'to_prepare')`. Absence of a row is implicit `to_prepare`. When webhooks move `current_period_end`, the old cycle falls out of the JOIN.

Schema (migration `1700000000018`):

| column | type | notes |
| --- | --- | --- |
| `id` | int unsigned PK AI | |
| `subscription_id` | int unsigned NOT NULL | FK → `stripe_subscriptions.id` ON DELETE CASCADE |
| `period_end` | datetime NOT NULL | identity of the cycle; UTC naive like the ledger |
| `status` | varchar(32) NOT NULL | `to_prepare` \| `in_production` \| `ready` \| `blocked` — not ENUM |
| `note` | varchar(255) NULL | required 1–255 only when transitioning to `blocked` |
| `updated_by_user_id` | bigint unsigned NULL | matches `admin_audit_events.actor_user_id`; no FK to `wp_users` |
| `created_at` / `updated_at` | datetime | |

UNIQUE `(subscription_id, period_end)`. INDEX `(status)`, INDEX `(period_end)`. Same migration adds `INDEX idx_stripe_subscriptions_status_period_end ON stripe_subscriptions (status, current_period_end)`.

VARCHAR over ENUM so new statuses do not require an ALTER. FK CASCADE so deleting a ledger row (rare) cannot orphan cycles. No FK to `wp_users` because audit already skips that.

**Alternative considered:** columns on `stripe_subscriptions`. Rejected: one row cannot survive period rolls. **Alternative considered:** ENUM status. Rejected: migrations are heavier. **Alternative considered:** no FK. Rejected: overlay is meaningless without the ledger row.

### 3. Civil bounds in Node, UTC comparison in SQL

Do not rely on MySQL timezone tables. `AdminProductionService` resolves `timezone` (default `America/Sao_Paulo`) and computes:

- `startOfToday` — midnight of the civil today in that zone, as UTC naive `YYYY-MM-DD HH:mm:ss`
- `windowEndExclusive` — `startOfToday` plus `windowDays` calendar days (a 7-day window is today through today+6)
- `overdueFloor` — `startOfToday` minus `windowDays` calendar days

`listQueue` membership:

```
s.status IN ('active','trialing','past_due')
AND s.cancel_at_period_end = 0
AND s.current_period_end IS NOT NULL
AND (
  (s.current_period_end >= :startOfToday AND s.current_period_end < :windowEndExclusive)
  OR (
    :includeOverdue
    AND s.current_period_end >= :overdueFloor
    AND s.current_period_end < :startOfToday
    AND COALESCE(c.status,'to_prepare') <> 'ready'
  )
)
```

`includeOverdue` is a query param, default true (`1`/`true`/`0`/`false`, same style as other admin flags). Civil-today rows stay in the first branch even when `current_period_end < UTC_TIMESTAMP()`, so `includeOverdue=0` does not hide “vence hoje”.

`ORDER BY s.current_period_end ASC, s.id ASC` plus `LIMIT/OFFSET`. `q` reuses billing LIKE on email / `stripe_subscription_id` / `stripe_customer_id` / `user_id`. `account` filters `stripe_account`. Select `plan_selection`, `address` (city/country only in the presenter), `plan_label`, `subscription_term_months`, `cancel_at_period_end`, `status` — never `payment_method_last4`. LEFT JOIN `wp_users` for `display_name`.

**Alternative considered:** membership `period_end > UTC_TIMESTAMP()`. Rejected: this morning’s dues would fall into overdue and vanish when the toggle is off.

### 4. Presenter + exported dashboard helpers

`production-queue-presenter.js` maps a ledger row to the grid DTO. Export from `subscription-dashboard.js` (do not copy, do not change mapper behavior): `catalogFrom`, `packsPerMonth`, `readPets`, `planItemsFromCatalog`. After that export, run existing `tests/subscription-dashboard.test.js`. Flavor mix and `lineItems` come from catalog `line_items` when present, else pet `selected_flavors` / `flavor_weights`. `dense` is `lineItems.length > 3 || packSizeLabel === 'misto'`. `subtotal` is `catalog_pricing.subtotal` or `null`. Country/city from `address`; street and postal code dropped.

### 5. GET envelope and metrics

`GET /api/v1/admin/production/queue` (`production.read`). Query: `windowDays` (7\|14\|30, default 7), `includeOverdue` (default true), `account`, `productionStatus`, `q`, `timezone`, `page`, `perPage` (via `parsePageQuery`, default 20, max 100).

Service returns `{ ...paginatedEnvelope({ items, total, page, perPage }), metrics }`. Metrics are a second lightweight query with the same membership **except** `q` and `productionStatus` — they still apply `windowDays`, `account`, and `includeOverdue`. Select only `current_period_end` (+ cycle join for overdue-ready exclusion). Bucket in JS with the same Intl civil dates: `today` (`daysUntil === 0`), `tomorrow` (`1`), `upcoming` (`> 1` inside the window), `overdue` (`< 0`). When `includeOverdue=0`, `metrics.overdue` is 0.

Example:

```json
{
  "total": 2,
  "page": 1,
  "perPage": 20,
  "totalPages": 1,
  "metrics": { "today": 1, "tomorrow": 0, "upcoming": 1, "overdue": 0 },
  "items": [
    {
      "id": 42,
      "userId": "7",
      "stripeSubscriptionId": "sub_123",
      "currentPeriodEnd": "2026-09-20T08:00:00.000Z",
      "daysUntil": 0,
      "dueBucket": "today",
      "dueLabel": "Vence hoje",
      "displayName": "Ana Costa",
      "email": "ana@edenbowls.com",
      "flavorMix": "beef × 2, turkey × 1",
      "packCount": 3,
      "packSizeLabel": "500 g",
      "planLabel": "Plano adulto",
      "termMonths": 1,
      "country": "BR",
      "city": "São Paulo",
      "stripeStatus": "active",
      "productionStatus": "to_prepare",
      "note": null,
      "subtotal": 189.9,
      "currency": "BRL",
      "stripeAccount": "br",
      "dense": false,
      "lineItems": [
        { "flavor": "beef", "quantity": 2, "packSize": "500 g", "petName": "Luna" },
        { "flavor": "turkey", "quantity": 1, "packSize": "500 g", "petName": "Luna" }
      ]
    }
  ]
}
```

Readonly and operator receive this same shape. Never include last4, street, or postal code.

### 6. PATCH status machine

`PATCH /api/v1/admin/production/queue/:id` (`production.write`). `:id` is ledger id. Body `{ status, periodEnd, note? }`. Normalize `periodEnd` to the same UTC naive datetime as `current_period_end`; if they differ, `HttpError` 409 (webhook rolled the cycle). If the row is no longer queue-eligible (`canceled`, `cancel_at_period_end`, missing period end, etc.), 409. Missing cycle is `to_prepare`. Transition matrix is in the spec; illegal edges are 400. `blocked` requires `note` length 1–255; other statuses do not. Upsert cycle with `period_end = current_period_end`, `updated_by_user_id` from `request.adminIdentity`. Audit `production.status.update` via `AdminAuditService.record`. Response 200 is the updated queue item DTO.

```json
{
  "status": "blocked",
  "periodEnd": "2026-09-20T08:00:00.000Z",
  "note": "Falta estoque de peru"
}
```

Wire `AdminProductionService` in `src/index.js` next to billing; register routes beside billing in `admin.routes.js`. Validator: `admin-production.validator.js`.

### 7. Admin page clones Onboarding 360

`ProductionQueuePage` under `RequireAuth`. Menu after Onboarding 360: `{ label: 'Produção', href: '/operations/production', roles: ['admin', 'operator', 'readonly'] }`. Writes gated with `hasPermission('production.write')`. Four `MetricCard`s: Vence hoje, Amanhã, Próximos Nd, Atrasados. Filters include `includeOverdue`. Section headers when `dueBucket` changes on the current page. Dialog for required block note and for dense `lineItems` (no extra GET). Send `timezone: getBrowserTimeZone()`; server default stays `America/Sao_Paulo`.

### 8. Permissions and tests

`production.read` on readonly/operator/admin; `production.write` on operator/admin. Mirror in admin fixtures, `mockAdminFetch`, and e2e profiles.

Backend: mocked `query` tests assert SQL fragments (including `ORDER BY` / unique upsert). Add `tests/integration/subscription-ledger-queue.integration.test.js` behind `RUN_DB_INTEGRATION_TESTS=true` (skip otherwise). Migration test asserts UNIQUE + FK + ledger index. After exporting helpers, run `tests/subscription-dashboard.test.js`. Do not run the full Jest suite. Admin: Vitest on the page + `menu.test.ts`; Playwright `admin-production` + readonly case.

Cross-repo apply order: backend tasks 1→3, then admin 4→5.

## Risks / Trade-offs

- **CAPE excluded** → last billed cycle does not appear. Accepted: kitchen does not prepare canceling renewals. Past-due still does.
- **Webhook rolls `current_period_end`** → in-flight PATCH 409. UI refetches; no carry-forward of `in_production`.
- **Civil window of N days is today..today+(N-1)** → slightly different from a rolling `now+N` UTC hour window. Accepted so “vence hoje” is stable.
- **Same DTO for readonly** → email may appear as name fallback. Mitigated by dropping street/zip/last4.
- **MySQL integration skipped by default** → unit tests still assert SQL strings; real engine uniqueness/FK only when the flag is on.
- **OpenSpec `allowedEditRoots` is admin** → backend files are still required; implement them in `eden-bowls-backend` first.

## Migration Plan

1. Backend migration `0018` + entity/repo/presenter/service/routes/permissions.
2. Deploy backend before or with the admin page; GET/PATCH 404 until then.
3. No data backfill: empty overlay is `to_prepare`.
4. Rollback: drop overlay table (FK) and ledger index; remove routes/UI. Ledger JSON untouched.

## Open Questions

None. US kitchen timezone remains a later use of the existing `timezone` query param.
