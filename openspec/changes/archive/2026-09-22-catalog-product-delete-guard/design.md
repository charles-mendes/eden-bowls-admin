# Design

## Context

See proposal.md for why delete and deactivate stay different actions. The list and the detail already call `DELETE /api/v1/admin/catalog/products/:id` and `PATCH` with `active`. `apiRequest` throws `Error` with only the response message, so a 409 is indistinguishable from any other failure. Linkage is not a field on the product payload today.

## Goals / Non-Goals

**Goals:**

- The panel renders Excluir, Desativar, or neither from `canDelete` and `active` returned by the catalog GET.
- A 409 after a stale Excluir refetches that GET. A 502 leaves the row in place.

**Non-Goals:**

- Deciding linkage in the browser, or counting subscriptions in the copy.
- Changing what Desativar does on the server. It stays `PATCH { active: false }`.
- Storefront, checkout, or Stripe archive rules. Those belong to the backend sister change, or stay as they are.

## Decisions

1. **The GET is the source of the buttons.** Each product and each variation carries `canDelete: boolean`. The panel does not inspect `plan_selection`. Alternative considered: hide Excluir only after a 409. That leaves the wrong verb on screen until the first failed delete.

2. **`apiRequest` keeps `status` and `details.code` on the thrown error.** Call sites that only read `message` keep working. Delete handlers branch on `product_in_use`, `variation_in_use`, and the 502 archive code. Alternative considered: match Portuguese text in the message. That breaks when the API message is English, which it is today.

3. **Desativar replaces the label “Voltar para rascunho” everywhere that control exists**, including a published product that can still be deleted. Excluir and Desativar can both show when `canDelete` is true and the product is published. Alternative considered: Desativar only when linked. That would remove the existing unpublish path from products that have never sold.

4. **Confirmation copy does not include a count.** `canDelete` is the only new field this UI reads.

## Risks / Trade-offs

- [GET without `canDelete` during rollout] → Treat missing `canDelete` as false for Excluir, so a new panel against an old API cannot delete. Desativar still works via the existing PATCH.
- [Stale list after 409] → Refetch is mandatory in the delete catch; do not only set an error string.

## Migration Plan

Ship the backend sister change first, or in the same release, so `canDelete` exists before the panel hides Excluir. Rollback of the panel restores the old buttons; rollback of the backend restores unconditional DELETE. Neither needs a data migration.

## Open Questions

None. The button matrix and the 409/502 handling are fixed in the spec.
