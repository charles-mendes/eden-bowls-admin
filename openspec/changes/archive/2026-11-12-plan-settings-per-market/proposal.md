# Proposal

## Why

The backend change `plan-settings-per-market` moves plan days and the large-pack limit from the market's plan product to per-market plan settings (`GET/PUT /api/v1/admin/catalog/plan-settings?market=`) and stops returning them in the product detail. The panel spec still says the product page edits, shows and submits plan days and the large-pack limit, which the API will ignore.

## What Changes

- New **Plano** screen in the Loja group of the menu (`/catalog/plan`): plan days and large-pack limit of one market, with the weights the recommendation uses as pack sizes; read-only without `catalog.write`.
- The product page loses the duration and large-pack limit fields: no plan days on create, save or publish; the unsaved-changes warning covers only the plan country.
- Publishing a draft sends the plan country and `active` true, without plan days.

## Capabilities

### New Capabilities

- `operations/catalog-plan-settings`: the Plano screen per market.

### Modified Capabilities

- `operations/catalog-products`: "Detail mutations wait until the product loads" (publish body), "Missing plan days stay empty" and "Plan section edits the large-pack limit" removed, "Unsaved plan fields are visible" replaced by "Unsaved product fields are visible".

## Impact

- `src/pages/ProductDetailPage.tsx`, `src/pages/ProductsPage.tsx` (create), new `src/pages/PlanSettingsPage.tsx`, `src/App.tsx`, `src/lib/menu.ts`, fixtures, `mockAdminFetch.ts` and their tests.
- `contracts/backend-routes.json` gains the two plan-settings routes (`npm run contract:sync`).
- Paired with `eden-bowls-backend/openspec/changes/plan-settings-per-market` (`plan-settings`, `plan-packaging`); both are applied and archived together.
