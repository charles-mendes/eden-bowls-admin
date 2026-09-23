# Tasks

Store (`eden-bowls`) and backend (`eden-bowls-backend`) have no tasks. The subscription detail already receives `petsSnapshot`, `planSelection`, `address`, and `shipping`, and neither the store nor the backend renders this admin screen. The webhook that leaves `petsSnapshot` stale after a paid edit stays out of scope.

## 1. Pet merge

- [x] 1.1 Add a helper next to `parseCheckoutSnapshots` that builds the readable pet list from `planSelection` and appends snapshot-only pets with an empty flavor cell, keeping the plan name when the same pet id differs, and verify `src/lib/checkoutSnapshot.test.ts` covers a snapshot-only pet and a name clash

## 2. Shared sections

- [x] 2.1 Extract `LedgerSnapshotSections` (plan, address, freight, collapsed technical JSON) with the plan title defaulting to **Plano e itens**, make `CheckoutSnapshotPanels` compose it and keep discount and payment, and verify `npx vitest run src/pages/OnboardingSessionPage.test.tsx src/lib/checkoutSnapshot.test.ts` still passes

## 3. Subscription detail

- [x] 3.1 Replace the four `<pre>` blocks on `SubscriptionDetailPage` with `LedgerSnapshotSections` titled **Detalhes do produto**, passing the merged pets and the four raw payloads, and verify the page no longer renders discount or payment sections

## 4. Page tests

- [x] 4.1 Add three subscription fixtures in `SubscriptionDetailPage.test.tsx`: catalog line items (quantity and price visible), flavor mix only (no item table), and incomplete address with freight absent (**Sem endereço no snapshot**, no invented cost). In each, assert the raw JSON stays hidden until the disclosure is opened. Verify with `npx vitest run src/pages/SubscriptionDetailPage.test.tsx`
