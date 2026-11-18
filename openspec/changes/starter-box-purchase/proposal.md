# Proposal

## Why

The backend change `starter-box-purchase` (in `eden-bowls-backend`) adds the Starter Box: an optional 10-day trial with 40% off the food, sold once per customer. The panel has to edit the Starter days and discount per market, and operators have to tell a Starter from a plan in the queues and the subscription screens.

## What Changes

- **Plano** (`/catalog/plan`) gains "Starter Box": the Starter days (1 to 30) and the Starter discount percent (1 to 90), saved with the plan settings of the market. The 422 `starter_days_invalid` and `starter_discount_percent_invalid` show Portuguese messages.
- A "Starter" badge marks Starter subscriptions in Assinantes, in the subscription detail, in the production queue, in the courier deliveries and in the UPS label queue, from the API's `plan_kind`. Nothing changes when `plan_kind` is missing (older API).
- No new route. `contracts/backend-routes.json` does not change.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `operations/catalog-plan-settings`: edits the Starter days and discount.
- `operations/production-queue`: marks Starter orders.
- `operations/subscription-detail`: marks a Starter subscription, and the subscriber list marks it too.

## Impact

- `src/pages/PlanSettingsPage.tsx`, `src/lib/productionQueue.ts`, `src/lib/billing.ts`, `src/lib/courierDeliveries.ts`, `src/pages/BillingPage.tsx`, `src/pages/SubscriptionDetailPage.tsx`, `src/pages/ProductionQueuePage.tsx`, `src/pages/CourierDeliveriesPage.tsx`, `src/pages/LabelQueuePage.tsx`, a shared `PlanKindBadge` component, `src/test/fixtures.ts`, related tests.
- Depends on the backend change. Release the API first.
