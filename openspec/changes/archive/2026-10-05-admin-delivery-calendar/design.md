# Design

## Context

See proposal.md for why. `redesign-my-plan` adds `delivery_closed_days` and seeds Brazil 2026–2027 plus the 2026 UPS list, including 1 January 2027. Migration `1700000000026` adds the 2027 UPS list, including 1 January 2028. The projection reads active rows. Brazil national dates (`origin` `fixed` or `movable`) are also rules in code: a year with none of those rows is inserted once. A deactivated row still counts as a row, so it is not inserted again. The United States has no holiday rule in code. A year with no UPS rows logs a warning and closes only Saturday and Sunday. A lone 1 January carried from the previous schedule does not count as that year's UPS calendar. Weekly rules stay in code: Sunday closed in Brazil; preparation Monday through Friday in the United States. The projection reads the active rows from MySQL on every read; there is no calendar cache.

Skip, postpone, and a block before preparation write Stripe `trial_end` at 00:00 of the preparation day in the market timezone, with `proration_behavior: 'none'`. Closing a day that already has that `trial_end` stored changes a real charge. A delivery can already be locked: production status `in_production`, `ready`, or `blocked`, or the market clock past `editable_until`.

The customer does not open this screen. Meu Plano shows only the dates the projection still allows.

The panel already has `PageFrame`, `FiltersBar`, `Dialog`, and `apiRequest`. Production lives at `/operations/production` in the Operação menu. Mutations there require `production.write` (`admin` and `operator`). `readonly` has `production.read` only, and write controls stay hidden. `AdminAuditService.record` stores actor, action, timestamp, and metadata; `target_user_id` is nullable. Production already writes `production.status.update`. `operations/admin-market-scope` limits a non-admin session to its assigned market. Operator copy is Portuguese.

The backend already runs background jobs through `startScheduler`: each job takes a MySQL named lock per tick, and retryable work (`stripe_webhook_events`, `subscription_mail_claims`) keeps `attempts`, `last_error`, `next_attempt_at`, and a failed timestamp on its own row.

The four open questions were answered and are recorded in decisions 3 to 7. The row shape changed to answer the holiday-that-does-not-come-back case (decision 1).

## Goals / Non-Goals

**Goals:**

- Let operations edit `delivery_closed_days` for `BR` and `US` without a deploy.
- Keep Brazil national rules in the table when someone turns a holiday off.
- Show affected subscriptions before a closure is stored, and move the editable ones when it is.
- Keep an audit entry for every calendar change, visible in the panel.
- Never leave MySQL and Stripe half-written by a closure.

**Non-Goals:**

- A customer screen, or a second calendar table.
- Moving weekly rules (Brazil Sunday, United States Monday–Friday preparation) into the table.
- Changing `operations/production-queue` status values.

## Decisions

### 1. Rows are split by type in `delivery_closed_days`

The screen reads and writes the table from `redesign-my-plan`. Columns stay `market`, `closed_on`, `label`, `origin`, `active`, `closes_preparation`, `closes_pickup`, and `closes_delivery`, plus a new `type`: `national`, `regional`, `carrier`, or `adhoc`. A backend migration fills `type` from `origin` (`fixed` and `movable` → `national`, `ups` → `carrier`, `regional` → `regional`, `one_off` → `adhoc`) and replaces the unique key (`market`, `closed_on`) with (`market`, `closed_on`, `type`).

A date can hold one row of each type. A date is closed for preparation, pickup, or delivery when any active row of that date sets that flag. The three flags stay independent, as in the UPS seed for 2027, where 24 December closes only pickup. The projection already reads every active row of a date and applies each flag on its own, so it needs no change for this.

`national` exists only in `BR`. A national row is never deleted. Turning one off sets `active = false`. The row stays, so the projection does not generate it again as active.

`carrier` exists only in `US` and holds the UPS schedule. Operations inserts the published year and sets the flags. A full UPS closure sets all three. 24 December sets only `closes_pickup`. 31 December sets `closes_pickup` and `closes_delivery`. There is no code path that rebuilds a missing United States year.

