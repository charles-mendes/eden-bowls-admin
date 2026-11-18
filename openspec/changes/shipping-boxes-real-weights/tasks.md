# Tasks

Depends on the backend change `shipping-boxes-real-weights` (`eden-bowls-backend`). Release the API first. No route changes, so `npm run contract:sync` is not needed.

## 1. Empty weight to the gram

- [ ] 1.1 Set the "Peso vazio" field to `step="0.001"` with three decimals, the defaults in `emptySettings()` and the fixtures to 0.355 and 0.6, and the hint in `shippingHelp.ts`. Verify with `npx vitest run src/pages/ShippingPage.test.tsx src/lib/shippingSettings.test.ts`: "Save the weighed monthly box" (0.615), "Weights after deploy", "Refused by the API" and "Read-only operator".
- [ ] 1.2 Take a Playwright screenshot of "Caixas de envio" against the mocked API and check that three decimals fit in the field. Verify by looking at the screenshot.

## 2. Integration checks

- [ ] 2.1 Run `npx vitest run --changed` and verify every related test passes.
