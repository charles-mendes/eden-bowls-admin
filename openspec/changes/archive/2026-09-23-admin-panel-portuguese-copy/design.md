# Design

## Context

See proposal.md for why. The panel already translates some Stripe statuses in `src/lib/format.ts` (`formatStripeStatus`) and keeps a separate job-status map inside `DashboardPage`. Assinantes prints raw codes instead. Shipping and coupon forms send the same JSON keys they send today; only the labels around those fields change.

## Goals / Non-Goals

**Goals:**

- One Portuguese label for each operator-facing string in the three slices, without changing request bodies.
- Reuse `formatStripeStatus` for the Assinantes filter and status column. Add `canceling` and `all` there.
- Add a sync-job label helper in `format.ts` for Assinantes first. Point the dashboard at it only in the second slice.

**Non-Goals:**

- Translating `requestError.message`, the US nutrition label map, privacy terms, or role values.
- Renaming **Sincronizar Stripe**, the **Slot** cell, coupon `6m` alerts, or the `First purchase` placeholder.
- Titling the technical recurrence disclosure **Recorrência**. Use **JSON de recorrência**.
- Tasks in `eden-bowls` or `eden-bowls-backend`.

## Decisions

1. **Display labels, not payload values.** Select options keep `value="active"` (and the other Stripe codes). Only the visible text changes. Alternative: translate the query param. Rejected because the API filters on the English code.

2. **Job labels live in `format.ts`, dashboard map stays until slice 2.** Assinantes needs the same four labels the dashboard already has (`idle`, `queued`, `completed`, `completed_with_skips`). Moving the dashboard call in the same edit is a refactor of a screen this slice does not otherwise need. Slice 2 switches the dashboard and adds an assertion for the visible job line.

3. **Coupon name placeholder is not a default.** The field stays empty until the operator types. The English placeholder is hint text only, so Stripe still receives the typed name. Alternative: prefill a Portuguese name. Rejected because that string is stored on the Stripe coupon.

4. **Shipping and business rules change labels only.** `settings` keys (`ship_from`, `road_factor`, `valueJson`) and the save body stay. The US tab label becomes **Estados Unidos**, which `COUNTRY_LABELS` already uses.

5. **Delivery order is three slices.** Slice 1 is the QA screen (Assinantes, subscription detail, menu group). Slice 2 is onboarding, snapshots, delivery instructions, production help, the shared nutrition sentence, and the dashboard link. Slice 3 is shipping, product publish copy, business rules, then coupons. Coupons is last so it does not rewrite the `formatTermMonths` cell.

## Risks / Trade-offs

- [Portuguese headers are longer] → Assinantes and Envio UPS already scroll horizontally. After slice 1, check those two tables for wrapped headers. No new layout component.
- [Two job-label maps until slice 2] → Copy the same four strings. Slice 2 deletes the dashboard-local map.
- [“Sem endereço na cópia gravada” breaks the current assertion] → Update the subscription detail test in slice 2, with the snapshot component.
- [E2E only locks a few strings] → Update `admin-billing` and `admin-readonly` in slice 1. Update the “Slots sincronizados” assertion in slice 3. Do not translate “Nutrition simulator”; `admin-login` asserts it.

## Migration Plan

Deploy is a frontend copy change. Rollback is reverting the admin commit for that slice. No data migration.

## Open Questions

None. Privacy wording and the US simulator stay as they are until someone who uses those screens asks to change them.
