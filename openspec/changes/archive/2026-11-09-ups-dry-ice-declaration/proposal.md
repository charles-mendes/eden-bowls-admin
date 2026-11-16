# Proposal

## Why

Each US box carries 500 g of dry ice. UPS requires it declared as UN1845 on labels and quotes. The backend change `ups-dry-ice-declaration` (in `eden-bowls-backend`) adds the editable `us.package.dry_ice_kg` setting, 0.5 on deploy, and declares it to UPS. Without a field in the panel, ops can only change that weight in the database.

## What Changes

- "Caixa padrão" in the US rules (Frete › Regras › EUA) shows "Gelo seco por caixa" in kg, saved with the other US rules through the existing `PUT /api/v1/admin/shipping/settings`.
- A settings response without `dry_ice_kg` shows 0.5, the value the backend sets on deploy.
- When the API refuses the value with 422 `invalid_dry_ice_kg`, the page shows the reason in Portuguese, not the English API message.
- No new route. `contracts/backend-routes.json` does not change.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `operations/shipping-settings`: the UPS section edits the US dry ice weight per box.

## Impact

- `src/lib/shippingSettings.ts` (type and default), `src/pages/ShippingPage.tsx` (field and error message), `src/test/fixtures.ts`, `src/pages/ShippingPage.test.tsx`.
- Depends on the backend change `ups-dry-ice-declaration`. Released before the backend, the field is harmless: the old API validator drops the unknown key, and the field shows the 0.5 default.
