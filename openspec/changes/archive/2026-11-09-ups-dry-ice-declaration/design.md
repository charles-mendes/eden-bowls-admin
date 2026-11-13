# Design

## Context

`rulesOf` in `src/pages/ShippingPage.tsx` already sends `us.package` whole on `PUT /admin/shipping/settings`. `mergeSettings` in `src/lib/shippingSettings.ts` fills missing package fields from `emptySettings()`. The four package fields are `NumberField`s in the "Caixa padrão" fieldset, disabled without `canWrite`. `saveRules` shows `requestError.message`, which for this 422 is the English API text. `ApiRequestError` exposes `code`, as `brQuoteError` already uses.

## Goals / Non-Goals

**Goals:**
- One field, saved through the existing payload with no new request.

**Non-Goals:**
- Copying the range rule into the browser. The API owns the rule (0.1 to 2.5 kg, one decimal place, no heavier than the box) and its 422. A second copy would drift.
- Showing the UPS dry ice surcharge. It is already part of the quote returned by the simulation.

## Decisions

1. **Add `dry_ice_kg` to the `package` type, with 0.5 in `emptySettings()`.** `mergeSettings` then covers an API that does not send it yet, and `rulesOf` sends it without edits.
2. **Render the field as its own row under the four package fields**, rather than a fifth column in `ship-fields-4`, so the grid stays as it is. Unit suffix "kg" next to the "lb"/"in" fields makes the different unit visible.
3. **Keep the native `step="0.1"` and `min="0"` of `NumberField`, like the other package fields.** The rules form has no `noValidate`, so the browser refuses 0.55 with its native warning before the request is sent. 0, 3 and a weight above the box pass the browser and reach the API 422. The other option was to drop the native lock on this field only, so that 0.55 also reaches the API message. That would make this field behave differently from the four next to it, and would need a special case in `NumberField`. The extra decimal stops earlier either way.
4. **Map the 422 by code in `saveRules`:** `invalid_dry_ice_kg` gets the Portuguese message from the spec, and every other error keeps today's message. That follows `brQuoteError`, which maps API codes to Portuguese.

## Risks / Trade-offs

- [Panel released before the backend] → The old API drops the unknown key, so the save succeeds and the next read shows 0.5 again. Release the backend first.
