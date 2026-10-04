# Design

## Context

See proposal.md for why. `redesign-my-plan` adds `delivery_closed_days` and seeds Brazil 2026–2027 plus the 2026 UPS list, including 1 January 2027. The projection reads active rows. Brazil national dates (`origin` `fixed` or `movable`) are also rules in code: a year with none of those rows is inserted once. A deactivated row still counts as a row, so it is not inserted again. The United States has no holiday rule in code. A year with no UPS rows logs a warning and closes only Saturday and Sunday. A lone 1 January carried from the previous schedule does not count as that year's UPS calendar. Weekly rules stay in code: Sunday closed in Brazil; preparation Monday through Friday in the United States. The projection may cache a market in the existing `TtlCache` for about a minute and drops that key after it generates a Brazil year.

Skip, postpone, and a block before preparation write Stripe `trial_end` at 00:00 of the preparation day in the market timezone, with `proration_behavior: 'none'`. Closing a day that already has that `trial_end` stored changes a real charge. A delivery can already be locked: production status `in_production`, `ready`, or `blocked`, or the market clock past `editable_until`.

The customer does not open this screen. Meu Plano shows only the dates the projection still allows.

The panel already has `PageFrame`, `FiltersBar`, `Dialog`, and `apiRequest`. Production lives at `/operations/production` in the Operação menu. Mutations there require `production.write` (`admin` and `operator`). `readonly` has `production.read` only, and write controls stay hidden. `AdminAuditService.record` stores actor, action, timestamp, and metadata; `target_user_id` is nullable. Production already writes `production.status.update`. `operations/admin-market-scope` limits a non-admin session to its assigned market. Operator copy is Portuguese.

Spec and tasks are not written yet. The open questions below change who may save, what a save does to subscriptions, and which warnings the screen must show.

## Goals / Non-Goals

**Goals:**

- Let operations edit `delivery_closed_days` for `BR` and `US` without a deploy.
- Keep Brazil national rules in the table when someone turns a holiday off.
- Show affected subscriptions before a new closure is stored.
- Keep an audit row for add, change, deactivate, and remove.

**Non-Goals:**

- A customer screen, or a second calendar table.
- Moving weekly rules (Brazil Sunday, United States Monday–Friday preparation) into the table.
- Deciding the four open questions. Their recommendations are recorded and not adopted.
- Changing `operations/production-queue` status values.

## Decisions

### 1. Edit `delivery_closed_days`; do not add another table

The screen reads and writes the table from `redesign-my-plan`. Columns stay `market`, `closed_on`, `label`, `origin` (`fixed`, `movable`, `ups`, `regional`, `one_off`), `active`, `closes_preparation`, `closes_pickup`, and `closes_delivery`. Unique on (`market`, `closed_on`).

Brazil national rows use `fixed` and `movable`. Turning one off sets `active = false`. The row stays, so the projection does not generate it again as active. Delete is refused for those origins.

United States rows use `origin` `ups`. Operations inserts the published year and sets the flags. A full UPS closure sets all three. 24 December sets only `closes_pickup`. 31 December sets `closes_pickup` and `closes_delivery`. There is no code path that rebuilds a missing United States year.

`regional` and `one_off` can be inserted and deleted. In Brazil, regional means Curitiba and Paraná in practice, because delivery is within 40 km of Curitiba. In the United States, regional means the kitchen's state. The code does not store a city list. `one_off` is for maintenance, power loss, and similar closures. A `one_off` or `regional` row in a Brazil year does not block generation of that year's national rows.

The projection already ignores `active = false` and applies the three flags of an active row. This screen does not special-case `origin` inside the projection.

### 2. History reuses `admin_audit_events`

`AdminAuditService.record` already stores who did it and when. A calendar event leaves `target_user_id` empty and puts `market`, `closed_on`, `origin`, and the before/after flags in `metadata`. Actions: `delivery_calendar.create`, `delivery_calendar.update`, `delivery_calendar.deactivate`, `delivery_calendar.remove`.

