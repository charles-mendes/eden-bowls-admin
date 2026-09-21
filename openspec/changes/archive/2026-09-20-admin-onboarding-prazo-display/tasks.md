# Tasks

CSV (`## 3`) lives in `eden-bowls-backend`. Everything else is this admin repo. No BOM. Do not change coupons `1m` slots.

## 1. Formatters

- [x] 1.1 Extend `src/lib/format.test.ts` so `formatTermMonths` covers `null`, `''`, `0`, `1`, `3`, `6`, and `12` (`-`, `-`, `-`, `1 mês`, `3 meses`, `6 meses`, `12 meses`) and verify `npx vitest run src/lib/format.test.ts`.
- [x] 1.2 In `eden-bowls-backend`, add `formatCsvTermLabel` beside `formatCsvFrequency` in `src/services/admin-onboarding.service.js` (null/invalid → `''`; 1 → `1 mês`; else `<n> meses`) and cover the same cases plus header order in `tests/admin-onboarding.service.test.js`; verify `npx jest --runTestsByPath tests/admin-onboarding.service.test.js`.

## 2. Onboarding 360 list and detail

- [x] 2.1 In `src/pages/OnboardingPage.tsx`, set the column header to **Prazo (plano escolhido)**, render `formatTermMonths(item.termMonths)`, remove the Recorrência column and the `formatFrequency` import; in `src/pages/OnboardingPage.test.tsx` replace `A cada 4 semanas` with **1 mês**, assert the new column header, and assert `queryByRole('columnheader', { name: 'Recorrência' })` is absent; verify `npx vitest run --related src/pages/OnboardingPage.tsx`.
- [x] 2.2 In `src/lib/checkoutSnapshot.ts`, remove the Recorrência plan-grid line; in `src/components/CheckoutSnapshotPanels.tsx`, retitle the JSON dump from Recorrência to **Payload recurrence**; verify `npx vitest run --related src/lib/checkoutSnapshot.ts`.

## 3. Checkout CSV (eden-bowls-backend)

- [x] 3.1 In `toCsv`, keep the existing nine headers in the same order, append `termLabel` last, comment `frequency` as legado, map `termLabel` through `formatCsvTermLabel`, and do not prefix BOM; the Jest file from 1.2 MUST assert the first line equals `userId,email,displayName,updatedAt,stripeStatus,stripeSubscriptionId,frequency,termMonths,firstInvoiceTotal,termLabel`, that a monthly/term-1 row is Mensal / `1` / `1 mês`, and that a null-term row leaves `termMonths` and `termLabel` empty; verify `npx jest --runTestsByPath tests/admin-onboarding.service.test.js`.

## 4. Production queue

- [x] 4.1 In `src/pages/ProductionQueuePage.tsx`, when `termMonths` is a positive number show `formatTermMonths(item.termMonths)` instead of `{item.termMonths}m`; omit the subline when the term is missing; in `src/pages/ProductionQueuePage.test.tsx` assert **1 mês**; verify `npx vitest run --related src/pages/ProductionQueuePage.tsx`.

## 5. Related tests

- [x] 5.1 Run `npx vitest run --related src/pages/OnboardingPage.tsx src/lib/checkoutSnapshot.ts src/pages/ProductionQueuePage.tsx src/lib/format.ts` in admin and `npx playwright test e2e/specs/admin-onboarding.spec.ts --workers=4`; Playwright need not be rewritten unless it fails on Recorrência / `1m` / Mensal.
