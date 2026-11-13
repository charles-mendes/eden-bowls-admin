# Tasks

Depends on the backend change `ups-dry-ice-declaration` (`eden-bowls-backend`). Release the backend first. No route changes, so `npm run contract:sync` is not needed.

## 1. Dry ice weight field

- [x] 1.1 Add `dry_ice_kg: number` to `ShippingSettings['us']['package']` and `dry_ice_kg: 0.5` to the US package in `emptySettings()` (`src/lib/shippingSettings.ts`). Leave `dry_ice_kg` out of the `shippingSettings` fixture in `src/test/fixtures.ts`, so the fixture stands for an API that does not send it yet, as it already does for `max_transit_days`. Verify with `npx tsc --noEmit` and `npx vitest run --related src/lib/shippingSettings.ts`.
- [x] 1.2 In `src/test/mockAdminFetch.ts`, add two options to `installAdminFetchMock`: `shippingSettings` replaces the GET and PUT `/api/v1/admin/shipping/settings` answer, and `shippingSettingsSaveError` (`{ status, code, message }`) makes the PUT fail with that error. Without them the mock answers as today. Verify the existing `npx vitest run src/pages/ShippingPage.test.tsx` still passes.
- [x] 1.3 In the "Caixa padrão" fieldset of `src/pages/ShippingPage.tsx`, add a `NumberField` row below the four package fields: label "Gelo seco por caixa", suffix "kg", step "0.1", `disabled={!canWrite}`, `onChange={(value) => updatePackage({ dry_ice_kg: value ?? 0 })}`. The hint is "Declarado à UPS como UN1845 na etiqueta e na cotação. De 0,1 a 2,5 kg, nunca mais que o peso da caixa." Verify with `npx vitest run src/pages/ShippingPage.test.tsx`. "Caixa padrão" only shows in UPS mode and the fixture is `quote_mode: 'fixed'`, so:
  - "Save a new weight": `adminUser` switches to UPS (as the transit days test does), types 1.2 and saves. The PUT body carries `us.package.dry_ice_kg: 1.2` and the other package fields.
  - "Value from the API": in UPS mode, with the default fixture (no `dry_ice_kg`), the field shows 0.5.
  - "Read-only operator": `operatorUsUser` (US market, `shipping.read`, no `shipping.write`) cannot switch the mode, so the mock answers with `shippingSettings` in `quote_mode: 'ups'`. The field is disabled. `readonlyUser` only sees Brazil and does not reach this field.
- [x] 1.4 In `saveRules`, show "Gelo seco por caixa deve ficar entre 0,1 e 2,5 kg, com uma casa decimal, e não pode passar do peso da caixa." when the error is an `ApiRequestError` with code `invalid_dry_ice_kg`. Keep today's message for every other error. Verify with `npx vitest run src/pages/ShippingPage.test.tsx`: a new test types 3 (accepted by the browser), mocks the PUT with `shippingSettingsSaveError` 422 `invalid_dry_ice_kg`, and checks the Portuguese message and that the field still shows 3.

## 2. Integration checks

- [x] 2.1 Run `npx vitest run --changed` and verify every related test passes. Run `npx playwright test e2e/specs/admin-readonly.spec.ts --workers=4` and verify it still passes. This is a regression check only: its user is Brazil-only and does not see the US field, which the Vitest test in 1.3 covers.
