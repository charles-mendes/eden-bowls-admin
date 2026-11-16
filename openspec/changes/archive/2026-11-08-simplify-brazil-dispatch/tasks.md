# Tasks

## 1. Expedir abre o pedido

- [x] 1.1 Point a ready Brazil row at `/operations/courier?fatura={paidInvoiceId}&assinatura={id}`, add `de={today}&ate={deliveryDate}` when `deliveryDate` is after tomorrow in `America/Sao_Paulo`, and fall back to `/operations/courier` when `paidInvoiceId` is missing. Verify `npx vitest run src/pages/ProductionQueuePage.test.tsx` for the Brazil href, a delivery three days ahead, no `deliveryDate`, no `paidInvoiceId`, the US href, and "Mercado divergente".

## 2. A despachar e o alvo da fatura

- [x] 2.1 Request the queue without `preparo` by default, send `preparo=todos` from "Mostrar todos", and keep `problema=endereco` on top. Verify `npx vitest run src/pages/CourierDeliveriesPage.test.tsx` for the first load, the toggle, and "Só prontos".
- [x] 2.2 On load, with the range of the URL, open the dispatch dialog when `fatura` is a dispatchable "A despachar" row, select the other tab when the invoice is already loaded there, and otherwise show the outside-period notice linking to `/billing/subscriptions/{assinatura}`. Verify the same file for those three arrivals, an arrival with `de`/`ate` from Expedir, and a row with address issues that does not open the dialog.

## 3. Saída curta e entregue em lote

- [x] 3.1 In `CourierDispatchDialog`, show method and cost for a new Uber dispatch, keep name, link and note behind "Detalhes", and show all fields for another method and for every edit. Verify `npx vitest run src/pages/CourierDeliveriesPage.test.tsx src/pages/SubscriptionDetailPage.test.tsx` that a new dispatch submits method without the hidden fields, and that an edit still sends the saved link.
- [x] 3.2 On "Em rota", add per-row selection for `shipping.write` with no select-all, and "Marcar entregues (N)" posting `delivered_at` once per selected id. A refusal stays on the tab with its error; successes leave. The single "Entregue" still sends no date. Verify `npx vitest run src/pages/CourierDeliveriesPage.test.tsx` for two successes, one refusal, and the single-row action.

## 4. Hoje

- [x] 4.1 Fold the "aguardando NF-e" item into the dispatch item: "N pedidos a despachar" from `courierToDispatch`, plus "· M aguardando NF-e" when `courierAwaitingNfe` is above zero. Verify `npx vitest run src/pages/DashboardPage.test.tsx` that `courierAwaitingNfe: 2` beside `courierToDispatch: 3` shows one item "3 pedidos a despachar · 2 aguardando NF-e", that 0 and null show "3 pedidos a despachar" alone, and that rejected NF-e, address problems and the US cards still show.
