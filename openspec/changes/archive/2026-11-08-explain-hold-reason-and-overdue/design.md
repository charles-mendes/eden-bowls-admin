## Context

The API sends the same `reasons` array (`ReadinessReason[]`) in two confirmations:

- `courier_dispatch_needs_confirmation`, read by the dispatch dialog in `src/components/shipping/CourierDelivery.tsx`;
- `ups_label_needs_confirmation`, read by the subscription detail in `src/pages/SubscriptionDetailPage.tsx` and by the UPS label queue.

`readinessText` in `src/lib/courierDeliveries.ts` already turns each reason into a list line ("Preparo: Em produção", "Assinatura: Cancelada"). The title, though, is fixed:

- the dialog (`CourierDelivery.tsx:136`) shows "Pedido ainda não está pronto";
- the detail (`SubscriptionDetailPage.tsx:392`) asks "Este pedido ainda não está pronto. Comprar mesmo assim?".

The UPS label queue (`LabelQueuePage.tsx:219`) asks with a generic sentence, but it names each order's production and subscription status in the text. So the reason is already visible there.

Two cards show the overdue number:

- On Hoje, `DashboardPage.tsx:238` shows `totals.overdue` with the hint "O dia de preparo já passou".
- In the queue, `ProductionQueuePage.tsx:472` shows `metrics.overdue` as a button with no text.

Both counts are already the kitchen-only number since `keep-ready-orders-dispatchable`.

## Goals / Non-Goals

**Goals:**
- The title of each confirmation names the real reason when there is only one.
- The two "Atrasados" cards say, in one sentence, what they count.

**Non-Goals:**
- Any API change: reasons, codes and the `confirm_not_ready` flow stay as they are.
- The UPS label queue: its question already names each status.
- A second number on the cards, or a count of ready orders waiting. The queue API does not return that count, and the "pedidos a despachar" line already shows it on Hoje.
- A days selector on Entregues, an order timeline, or emailing when an order is marked ready.

## Decisions

1. **One helper builds the title for both screens.** `holdTitle(reasons, several)` in `src/lib/courierDeliveries.ts`:
   - returns the one-reason title when the array has exactly one known reason;
   - otherwise returns the `several` text the caller passes. The dialog passes "Confirme antes de despachar"; the detail passes "Confirme antes de comprar a etiqueta".

   Keeping the rule in one place makes the two screens agree. The caller chooses the generic text because the detail buys a label and does not dispatch.

2. **Subscription titles are their own sentences, not `readinessText`.**
   - The list line "Assinatura: Cancelada" reads as a field, not as a title, so the helper maps the status: `canceled` → "Assinatura cancelada", `paused` → "Assinatura pausada", `past_due` → "Assinatura com pagamento pendente", anything else → "Assinatura não está ativa".
   - An unknown reason code counts as not known, which gives the generic title. The panel never shows a raw code as a title.

3. **The detail keeps `window.confirm`.** The text becomes `${title}.` followed by the list, then "Comprar mesmo assim?". Turning it into a dialog would be a bigger change than the problem needs.

4. **The card texts.**
   - **Hoje:** the hint changes to "Só o que a cozinha não terminou. Pronto esperando saída conta em pedidos a despachar." Hoje shows the line "N pedido(s) a despachar", so the hint names it in those words. "A despachar" is the tab name in Entregas, not a label on Hoje.
   - **Queue:** the "Atrasados" button gets a `span.queue-due-hint` with "Só o que a cozinha não terminou. Pronto esperando saída não conta." The queue has no "pedidos a despachar" line, so the hint does not point to one. The hint goes after the number, inside the button, so the tests that find the button by `/^Atrasados/` keep working.

## Risks / Trade-offs

- **The queue cards get taller.** A hint on only one of the four makes that card taller. Mitigation: small muted text; the grid keeps the row height, so the other cards grow evenly.
- **A new subscription status from the API** falls back to "Assinatura não está ativa". That is correct, only less specific.
