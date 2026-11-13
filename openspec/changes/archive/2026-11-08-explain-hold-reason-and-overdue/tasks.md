## 1. Title from the reason

- [x] 1.1 Add `holdTitle(reasons, several)` to `src/lib/courierDeliveries.ts`:
  - it returns "Pedido ainda não está pronto" for a single `production_not_ready`;
  - for a single `subscription_not_active`, it returns "Assinatura cancelada", "Assinatura pausada", "Assinatura com pagamento pendente" or "Assinatura não está ativa";
  - in every other case (no reasons, two or more, an unknown code) it returns `several`.
- [x] 1.2 In `src/components/shipping/CourierDelivery.tsx`, title the confirmation with `holdTitle(reasons, 'Confirme antes de despachar')`. Keep the list and the buttons.
- [x] 1.3 In `src/pages/SubscriptionDetailPage.tsx`, build the `window.confirm` text as the title from `holdTitle(reasons, 'Confirme antes de comprar a etiqueta')`, then the list, then "Comprar mesmo assim?".
- [x] 1.4 Tests:
  - `src/pages/CourierDeliveriesPage.test.tsx`: the canceled subscription gives "Assinatura cancelada"; `production_not_ready` gives "Pedido ainda não está pronto"; two reasons give "Confirme antes de despachar" with both listed.
  - `src/pages/SubscriptionDetailPage.test.tsx`: replace the assertion at line 334 with three separate checks on the confirm text: the title "Pedido ainda não está pronto", the reason line, and "Comprar mesmo assim?" at the end. Add the canceled case and the two-reason case the same way.

## 2. What the overdue cards count

- [x] 2.1 In `src/pages/DashboardPage.tsx`, change the "Atrasados" card hint to "Só o que a cozinha não terminou. Pronto esperando saída conta em pedidos a despachar."
- [x] 2.2 In `src/pages/ProductionQueuePage.tsx`, add the optional `hint` to the due cards. Put "Só o que a cozinha não terminou. Pronto esperando saída não conta." in a `span.queue-due-hint` after the number, on "Atrasados" only. Style it in `src/index.css` as small muted text.
- [x] 2.3 Tests:
  - `src/pages/DashboardPage.test.tsx`: the card shows the number and the new hint.
  - `src/pages/ProductionQueuePage.test.tsx`: the "Atrasados" card shows the hint and only the `overdue` number.

## 3. Check

- [x] 3.1 Run only the related Vitest files, plus `npx tsc --noEmit`, and `openspec validate explain-hold-reason-and-overdue`.
