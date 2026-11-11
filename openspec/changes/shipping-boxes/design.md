# Design

## Context

- `rulesOf` in `ShippingPage.tsx` sends the US rules, `package` included, on `PUT /admin/shipping/settings`. `mergeSettings` fills missing fields from `emptySettings()`. "Caixa padrão" shows only in UPS mode.
- `LabelQueuePage.fetchLabel` reads `/admin/shipments/:id/label` once per shipment, and `printLabels` makes one 4 × 6 page per image.
- `UpsPickupSection` keeps the count in step with the selected labels until the operator types.
- `ProductionQueuePage` and `CourierDeliveriesPage` render items from the API.

## Goals / Non-Goals

**Goals:**
- The panel shows and edits what the API decides. No box rule is computed in the browser.

**Non-Goals:**
- Choosing boxes by hand per order. The API's plan is the only plan.
- Checkout quote by box.

## Decisions

1. **"Caixas de envio" sits in the US rules outside the UPS-only block**, because labels are bought in either quote mode. It is two rows of `NumberField`s, one per box key, with the API's labels.
2. **`emptySettings().us.boxes` holds the deploy values**, so a response without `boxes` (an API before the backend change) shows the client's boxes and the save sends them.
3. **Printing expands each shipment into its packages before calling `printLabels`**, so one batch remains one print job, whatever the number of boxes.
4. **The pickup count sums `packages.length || 1` over the selected labels.** Operator typing still wins, as today.
5. **Errors are mapped by code** (`invalid_shipping_box`), like `invalid_dry_ice_kg`.

## Risks / Trade-offs

- [Panel released before the API] → The old API drops `us.boxes`, and shipments have no `packages`, so printing and counting fall back to one label per shipment. Release the API first.
