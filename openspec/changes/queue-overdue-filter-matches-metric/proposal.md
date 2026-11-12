# Proposal

## Why

The backend change `queue-overdue-filter-matches-metric` makes the queue's `due=overdue` filter list only what the "Atrasados" card counts: late orders the kitchen has not finished. The panel spec still says that an order marked ready under `?prazo=atrasados` stays in that list under "Prontos para expedir", which the API will no longer return, and an order that silently vanishes after "Marcar como pronto" reads as lost.

## What Changes

- Under `?prazo=atrasados`, an order marked ready (one row or a batch) leaves the list on the refresh that follows, as with any filter.
- The panel then shows a notice saying the order left Atrasados and waits in "Prontos para expedir", with a link to the queue filtered by status Pronto, keeping the market filter.
- Without a due filter, the "Prontos para expedir" group and the "Atrasados" card stay as they are.
- A row under "Prontos para expedir" shows "Aguardando saída há N dias" (warning) instead of the red "Atrasado N dias", so it does not read as kitchen work running late next to an "Atrasados" card at 0.
- Hoje lists the ready Brazil orders past their day whose box has not left as a pending item "N pedidos prontos esperando saída" ("Média", opening Entregas Brasil), so it no longer says "Nada travado. Tudo em dia." while a paid box waits.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `operations/production-queue`: the requirement "Ready orders past their day have their own group" replaces the scenario "Marked ready from the overdue filter", adds the notice and the "Aguardando saída" badge.
- `operations/today-overview`: adds the pending item for ready Brazil orders waiting to leave, and "The Hoje overdue card says what it counts" says where those orders show.

## Impact

- `src/pages/ProductionQueuePage.tsx`, `src/pages/DashboardPage.tsx` and their tests.
- Paired with `eden-bowls-backend/openspec/changes/queue-overdue-filter-matches-metric` (`courier-delivery`); both are applied and archived together.
- No new route; `contracts/backend-routes.json` does not change.
