# Tasks

Depends on the backend change `starter-to-monthly` (`eden-bowls-backend`) and on this repository's `starter-box-purchase`. Release the API first. No route changes, so `npm run contract:sync` is not needed.

## 1. Hoje

- [ ] 1.1 Add `startersUnconfirmed?: { BR: number; US: number }` and the Starter items to `src/lib/today.ts`, and the "Starter sem entrega confirmada" card to `DashboardPage.tsx`, linking to the courier or label screen. Verify with `npx vitest run src/pages/DashboardPage.test.tsx`: "Courier did not mark the delivery" and "Older API".

## 2. Subscription detail

- [ ] 2.1 Show Day 1, the invite and the confirmed plan in `SubscriptionDetailPage.tsx` for a Starter. Verify with `npx vitest run src/pages/SubscriptionDetailPage.test.tsx`: "Invite from the expected date" and "Plan confirmed".
- [ ] 2.2 Take a Playwright screenshot of Hoje with the new card and of the Starter detail against the mocked API, and check the layout. Verify by looking at the screenshots.

## 3. Integration checks

- [ ] 3.1 Run `npx vitest run --changed` and verify every related test passes.
