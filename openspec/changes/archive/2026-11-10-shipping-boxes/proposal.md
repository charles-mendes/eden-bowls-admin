# Proposal

## Why

The backend change `shipping-boxes` (in `eden-bowls-backend`) replaces the single 12 × 12 × 12″ box with the client's two boxes (Starter, up to 10 packs; monthly, up to 30). It splits each order into one or more boxes, weighs each box, and buys one UPS label with one package per box. The panel has to edit the boxes, print every box label, count the boxes of a pickup, and tell the kitchen and the courier how many boxes each order takes.

## What Changes

- Frete › Regras › EUA gains "Caixas de envio": Starter and monthly, each with dimensions (in), empty weight (kg) and maximum packs, saved with the US rules. The 422 `invalid_shipping_box` shows a Portuguese message. "Caixa padrão" stays, renamed "Caixa da cotação do checkout", with a hint that it only prices the checkout.
- The label queue prints every package label of a shipment, and a created row shows its boxes ("2 caixas: mensal 30 · mensal 15").
- The pickup box count follows the number of packages of the selected labels, not the number of labels.
- The production queue and the courier deliveries show each order's boxes.
- No new route. `contracts/backend-routes.json` does not change.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `operations/shipping-settings`: edits the US boxes.
- `operations/ups-labels`: prints every box label and counts boxes for the pickup.
- `operations/production-queue`: shows each order's boxes.
- `operations/courier-deliveries`: shows each delivery's box count.

## Impact

- `src/lib/shippingSettings.ts`, `src/pages/ShippingPage.tsx`, `src/pages/LabelQueuePage.tsx`, `src/lib/upsLabels.ts`, `src/components/shipping/UpsPickupSection.tsx`, `src/pages/ProductionQueuePage.tsx`, `src/pages/CourierDeliveriesPage.tsx`, `src/test/fixtures.ts`, `src/test/mockAdminFetch.ts`, related tests.
- Depends on the backend change `shipping-boxes`. Release the API first.
