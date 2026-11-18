# Proposal

## Why

The backend change `us-company-paid-shipping` (in `eden-bowls-backend`) makes US shipping charges a switch, off on deploy: while off, the customer pays 0 and the UPS quote is the company's cost; while on, the customer pays the quote as today. The client asked that an admin or a US operator turn it on and off in the panel, with a history of when it changed and by whom. Brazil keeps charging one fee per order, as today.

## What Changes

- Frete › Regras › EUA gains "Cobrar frete do cliente", an on/off switch saved as `us.charge_shipping` with the other US rules. Changing it asks for confirmation and says that it applies to new checkouts only: each subscription keeps the condition it was checked out with. A 422 `invalid_charge_shipping` shows a Portuguese message.
- Below the switch, "Histórico" lists `us.charge_shipping_history`: date and time in the US market's time zone (America/New_York), who, and "Cobrança ligada" or "Cobrança desligada", newest first.
- A US-only operator with `shipping.write` can use the switch. Without `shipping.write` it is read-only, with the history visible.
- The US simulation shows the quote and what the customer pays under the current switch ("Cliente paga: FREE" or the amount).
- Frete › Regras › Brasil does not change.
- The US subscription detail shows whether its shipping is free ("Frete grátis para o cliente, pago pela empresa") with the stored company cost, or charged.
- No new route. `contracts/backend-routes.json` does not change.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `operations/shipping-settings`: the US charge switch and its history, the US simulation.
- `operations/subscription-detail`: the subscription's shipping condition and company cost.

## Impact

- `src/lib/shippingSettings.ts`, `src/lib/shippingHelp.ts`, `src/pages/ShippingPage.tsx`, `src/components/NutritionEditLog.tsx` (optional `timeZone`), `src/lib/billing.ts`, `src/pages/SubscriptionDetailPage.tsx`, `src/test/fixtures.ts`, `src/test/mockAdminFetch.ts`, related tests.
- Depends on the backend change. Release the API first.