`regional` and `adhoc` rows can be inserted and deleted in both markets. Because each type has its own row, removing an `adhoc` row on 1 January 2028 leaves the other row of that date in place, and the day stays closed: in `BR` that row is `national` (from year generation), in `US` it is `carrier` (from migration `1700000000026`). This replaces the restore step the earlier note asked for. In Brazil, regional means Curitiba and Paraná in practice, because delivery is within 40 km of Curitiba. In the United States, regional means the kitchen's state. The code does not store a city list. `adhoc` is for maintenance, power loss, and similar closures. An `adhoc` or `regional` row in a Brazil year does not block generation of that year's national rows.

The projection already ignores `active = false` and applies the three flags of an active row. It does not special-case `type`.

### 2. History reuses `admin_audit_events` and is shown in the panel

`AdminAuditService.record` already stores who did it and when. Every calendar write records one event: create, remove, activate, deactivate, and flag change. Actions: `delivery_calendar.create`, `delivery_calendar.remove`, `delivery_calendar.activate`, `delivery_calendar.deactivate`, `delivery_calendar.update`, and `delivery_calendar.sync_resend` (decision 4). A calendar event leaves `target_user_id` empty and puts `market`, `closed_on`, `type`, `label`, the previous and the new value of `active` and the three flags, and the subscriptions moved in `metadata`: the previous and the new preparation day, how each moved (Stripe sync, pending change, or projection only), and for a pending change the previous and the new `charge_move.trial_end`. Create has no previous value; remove has no new value.

The audit row is written inside the same MySQL transaction as the calendar change, so a rolled-back change leaves no event. Remove writes the event, then deletes the calendar row. The audit table has no foreign key to the calendar row, which is what keeps a removed date traceable.

The panel lists those events for the selected market and year, newest first, with actor, time, action, date, before and after, and the moved subscriptions. A new history table would duplicate actor and timestamp.

### 3. A closure moves editable deliveries and is refused over a locked one

Later deliveries are projected from Stripe renewals. They are not their own rows. Before storing a closure, the API runs the same projection as Meu Plano for subscriptions in that market and returns the ones whose preparation, pickup, or delivery lands on `closed_on` for a flag this closure sets. The dialog lists those subscriptions, marks which are locked, and does not call Stripe.

The same rule applies to every write that closes a day for a flag that was open: a new row, a reactivated row, and an edit that turns a flag on.

On confirm, the API runs the projection again inside the transaction, because the preview can be stale:

