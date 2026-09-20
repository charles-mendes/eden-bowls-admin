# Tasks

Implement sections 1–3 in `eden-bowls-backend` before any admin work in this repo (sections 4–5).

## 1. Schema and overlay (eden-bowls-backend)

- [x] 1.1 Add migration `src/infrastructure/migrations/1700000000018-create-subscription-production-cycles.js` with overlay columns/FK/UNIQUE/indexes and ledger `INDEX (status, current_period_end)` as in design.md; write `tests/subscription-production-cycles.migration.test.js` asserting table name, UNIQUE `(subscription_id, period_end)`, FK CASCADE, varchar(32) status, varchar(255) note, bigint unsigned `updated_by_user_id`, and the ledger index; verify `npx jest --runTestsByPath tests/subscription-production-cycles.migration.test.js`.
- [x] 1.2 Add entity `src/infrastructure/entities/subscription-production-cycle.entity.js` and register it plus the migration in `src/infrastructure/db.js`; verify DataSource options include the new entity schema and `CreateSubscriptionProductionCycles1700000000018`.
- [x] 1.3 Add `src/infrastructure/repositories/subscription-production.repository.js` with find-by-subscription-and-period-end and upsert; write `tests/subscription-production.repository.test.js` that mocks `query` and asserts INSERT vs UPDATE SQL on the unique key (same pattern as `tests/subscription-ledger.repository.test.js`). Unique constraint and FK are proven in 1.1, not by this mock. Verify `npx jest --runTestsByPath tests/subscription-production.repository.test.js`.

## 2. Queue SQL and presenter (eden-bowls-backend)

- [x] 2.1 Export `catalogFrom`, `packsPerMonth`, `readPets`, and `planItemsFromCatalog` from `src/core/subscription-dashboard.js` without changing mapper behavior; verify existing flavor tests still pass (`npx jest --runTestsByPath tests/subscription-dashboard.test.js`).
- [x] 2.2 Add `src/core/production-queue-presenter.js` and write `tests/production-queue-presenter.test.js` covering line items, mixed sizes (`dense` + `misto`), missing subtotal, implicit `to_prepare`, civil “vence hoje”, and dropped street/last4; verify `npx jest --runTestsByPath tests/production-queue-presenter.test.js`.
- [x] 2.3 Implement `listQueue` / queue metrics on `src/infrastructure/repositories/subscription-ledger.repository.js` (civil bounds params, `cancel_at_period_end = 0`, includeOverdue cap, `ORDER BY current_period_end ASC, id ASC`, LEFT JOIN cycles + `wp_users`); extend `tests/subscription-ledger.repository.test.js` so mocked `query` asserts those SQL fragments. Add `tests/integration/subscription-ledger-queue.integration.test.js` behind `describe.skip` unless `RUN_DB_INTEGRATION_TESTS=true` (membership window, overdue cap, CAPE excluded). Verify unit tests with `npx jest --findRelatedTests src/infrastructure/repositories/subscription-ledger.repository.js`. Do not require the integration file to pass unless that env flag is set.

## 3. API, permissions, and backend tests (eden-bowls-backend)

- [x] 3.1 Add `production.read` to readonly/operator/admin and `production.write` to operator/admin in `src/core/admin-roles.js`; verify `npx jest --runTestsByPath tests/admin-roles.test.js`.
- [x] 3.2 Add `src/api/validators/admin-production.validator.js` and `src/services/admin-production.service.js` (envelope + metrics, transition matrix, required block note, `periodEnd` 409, audit). Write `tests/admin-production.service.test.js` for happy path, `in_production → blocked` with note, missing note 400, stale `periodEnd` 409, CAPE 409, reopen ready; verify `npx jest --runTestsByPath tests/admin-production.service.test.js`.
- [x] 3.3 Register GET/PATCH `/api/v1/admin/production/queue` in `src/api/routes/admin.routes.js` and wire `AdminProductionService` in `src/index.js`. Write `tests/admin-production.routes.test.js` (supertest: 200 list envelope, PATCH 200, 403 without `production.write`); verify `npx jest --runTestsByPath tests/admin-production.routes.test.js`.

## 4. Admin screen, menu, and Vitest (eden-bowls-admin)

- [x] 4.1 Mirror `production.read` / `production.write` in `src/test/fixtures.ts` and handle GET/PATCH `/api/v1/admin/production/queue` in `src/test/mockAdminFetch.ts` with the design DTO; verify fixtures include the keys and the mock returns `metrics` + `lineItems`.
- [x] 4.2 Add Operação menu item Produção (`/operations/production`, roles admin|operator|readonly) in `src/lib/menu.ts` and route `ProductionQueuePage` in `src/App.tsx`; verify `npx vitest run src/lib/menu.test.ts` shows the href for those roles and hides it from nutritionist.
- [x] 4.3 Add `src/pages/ProductionQueuePage.tsx` (four MetricCards, filters including includeOverdue, spec grid columns, `production.write` actions, required-note Dialog, dense `lineItems` Dialog) and write `src/pages/ProductionQueuePage.test.tsx` (load KPIs/row, readonly hides status buttons, empty copy). Verify `npx vitest run --related src/pages/ProductionQueuePage.tsx`.

## 5. Playwright (eden-bowls-admin)

- [x] 5.1 Extend `e2e/helpers/mockAdminApi.ts` and add `e2e/specs/admin-production.spec.ts` that loads `/operations/production`, sees KPIs and a due row, and advances status as operator; verify `npx playwright test e2e/specs/admin-production.spec.ts --workers=4`.
- [x] 5.2 Add a readonly case in `e2e/specs/admin-readonly.spec.ts` that opens Produção, sees the queue, and has no status-advance controls; verify `npx playwright test e2e/specs/admin-readonly.spec.ts --workers=4 -g "production"`.
