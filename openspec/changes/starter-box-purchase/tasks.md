# Tasks

Depends on the backend change `starter-box-purchase` (`eden-bowls-backend`). Release the API first. No route changes, so `npm run contract:sync` is not needed.

## 1. Starter settings

- [ ] 1.1 Add `starterDays` and `starterDiscountPercent` to the plan settings type, the form state and the save payload in `PlanSettingsPage.tsx`, with the local range checks and the two 422 messages. Verify with `npx vitest run src/pages/PlanSettingsPage.test.tsx`: "Save the US percent", "Days out of range" and "Read-only session".

## 2. Starter badge

- [ ] 2.1 Add `plan_kind?: 'subscription' | 'starter'` to the production queue, courier delivery, label and subscription types, and a `PlanKindBadge` component that renders only for `starter`. Use it on `ProductionQueuePage`, `CourierDeliveriesPage`, `LabelQueuePage`, `BillingPage` rows and the `SubscriptionDetailPage` header, and replace the contract block with "Cobrança única, sem renovação" for a Starter. Add Starter fixtures. Verify with `npx vitest run src/pages/ProductionQueuePage.test.tsx src/pages/SubscriptionDetailPage.test.tsx src/pages/BillingPage.test.tsx`: "Starter in production", "Older API", "Starter detail" and "Subscriber list".
- [ ] 2.2 Take a Playwright screenshot of **Plano** and of a Starter subscription detail against the mocked API, and check that the badge and the new section sit inside their cards (global table CSS must not stretch them). Verify by looking at the screenshots.

## 3. Integration checks

- [ ] 3.1 Run `npx vitest run --changed` and verify every related test passes. Run `npx playwright test e2e/specs/admin-readonly.spec.ts --workers=4` and verify it still passes.
