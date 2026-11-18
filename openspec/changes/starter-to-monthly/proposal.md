# Proposal

## Why

The backend change `starter-to-monthly` (in `eden-bowls-backend`) sends each Starter one invite on Day 5, counted from the expected delivery date when the delivery was not confirmed. When that happens, the operation must check the delivery: a UPS tracking that stopped, or a courier who did not mark it delivered. The panel has to show those Starters in Hoje and show the Starter's state in the subscription detail.

## What Changes

- **Hoje** gains a card "Starter sem entrega confirmada", with the count per market from `fulfillment.startersUnconfirmed`. It lists each Starter with the customer, the expected date and a link to its shipment or courier delivery. The card is hidden when the API does not send the field.
- The Starter subscription detail shows Day 1 (confirmed or expected), whether the invite was sent and on which day, and the plan confirmed from it, if any.
- No new route. `contracts/backend-routes.json` does not change.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `operations/today-overview`: the unconfirmed Starter delivery card.
- `operations/subscription-detail`: the Starter's Day 1, invite and confirmed plan.

## Impact

- `src/lib/today.ts`, `src/pages/DashboardPage.tsx`, `src/lib/billing.ts`, `src/pages/SubscriptionDetailPage.tsx`, `src/test/fixtures.ts`, related tests.
- Depends on the backend change. Release the API first.
