# Design

## Context

See proposal.md for why the subscription detail dumps JSON. Behavior is in `specs/operations/subscription-detail/spec.md`.

Today `CheckoutSnapshotPanels` renders the 360 checkout: plan, discount, payment, address, freight, and collapsed JSON. `parseCheckoutSnapshots` already reads plan pets (`selected_flavors`, `flavor_weights`), catalog `line_items`, address lines, and freight fields, and hides empty freight fields. `SubscriptionDetailPage` does not use that parser. It prints `petsSnapshot`, `planSelection`, `address`, and `shipping` in four `<pre>` blocks.

`GET /api/v1/admin/billing/subscriptions/:id` already returns those four fields. The store app does not render them. The customer dashboard and mailers read the ledger on the backend; this change does not alter those readers.

## Goals / Non-Goals

**Goals:**

- Show product, address, and freight on the subscription detail with the same sections the 360 already uses.
- Keep the four payloads in collapsed technical JSON.
- Leave the 360 page's visible behavior unchanged, including discount, payment, and the title **Plano e itens**.

**Non-Goals:**

- No new or changed admin, store, or backend API.
- No fix for the `invoice.paid` webhook that promotes `editPending.plan_selection` without rewriting `petsSnapshot`.
- No live catalog or pet-table lookup. Names and flavors are the stored snapshots only.
- No tasks in `eden-bowls` or `eden-bowls-backend`.

## Decisions

### Extract shared sections instead of a hide flag

`CheckoutSnapshotPanels` always renders discount and payment. A prop to omit them would couple the subscription page to the checkout component.

Extract `LedgerSnapshotSections` with plan, address, freight, and technical JSON. The plan section title is a prop; the default stays **Plano e itens** so the 360 copy does not change. `CheckoutSnapshotPanels` composes that component and keeps discount and payment around it. `SubscriptionDetailPage` uses `LedgerSnapshotSections` directly with the title **Detalhes do produto** and does not pass checkout reference data, so discount and payment are absent.

Alternative considered: render the subscription page inline and duplicate the tables. Rejected because the 360 and the ledger would drift.

### Merge pet rows in the admin parser, not in the API

Flavors and line items exist only on `planSelection`. `petsSnapshot` is `{ pets, pet_ids, pets_names }`.

The readable pet table starts from plan pets. Append a row with an empty flavor cell for a snapshot pet id that the plan does not list. When both payloads have the same id, keep the plan name. Both payloads stay in the technical JSON so support can see a stale snapshot name.

`parseCheckoutSnapshots` does not know `petsSnapshot`. Add the merge next to that parser (or a small helper it can call) so the subscription page and tests share one rule. The 360 page has no `petsSnapshot` argument and keeps today's plan-only pet list.

### Reuse empty-state behavior

Missing address already renders **Sem endereço no snapshot**. Missing freight fields are dropped by `hideIfEmpty`. An absent freight object must not produce a cost row. No new empty-state copy.

## Risks / Trade-offs

- [360 regression while moving JSX] → Default title and raw slots stay what `CheckoutSnapshotPanels` passes today. Existing checkout snapshot tests stay the guard for parser output; the 360 page test, if it asserts section titles, must still pass without new 360 scenarios.
- [Stale `petsSnapshot` name after a paid edit] → The table shows the plan name, which matches the current mix. The old name remains in technical JSON. Fixing the webhook is a separate backend change.
- [QA asked only for product details] → Address and freight stay visible because dropping them would hide delivery data the operator already had in the JSON. Confirm with the reporter before merge; that check is not a code task.

## Migration Plan

Deploy the admin panel only. Rollback is reverting the admin commit. No data migration and no API compatibility window.

## Open Questions

None. The webhook fix stays out of this change on purpose.
