# Proposal

## Why

When the API asks the operator to confirm a dispatch or a label purchase, the panel always titles the question "Pedido ainda não está pronto". It does so even when the real reason is "Assinatura: Cancelada", so the operator can confirm thinking it is only a kitchen delay. The "Atrasados" count is also smaller than the queue page under it. The count is right, because ready orders past their day already count in the "pedidos a despachar" line, but no text says so.

## What Changes

- **Dispatch dialog in Entregas Brasil:** the confirmation title comes from the reason. With one reason, the title is that reason: "Pedido ainda não está pronto", "Assinatura cancelada", "Assinatura pausada", "Assinatura com pagamento pendente". With several, or with a reason the panel does not know, the title is "Confirme antes de despachar". The list of reasons stays under the title, and so does "Despachar mesmo assim".
- **Label purchase in the subscription detail:** the "Comprar mesmo assim?" question opens with the same title for one reason. With several, it opens with "Confirme antes de comprar a etiqueta". The list of reasons stays.
- **"Atrasados" card on Hoje and in the queue:** the number stays the same. Each card gets one sentence: the number is only what the kitchen has not finished, and a ready order waiting to leave does not count in it. There is no second number.
- **UPS label queue:** no change. Its question already names the status of each order in the text.
- **Out of scope, as decided:**
  - a 7 / 30 / 90 day selector on Entregues, which stays at 7 days;
  - a new order timeline;
  - opening an address problem or emailing the customer when an order is marked ready.
- **No change to the API:** the reasons, the codes and the confirmation rules stay the same.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `operations/courier-deliveries`: the dispatch confirmation is titled by its reason.
- `operations/subscription-detail`: the label purchase confirmation opens with the reason, not with a fixed sentence.
- `operations/production-queue`: the "Atrasados" card says what it counts.
- `operations/today-overview`: the Hoje "Atrasados" card says what it counts.

## Impact

- `src/lib/courierDeliveries.ts`: a new helper that turns the reasons into a title. It reuses `readinessText` and the existing subscription status labels.
- `src/components/shipping/CourierDelivery.tsx`: the dialog title.
- `src/pages/SubscriptionDetailPage.tsx`: the text of the `window.confirm` for `ups_label_needs_confirmation`.
- `src/pages/DashboardPage.tsx`: the hint of the "Atrasados" card.
- `src/pages/ProductionQueuePage.tsx`: the "Atrasados" due card gets a short text.
- Tests: `CourierDeliveriesPage.test.tsx`, `SubscriptionDetailPage.test.tsx` (the existing assertion on "Este pedido ainda não está pronto. Comprar mesmo assim?" changes), `ProductionQueuePage.test.tsx` and the Hoje page test.
- No backend change, no new route, no contract sync.
