# Tasks

## 1. Notice after marking ready under "Atrasados"

- [x] 1.1 In `ProductionQueuePage`, after a single status change or a batch that sets `ready` while the due filter is `atrasados`, show a `notice` (role `status`): one order "O pedido saiu de Atrasados e está em Prontos para expedir." / batch "N pedidos saíram de Atrasados e estão em Prontos para expedir.", with a "Ver prontos" link to `productionQueueHref({ status: 'ready', mercado })`. Clear it on the next filter change. Verify with `npx vitest run src/pages/ProductionQueuePage.test.tsx`.
- [x] 1.2 Replace the test "a late order marked ready from the overdue filter moves to Prontos para expedir" with: under `?prazo=atrasados&mercado=br` the refresh returns no row and the notice links to `/operations/production?status=ready&mercado=br`; add the batch case and the no-due-filter case (row under "Prontos para expedir", no notice). Verify with `npx vitest run src/pages/ProductionQueuePage.test.tsx src/pages/DashboardPage.test.tsx`.

## 2. Ready orders waiting to leave

- [x] 2.1 In `ProductionQueuePage`, rows of the "Prontos para expedir" group show a `badge-warning` "Aguardando saída há N dias" instead of the red `dueLabel`; rows under "Atrasados" keep it. Verify with `npx vitest run src/pages/ProductionQueuePage.test.tsx` (the group test asserts both badges).
- [x] 2.2 In `DashboardPage`, add the pending item "N pedidos prontos esperando saída" (Média, after the Alta items) for Brazil rows `overdue` + ready with no courier delivery, linking to `/operations/courier`. Verify with `npx vitest run src/pages/DashboardPage.test.tsx` (one waiting, one on the road, one US; no "Nada travado").

## 3. Specs

- [x] 3.1 Validate with `openspec validate queue-overdue-filter-matches-metric --strict`; archive together with the backend change of the same name so `operations/production-queue` and `courier-delivery` are synced at once.
