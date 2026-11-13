# Tasks

## 1. Resolved texts

- [x] 1.1 In `src/lib/addressIssues.ts`, widen `resolved_by` to `'customer' | 'operator' | 'ended' | 'superseded' | string | null` and make `addressIssueState` return "Operador corrigiu em dd/mm" (success) for `operator` and "Assinatura encerrada em dd/mm" (muted) for `ended`. Keep `customer` as it is, and keep "Substituído em dd/mm" for `superseded` and unknown values. Update the comment on `AddressIssueState.email`. Verify with `npx vitest run src/lib/addressIssues.test.ts` (one case per value, plus an unknown one).
- [x] 1.2 Add a test to `src/pages/SubscriptionDetailPage.test.tsx` (it has none for `address_issue` yet): a canceled subscription whose problem has `resolved_by: ended` shows "Assinatura encerrada em dd/mm". Run `npx vitest run src/pages/SubscriptionDetailPage.test.tsx`.

## 2. Specs

- [x] 2.1 Run `openspec validate close-address-issues-when-subscription-ends --strict` and verify it passes. Archive together with the backend change of the same name.