Remove still writes the audit row, then deletes the calendar row. Deactivate updates `active` and writes `delivery_calendar.deactivate`. The screen lists those actions for the selected market and year. A new history table would duplicate actor and timestamp. The existing audit table has no foreign key to the calendar row, which is what makes remove traceable after the date is gone.

### 3. Affected subscriptions are a preview, not a write

Later deliveries are projected from Stripe renewals. They are not their own rows. Before storing a new closure, the API runs the same projection as Meu Plano for subscriptions in that market and returns the ones whose preparation, pickup, or delivery lands on `closed_on` for a flag this closure sets. The dialog lists those subscriptions and does not call Stripe.

What the confirm does to those deliveries is open question 1. Until that is answered, this design does not move `trial_end` and does not block the save because a delivery is locked.

Removing or deactivating a row only makes that date open for later projection. It does not rewrite a delivery that is already scheduled, and it does not clear a `trial_end` already stored.

### 4. The page matches the production queue shell

Route under Operação, beside Produção, using `PageFrame`, `FiltersBar` (market and year), a table, and `Dialog` for create and for the affected-subscription list. HTTP stays on `apiRequest`. Copy is Portuguese, including empty, loading, and error. A session limited to one market by `operations/admin-market-scope` does not list or edit the other market. An admin session can use both.

After a successful write, the backend drops that market's `TtlCache` key in the same process. Another process can still serve the previous calendar until the minute TTL ends.

Who is allowed to mutate is open question 2. The screen is not wired to a permission until that is answered. The production queue's split (`production.read` to see, `production.write` to change, `readonly` with no write controls) is the shape the recommendation points at.

## Risks / Trade-offs

- [A closure lands on a day whose `trial_end` is already 00:00] → Real charges move if that timestamp changes. Question 1 is unanswered, so this change does not update Stripe.
- [Deleting a Brazil national row] → Generation fills a year only when it has no `fixed` or `movable` rows. Removing one date from a year already generated does not bring that holiday back. Deactivate `fixed` and `movable` instead of deleting them.
- [Another API process still has the minute cache] → The writing process drops its key. The other process catches up when the TTL ends. Do not add a shared cache for this screen.
- [The affected list is projected, so it can change between preview and save] → The preview is informational until question 1 says whether confirm must recheck locks.

## Migration Plan

1. `redesign-my-plan` must create and seed `delivery_closed_days` before this screen can list a year.
2. Ship the read API and the page only after the open questions are answered and the spec and tasks exist.
3. Rollback hides the route and leaves the rows. Meu Plano keeps reading whatever is still active. No customer data migration.

## Open Questions

These are not decided. Spec and tasks wait on the answers. Each line is the recommendation only.

1. O que acontece com entregas já agendadas num dia que passa a ser fechado? Recomendação: entregas ainda editáveis vão automaticamente para o próximo dia válido de preparo (atualizando o `trial_end` no Stripe com `proration_behavior: 'none'`) e a tela gera a lista de clientes para a operação avisar pelo WhatsApp. Se houver alguma entrega travada naquele dia, o fechamento é bloqueado até a operação resolver manualmente.
2. Quem pode editar o calendário? Recomendação: só os perfis de administrador que já controlam a fila de produção.
3. Existe antecedência mínima para cadastrar um fechamento? Recomendação: não bloquear, mas mostrar um alerta quando a data estiver a menos de 7 dias.
4. A operação precisa ser avisada quando faltar o calendário UPS do ano seguinte? Recomendação: um alerta no admin a partir de 1º de novembro, se o próximo ano dos EUA não tiver linhas.

## Nota para quando as perguntas forem respondidas

Sem decisão. Incluir este ponto junto com as respostas, não como comportamento já escolhido.

Se a operação tiver um fechamento `one_off` em 01/01/2028 e depois apagar essa linha pela tela, o feriado nacional daquele dia não volta sozinho, porque 2028 já terá sido gerado. A geração automática só cria as linhas nacionais de um ano que ainda não tem `fixed` nem `movable`. A tela vai precisar tratar isso, por exemplo restaurando o feriado nacional quando a linha removida cair numa data de feriado. A chave única `(market, closed_on)` deixa uma data com uma linha só: apagar o `one_off` remove a única linha daquele dia.
