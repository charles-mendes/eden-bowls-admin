# Design

## Context

See `proposal.md`. Entregas Brasil and the subscription detail already share `CourierDispatchDialog`; the production queue does not open it, its Expedir is a link. "Entregue" of one row posts to `/admin/courier-deliveries/:id/delivered` with an empty body, so the API uses now. That action already accepts `delivered_at`. The production queue item does not yet carry `paidInvoiceId`; the API change adds it.

## Goals / Non-Goals

**Goals:**

- Expedir lands on the dispatch dialog of that invoice when the loaded queue can dispatch it.
- The short Uber form and the batch close reuse the current endpoints.

**Non-Goals:**

- A "marcar tudo". The per-row "Entregue" stays a confirm-and-send-now.
- Deep-linking the per-order "Despachar" on Hoje. That item has no invoice id; the card still opens the list.
- Hiding the cost. It stays on the short form, optional, and "Editar" can fill it later.

## Decisions

### The URL holds the filter and the target

`preparo=todos` is the only extra list parameter. Absent means the request omits `preparo` and the API applies ready-only. "Mostrar todos" / "Só prontos" write that param the same way `aba` and `problema` are written. The address filter still runs on the rows the API returned.

`fatura` and `assinatura` come from Expedir (`paidInvoiceId` and the queue item `id`). When the item's `deliveryDate` is after tomorrow, Expedir also writes `de` (today) and `ate` (that date), the range parameters the page already reads, so a box prepared ahead of its day is in the loaded queue. Today to `ate` stays within the API's limits (floor 30 days back, at most 31 days) for any delivery up to 31 days ahead. After the queue loads, the page looks the invoice up in the four groups. A dispatchable "A despachar" row opens the dialog. Another group only selects its tab. No group shows the outside-period notice and links to `/billing/subscriptions/{assinatura}`. `fatura` overrides `aba` when the invoice is loaded.

### The short form is a state of the existing dialog

When the dialog is a new dispatch and the method is Uber, it shows method and cost, with name, link and note inside "Detalhes". Any other method, and every edit, shows the five fields. The submit body is unchanged: empty optional fields stay omitted. The subscription detail uses this dialog, so it gets the same rule without a second form.

### Batch close is one POST per selected id

"Em rota" gets a checkbox per row for `shipping.write`, and no header checkbox. The dialog edits one datetime, default now, in `America/Sao_Paulo`, and each request sends that instant as `delivered_at`. The calls run together; a refusal does not undo the ones that succeeded. The row that fails stays, with `courierErrorText`. The single-row button is left as it is.

### The NF-e wait stays on Today, on the dispatch line

Production requires `COURIER_REQUIRE_AUTHORIZED_NFE=true` (`eden-bowls-backend/docs/production-go-live.md`), so a ready box without an authorized NF-e cannot leave, and a note still `pending` or `submitted` has no other Today item. Dropping the count would show "3 a despachar" while two of them are held. It joins the dispatch item as "· M aguardando NF-e" instead of a second item, which removes the double count without hiding the hold. The API already returns `courierAwaitingNfe` as a subset of the ready count.

## Risks / Trade-offs

- [Panel deployed before the API] → the request without `preparo` still returns every paid cycle, and `paidInvoiceId` is missing, so Expedir cannot add `fatura`. Hide Expedir's invoice query until the field is present, and link to `/operations/courier` as today. "Mostrar todos" against an old API is a no-op.
- [A chosen batch time is before one box left and after the others] → that one stays on the road and the others close. The dialog says which one failed. The operator picks another time for the remainder.
- [Expedir for a delivery date after tomorrow] → Expedir carries `de`/`ate` up to that date, so the invoice is loaded. The outside-period notice is left for a delivery more than 31 days ahead (the API refuses that range) or an item with no `deliveryDate` whose courier key falls outside the default range.

## Migration Plan

Same release as the API. Panel first is safe; API first is not, because the old screen would lose the not-ready rows with no toggle. Rollback reverts the panel with the API.

## Open Questions

None.