- If any affected delivery is locked, the closure is refused and nothing is saved. Operations resolves that delivery by hand first.
- Otherwise each affected editable delivery moves to the next valid preparation day after the closure, in one of three ways:
  - **Stripe sync.** The next delivery of a `trialing` subscription whose `trial_end` (the ledger's `current_period_end`) is 00:00 of the affected preparation day in the market timezone, the shape skip and postpone write. A sync row targets 00:00 of the new preparation day (decision 4).
  - **Pending change rewritten.** A following delivery whose `pending_delivery_changes.charge_move.trial_end` is 00:00 of the affected preparation day. Stripe does not have that value yet; `invoice.paid` of the current charge applies it later. The transaction rewrites `charge_move.trial_end` to 00:00 of the new preparation day and writes no sync row. `after_charge_at` and the pending packs stay as they are.
  - **Projection only.** Any other delivery: a renewal charged at the end of its period, or a later delivery that exists only in the projection. No stored value changes; the preparation day moves because the projection reads the new row.

The preview lists, for each affected delivery, which of the three applies, and for a pending change the previous and the new `trial_end`.

The transaction does not touch the ledger's `current_period_end`. After the job writes Stripe, the ledger gets the new `trial_end` the way it gets every other subscription change: `customer.subscription.updated` reaches `StripeWebhookService.handleSubscriptionChanged`, which upserts `currentPeriodEnd` from the subscription's period end (for a trialing subscription, the `trial_end`). The hourly `ledger_reconcile` job reads every subscription from Stripe and upserts the same field if the webhook is lost. Until then Meu Plano already shows the new preparation day, and the edit deadline is still computed from the old charge.

A pending change cannot sit on a delivery whose charge the closure moves through Stripe: a pending change is recorded only while the current delivery is past its edit deadline, and such a delivery is locked, so the closure is refused.

The calendar row, the rewritten pending changes, the sync rows, and the audit event commit in one MySQL transaction. If any of it fails, nothing is saved and the operator gets an error. The request itself does not call Stripe.

Removing or deactivating a row only makes that date open for later projection. It does not rewrite a delivery that is already scheduled, does not clear a `trial_end` already stored, and writes no sync row.

### 4. Stripe `trial_end` goes through an outbox

A new table `delivery_calendar_stripe_syncs` holds one row per moved subscription: the subscription, the audit event that caused it, the `trial_end` Stripe is expected to have now (`expected_trial_end`), the new value (`target_trial_end`), the value found in Stripe when a conflict is detected (`found_trial_end`), `status` (`pending`, `synced`, `failed`, `conflict`, `superseded`), `attempts`, `last_error`, `next_attempt_at`, `created_at`, and `synced_at`.

A background job `delivery_calendar_stripe_sync` runs on the existing scheduler with its own named lock. Each tick takes due `pending` rows and, per row:

1. Reads the subscription from Stripe. If its `trial_end` already equals `target_trial_end`, the row becomes `synced` with no write.
2. If its `trial_end` is neither `expected_trial_end` nor `target_trial_end` (a skip, a postpone, or a charge happened meanwhile), the row stores that value in `found_trial_end`, becomes `conflict`, and nothing is written. The job never sets a trial on a subscription whose charge already ran on its own.
3. Otherwise it sets `trial_end` to `target_trial_end` with `proration_behavior: 'none'` and the idempotency key `delivery-calendar-sync:<row id>:<attempts>:<next_attempt_at>`, then marks the row `synced`. Each retry and each resend changes that key, so Stripe never replays a stored failure; the same row state gives the same key, so a crash between Stripe and MySQL stays safe.

A transient error increments `attempts`, stores `last_error`, and sets `next_attempt_at` with exponential backoff. After 8 attempts the row becomes `failed`. A row whose outcome cannot even be stored is marked `failed` with the message, logged, and the tick goes on with the next row. Because of steps 1 and 3, running the same row twice leaves Stripe as one run would.

When a new closure moves a subscription that still has a `pending` row, the old row becomes `superseded` and the new row keeps the old row's `expected_trial_end`, so one pending row per subscription is the only writer.

The panel shows a sync as delayed when it is still `pending` 15 minutes after `created_at`, and lists `failed` and `conflict` rows together, with the subscription, the expected `trial_end`, the target, the value found in Stripe (for `conflict`), the attempts, and `last_error`. The 15 minutes and 8 attempts are defaults, set in backend config.

A user with `production.write` can resend a `failed` or `conflict` row:

- `failed`: the row goes back to `pending` with `attempts` at 0 and `next_attempt_at` now. `expected_trial_end` stays.
- `conflict`: before confirming, the screen shows the value found in Stripe and the target. On confirm, the API reads Stripe again; if `trial_end` is no longer the found value shown, the resend is refused and the row keeps its new found value. Otherwise `expected_trial_end` becomes the found value and the row goes back to `pending`, so the job overwrites it with the target.
- Either resend is refused when the target `trial_end` is already in the past, because the charge it was meant to move has passed.

Each resend records `delivery_calendar.sync_resend` with the sync row, the subscription, the previous status, and the expected, found, and target values. A superseded or synced row cannot be resent.

### 5. The page matches the production queue shell

Route under Operação, beside Produção, using `PageFrame`, `FiltersBar` (market and year), a table, and `Dialog` for create and for the affected-subscription list. HTTP stays on `apiRequest`. Copy is Portuguese, including empty, loading, and error. A session limited to one market by `operations/admin-market-scope` does not list or edit the other market. An admin session can use both.

Every read of the calendar goes to MySQL, so a committed write is seen by every API process at once.

The screen uses the production queue's permissions. `production.read` lists the calendar, the history, the sync status, and the alerts. `production.write` (`admin` and `operator`) creates, edits flags, deactivates, reactivates, removes, and resends a sync. `readonly` sees the page with no write controls, and the API refuses its writes.

### 6. Short notice warns and does not block

When the operator saves a closure whose `closed_on` is less than 7 days after today in the market timezone, the dialog shows a warning and still lets the save go ahead. The rule of decision 3 still applies.

### 7. Missing UPS calendar warns the panel 90 days ahead

The covered end of the United States is 31 December of the last year with a loaded UPS calendar: active `carrier` rows in that year, where a lone 1 January carried from the previous schedule does not count. When today in `America/New_York` is less than 90 days before that end, the panel shows a warning that the next UPS year is missing. When no year is covered, the warning shows at once. Loading the next year moves the end and clears the warning. Today the calendar covers 2027 (2028 has only 1 January), so the warning starts in October 2027.

## Risks / Trade-offs

- [A closure lands on a day whose `trial_end` is already 00:00] → The confirm moves that delivery and queues the new `trial_end`; a locked delivery refuses the closure. The customer sees the new date in Meu Plano as soon as the transaction commits, because the projection skips the closed day.
- [The old `trial_end` arrives before the job syncs] → Stripe charges at the old time. Production still waits for the moved preparation day, because preparation is the first valid day after payment. The job then sees a `trial_end` that matches neither value and marks the row `conflict` instead of setting a new trial. The panel lists it.
- [Stripe is down for a long time] → Rows stay `pending` with backoff, show as delayed after 15 minutes, and become `failed` after 8 attempts. MySQL already holds the closure and the moved dates, so the panel and Meu Plano agree with each other while Stripe catches up.
- [A customer skips or postpones while a sync is pending] → That write changes `trial_end` directly. The job finds a value it did not expect and marks `conflict` without overwriting the customer's choice.
- [Resending a `conflict` overwrites what Stripe has] → The operator sees both values first, the API refuses if Stripe changed again since, and the resend is audited. Resending over a skip undoes the customer's skip; the screen says so in the confirmation.
- [Two closures move the same subscription before the job runs] → The second supersedes the first and keeps the original expected value, so the job writes only the final date.
- [Deleting a Brazil national row] → Generation fills a year only when it has no national rows, so a deleted one would not come back. The API refuses to delete `national` rows. They are only deactivated.
- [The affected list is projected, so it can change between preview and save] → The confirm projects again and checks locks again inside the transaction.

## Migration Plan

1. `redesign-my-plan` must create and seed `delivery_closed_days` before this screen can list a year.
2. A backend migration adds `type`, fills it from `origin`, and swaps the unique key to (`market`, `closed_on`, `type`). A second migration creates `delivery_calendar_stripe_syncs`. Both run before the write API.
3. The sync job ships with or before the write API, so no sync row waits without a worker. The write endpoints ship only together with rescheduling and audit, so no endpoint can close a day without both.
4. Ship the API and the page after the spec and tasks exist.
5. Rollback hides the route and leaves the rows. The sync job keeps draining pending rows. Meu Plano keeps reading whatever is still active. No customer data migration.

## Open Questions

None. The four questions were answered:

1. Entregas já agendadas num dia que passa a fechar: as editáveis vão para o próximo dia válido, com `trial_end` atualizado. Se houver entrega travada, o fechamento é bloqueado. Fechamento e remarcações são salvos numa única transação, junto com uma linha de sincronização por assinatura; o `trial_end` vai para o Stripe por um job com retentativas idempotentes (decisões 3 e 4).
2. Quem pode editar: os administradores que já controlam a fila de produção, ou seja, `production.write` (`admin` e `operator`) (decisão 5).
3. Antecedência mínima: não bloqueia; alerta quando faltar menos de 7 dias (decisão 6).
4. Calendário UPS faltando: alerta no admin quando faltarem menos de 90 dias para o fim dos dias cadastrados do mercado US (decisão 7).

O caso do feriado que não volta (o `adhoc` de 01/01/2028) foi resolvido separando as linhas por tipo, na decisão 1.
