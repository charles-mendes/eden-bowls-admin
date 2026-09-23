# Design

## Context

See proposal.md for why the Slot cell must read `6 meses`. Today `CouponsPage` renders `` `${item.slot}m` ``, and falls back to `-` only when `slot` is falsy. `formatTermMonths` in `src/lib/format.ts` already returns `-` for `null`, `undefined`, `''`, and any non-finite or non-positive number, `1 mês` for 1, and `<n> meses` otherwise. Onboarding and the production queue already use it. The table does not filter, sort, or search by that cell text.

`GET /admin/stripe/promotion-codes` (`listRecentPromotionCodes` in `eden-bowls-backend`) sets `slot` from the stored term map (`1` / `3` / `6`) or `null`. The store checkout reads `subscription_term_months` and never renders this column.

## Goals / Non-Goals

**Goals:**

- Render the Slot cell with the existing month formatter.
- Keep empty and non-positive slots as `-` without a local ternary.
- Prove the one-month fixture shows `1 mês`.

**Non-Goals:**

- Changing alert copy, `1 mês(es)` labels, or the create-form placeholder.
- Changing the API, the slot map, or any store screen.
- New visual tokens, badges, or layout.

## Decisions

- Reuse `formatTermMonths(item.slot)` and drop the `item.slot ? ... : '-'` ternary. The formatter already covers absent and zero slots, so a second fallback would diverge from onboarding.
- Do not add a `slot_label` on the backend. The number stays the contract; wording is a panel concern. Alternative considered: format in `listRecentPromotionCodes`. Rejected because the store and other admin clients would inherit Portuguese display text inside a numeric field’s neighbor, and this ticket does not change the API.
- No tasks in `eden-bowls` or `eden-bowls-backend`. Grep shows no consumer of the compact Slot cell text outside this `<td>`.

## Risks / Trade-offs

- [Singular vs plural] `1` becomes `1 mês`, not `1 meses`. → Matches `formatTermMonths` and the QA example for 6 (`6 meses`).
- [Scope creep into other `Nm` strings on the same page] → Spec keeps alerts and form copy unchanged.
- [Rollback] Revert the cell expression. No data migration.

## Migration Plan

Deploy the admin panel only. No backend release and no store release. Rollback is reverting the Slot cell and the Vitest assertion.
