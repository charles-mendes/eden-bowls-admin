# Tasks

Depends on the backend change `us-company-paid-shipping` (`eden-bowls-backend`). Release the API first. No route changes, so `npm run contract:sync` is not needed.

## 1. US switch and history

- [x] 1.1 Add `charge_shipping: boolean` and `charge_shipping_history` (`enabled`, `actor_email`, `changed_at`) to `ShippingSettings['us']` in `src/lib/shippingSettings.ts`, with false and an empty list in `emptySettings()`. In `ShippingPage.tsx`, add the switch to the US rules with its confirmation, hint (`shippingHelp.ts`) and 422 message, and the "Histórico" list below it, reusing `NutritionEditLog` as the company history in `SettingsPage.tsx` does, with a new optional `timeZone` prop passed to `formatDate` (America/New_York here; Empresa and Fase de vida keep the browser time zone). Add the field and history to the fixtures and to `mockAdminFetch.ts`. Verify with `npx vitest run src/pages/ShippingPage.test.tsx src/lib/shippingSettings.test.ts`: "US operator turns charges on" (`operatorUsWriteUser`), "Confirmation cancelled", "Read-only operator", "Two changes", "Browser in Brazil" and "Empty history", and `npx vitest run src/pages/SettingsPage.test.tsx` still passing.
- [x] 1.2 Show "Valor do frete" and "Cliente paga" in the US simulation from `charged_amount`. Verify with `npx vitest run src/pages/ShippingPage.test.tsx`: "Charges off" and a simulation with charges on.

## 2. Subscription detail

- [x] 2.1 Show the shipping condition and `company_shipping_cost` for a US subscription in `SubscriptionDetailPage.tsx`. Verify with `npx vitest run src/pages/SubscriptionDetailPage.test.tsx`: "Free US subscription" and "Charged US subscription".
- [x] 2.2 Take a Playwright screenshot of the US rules with the switch and the history, and of a free US subscription detail, against the mocked API, and check the layout (global table CSS must not stretch the history). Verify by looking at the screenshots.

## 3. Integration checks

- [x] 3.1 Run `npx vitest run --changed` and verify every related test passes. Run `npx playwright test e2e/specs/admin-readonly.spec.ts --workers=4` and verify it still passes.
