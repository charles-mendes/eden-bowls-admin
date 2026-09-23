# Tasks

Admin only (`eden-bowls-admin`). Do not edit `eden-bowls` or `eden-bowls-backend`: the promotion-code payload already sends numeric `slot`, and the store does not render this column. Leave coupon-page alerts, `1 mês(es)` labels, and the create-form placeholder unchanged. Do not restyle the page.

## 1. Slot cell

- [x] 1.1 In `src/pages/CouponsPage.tsx`, import `formatTermMonths` from `src/lib/format.ts` and render the Slot cell as `formatTermMonths(item.slot)` with no local ternary; verify the Slot `<td>` no longer concatenates `m`, and that the incomplete-map, missing-in-Stripe, and inactive alerts still use `` `${item}m` ``.

## 2. Test

- [x] 2.1 In `src/pages/CouponsPage.test.tsx`, assert the `FIRST_1M` row (fixture slot 1) shows **1 mês** and that the slot text `1m` is not in the document; verify `npx vitest run src/pages/CouponsPage.test.tsx`.
