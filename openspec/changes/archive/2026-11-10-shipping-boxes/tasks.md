# Tasks

Depends on the backend change `shipping-boxes` (`eden-bowls-backend`). Release the API first. No route changes, so `npm run contract:sync` is not needed.

## 1. Boxes in the US rules

- [x] 1.1 Add `boxes: { starter: Box; monthly: Box }` (`label`, `length_in`, `width_in`, `height_in`, `empty_weight_kg`, `max_packs`) to `ShippingSettings['us']`, with the deploy values in `emptySettings()`, and include `boxes` in `rulesOf`. Verify with `npx tsc --noEmit -p tsconfig.app.json`.
- [x] 1.2 In `ShippingPage.tsx`, add "Caixas de envio" to the US rules outside the UPS-only block, retitle "Caixa padrão" to "Caixa da cotação do checkout" with its hint, and map 422 `invalid_shipping_box` to the Portuguese message. Verify with `npx vitest run src/pages/ShippingPage.test.tsx`: "Save the weighed monthly box", "Refused by the API" (with the `shippingSettingsSaveError` mock option) and "Read-only operator" (`operatorUsUser`).

## 2. Labels and pickup

- [x] 2.1 Add `packages?: Array<{ sequence; box_key; pack_count; weight_lb; tracking_number; has_label }>` to the shipment type in `src/lib/upsLabels.ts`. In `LabelQueuePage.tsx`, expand each shipment into its packages before printing, fetch `?package=N` for each, and show a created row's boxes. Verify with `npx vitest run src/pages/LabelQueuePage.test.tsx`: "Shipment with two boxes" (two fetches, two pages) and "Label bought before boxes" (one fetch without `package`).
- [x] 2.2 In `UpsPickupSection.tsx`, make the default box count the sum of `packages.length || 1` over the selected labels, and name boxes and labels separately in the confirmation. Verify with the pickup section test: "Two labels, three boxes".

## 3. Queues

- [x] 3.1 Show `boxes` on `ProductionQueuePage` items and the box count on `CourierDeliveriesPage` items, with nothing extra when `boxes` is missing. Add `boxes` to the matching fixtures. Verify with `npx vitest run src/pages/ProductionQueuePage.test.tsx src/pages/CourierDeliveriesPage.test.tsx`: "Order with two boxes" and "Two-box delivery".

## 4. Integration checks

- [x] 4.1 Run `npx vitest run --changed` and verify every related test passes. Run `npx playwright test e2e/specs/admin-readonly.spec.ts --workers=4` and verify it still passes.
