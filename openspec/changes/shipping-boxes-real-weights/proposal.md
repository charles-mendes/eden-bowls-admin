# Proposal

## Why

The backend change `shipping-boxes-real-weights` (in `eden-bowls-backend`) sets the empty boxes to the weights the client measured: Starter 355 g and monthly 600 g, stored to the gram. The panel's "Peso vazio" field steps by 0.1 kg, so the browser refuses 0.355, and the panel's defaults still say 1 and 1.5 kg.

## What Changes

- "Peso vazio" in "Caixas de envio" accepts grams (step 0.001 kg) and shows three decimals.
- The panel defaults (`emptySettings()`) and fixtures use 0.355 and 0.6.
- The box hint says the weights were measured by the client and that they are sent to UPS with the food and the dry ice.
- No new route. `contracts/backend-routes.json` does not change.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `operations/shipping-settings`: the empty weight is edited to the gram.

## Impact

- `src/lib/shippingSettings.ts`, `src/lib/shippingHelp.ts`, `src/pages/ShippingPage.tsx`, `src/test/fixtures.ts`, related tests.
- Depends on the backend change. Release the API first.
