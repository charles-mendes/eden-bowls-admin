# Spec Delta

Origin: `redesign-my-plan` (`eden-bowls` OpenSpec), tasks 1.5, 3.12, and 3.13.

## MODIFIED Requirements

### Requirement: Queue membership follows live Stripe ledger status

The production queue SHALL list production cycles, not subscriptions. A cycle is keyed by `(subscription_id, period_end)`, where `period_end` is the charge the cycle belongs to. The queue MUST include two kinds of cycle. An unpaid cycle is the ledger's next renewal (`current_period_end`), or for a `past_due` subscription the renewal that failed (`current_period_start`), when no paid cycle exists for that key; it MUST require Stripe status `active`, `trialing`, or `past_due`, and `cancel_at_period_end` false unless the status is `past_due`. A paid cycle is any cycle whose invoice was paid; it MUST stay listed whatever the subscription status or `cancel_at_period_end`, until it is marked ready. The first delivery MUST be listed: the paid `subscription_create` invoice records it as a paid cycle. One subscription MAY appear twice, once for a paid cycle and once for its next renewal. The system MUST exclude unpaid cycles of `paused`, `canceled`, `incomplete`, and `incomplete_expired` subscriptions.

#### Scenario: Active subscription with a period end is queued

- **WHEN** an `active` subscription has `cancel_at_period_end` false and its next renewal inside the selected window
- **THEN** that renewal appears once in the queue as awaiting payment

#### Scenario: Past-due still needs a bowl

- **WHEN** an otherwise eligible subscription is `past_due`
- **THEN** the renewal that failed remains in the queue as "Pagamento atrasado", the payment column shows the past-due Stripe status, and it cannot move to production until it is paid

#### Scenario: Cancel-at-period-end stays out

- **WHEN** an `active` subscription with no paid cycle waiting has `cancel_at_period_end` true
- **THEN** no unpaid renewal of it is in the queue, because none follows

#### Scenario: Cancel-at-period-end keeps the paid delivery

- **WHEN** the last contracted delivery is paid and its `invoice.paid` sets `cancel_at_period_end`
- **THEN** that paid cycle stays in the queue until it is ready, and no renewal after it is listed

#### Scenario: First delivery is queued

- **WHEN** the `subscription_create` invoice is paid
- **THEN** the first delivery appears in the queue as a paid cycle due on its preparation day

#### Scenario: Canceled and incomplete stay out

- **WHEN** a subscription is `canceled`, `paused`, `incomplete`, or `incomplete_expired` and has no paid cycle waiting
- **THEN** it is absent from the queue even if `current_period_end` falls in the window

### Requirement: Civil window includes today even after the UTC timestamp

The system SHALL default `windowDays` to 7 and MUST accept 7, 14, or 30. Window membership MUST use the cycle's due date in civil dates of the query timezone (default `America/Sao_Paulo`). An unpaid cycle is due on its charge; a paid cycle is due on its preparation day, the first valid day of the market whose local midnight is at or after the payment. In-window rows are due today through today + `windowDays` days, inclusive of today even when the due instant is already earlier than UTC now. Query `includeOverdue` defaults to true. When true, overdue rows are those whose civil due date is before today, production status is not `ready`, and due date is not older than `windowDays` before today. `includeOverdue=0` MUST omit overdue rows and MUST NOT omit civil-today rows. When Stripe advances `current_period_end`, a paid cycle MUST stay listed by its own due date; only the unpaid renewal moves.

#### Scenario: Default 7-day civil window

- **WHEN** an operator loads the queue with no window query
- **THEN** in-window rows are those whose civil due date is today through 7 days ahead in the query timezone

#### Scenario: Period end earlier today is still today

- **WHEN** an unpaid cycle's charge is earlier than UTC now but still today's civil date in `America/Sao_Paulo`
- **THEN** the row is in the queue, `dueBucket` is `today`, and `includeOverdue=0` does not hide it

#### Scenario: Overdue capped and optional

- **WHEN** `includeOverdue` is true and a non-ready cycle's civil due date is 3 days before today with `windowDays=7`
- **THEN** it appears as overdue; a non-ready row 10 days before today does not; `includeOverdue=0` hides overdue rows

#### Scenario: Renewal advances the period end

- **WHEN** a cycle is paid and the ledger moves `current_period_end` to the next renewal
- **THEN** the paid cycle stays in the queue by its preparation day until it is ready, and the next renewal appears as awaiting payment when it enters the window

### Requirement: Operators can list a flattened production queue

Authorized callers MUST retrieve the queue via `GET /api/v1/admin/production/queue` with `production.read`. Query parameters: `windowDays` (7|14|30, default 7), `includeOverdue` (default true), `account`, `productionStatus`, `q` (email, `sub_`, `cus_`, user id), `timezone`, `page`, `perPage` (default 20, max 100). Items MUST sort by due date ascending, then ledger id ascending. Each item MUST carry `currentPeriodEnd` as the cycle's own key (the charge the cycle belongs to), `paymentState` (`awaiting_payment`, `past_due`, or `paid`), `paymentLabel` ("Aguardando pagamento", "Pagamento atrasado", or none), and for a paid cycle `preparationDay` and `deliveryDate`. The list MUST NOT include payment-method last4, street, or postal code. The response MUST use the shared paginated envelope plus `metrics: { today, tomorrow, upcoming, overdue }` as disjoint civil counts of due dates. Metrics MUST respect `windowDays`, `account`, and `includeOverdue`, and MUST ignore `q` and `productionStatus`. Each item MUST include a compact `lineItems` array (`flavor`, `quantity`, `packSize`, `petName` when known). Mix is dense when `lineItems.length > 3` or pack sizes are mixed.

#### Scenario: Paginated list with metrics

- **WHEN** an operator requests page 1 with default filters
- **THEN** the payload includes paginated flattened cycles ordered by due date then id and the four metric counts

#### Scenario: Search does not shrink KPIs

- **WHEN** the caller sends `q` matching one email while three other cycles are still due today
- **THEN** the list may contain one row and `metrics.today` remains 3

#### Scenario: Metrics ignore production status filter

- **WHEN** the grid is filtered to `productionStatus=in_production` but three other cycles are still due today
- **THEN** `metrics.today` still counts those three

### Requirement: Missing production cycle means to prepare

The system MUST treat an unpaid renewal with no production-cycle row as `to_prepare`, awaiting payment. A cycle row MUST be created on the first successful status update for that `(subscription_id, period_end)` pair, or by the `invoice.paid` that pays it, whichever comes first. The paid invoice MUST record `paid_at`, `paid_invoice_id`, `preparation_day`, and `delivery_date` on the cycle and keep its status; a repeated `invoice.paid` MUST keep the first payment. When a block or a return moves the charge of an unpaid cycle, its row MUST move to the new charge, keeping its status.

#### Scenario: First visit has no stored cycle

- **WHEN** an eligible renewal has never been patched or paid
- **THEN** the queue shows production status `to_prepare` and the payment label "Aguardando pagamento" without a pre-created row

#### Scenario: First patch persists the cycle

- **WHEN** an operator first blocks an unpaid renewal, or first sets a paid cycle to `in_production`, with the cycle's `periodEnd`
- **THEN** a cycle row is upserted for that cycle and later reads show the new status

#### Scenario: Payment records the cycle

- **WHEN** the invoice of a cycle is paid
- **THEN** a cycle row holds the payment, the preparation day, and the delivery date, and its status is unchanged

### Requirement: Operators can advance production status with a closed transition matrix

Authorized callers MUST update status via `PATCH /api/v1/admin/production/queue/:id` with `production.write`, where `:id` is the ledger id. Body MUST be `{ status, periodEnd, note? }`, where `periodEnd` is the cycle's own key from the queue. For a paid cycle the update MUST apply whatever the subscription status or `cancel_at_period_end`. For an unpaid cycle `periodEnd` MUST equal the next renewal (for `past_due`, the renewal that failed) and the subscription MUST be queue-eligible, or the update MUST fail with 409. Moving an unpaid cycle to `in_production` MUST fail with 409 `production_awaiting_payment`. Allowed transitions MUST be only:

| from | to_prepare | in_production | ready | blocked |
| --- | --- | --- | --- | --- |
| to_prepare | no | yes | no | yes |
| in_production | no | no | yes | yes |
| ready | no | yes | no | no |
| blocked | yes | no | no | no |

Any other edge, including `to_prepare → ready` and `ready → blocked`, MUST be rejected with 400. Transition to `blocked` MUST include `note` of 1–255 characters; other transitions MUST NOT require `note`. Blocking an unpaid cycle before preparation MUST set Stripe `trial_end` to 00:00 of the next valid preparation day of the following delivery, in the market timezone, without proration; returning it to `to_prepare` before that start MUST restore 00:00 of the original preparation day, or the next valid one, and a return after that start MUST charge at once. A paid cycle MUST NOT move Stripe. A successful update MUST record admin audit action `production.status.update`.

#### Scenario: Happy path to ready

- **WHEN** an operator moves a paid `to_prepare` cycle to `in_production` and then to `ready` with its `periodEnd`
- **THEN** both updates succeed and the queue shows `ready`

#### Scenario: Unpaid cycle cannot start production

- **WHEN** an operator moves an unpaid cycle to `in_production`
- **THEN** the response is 409 `production_awaiting_payment` and no cycle is written

#### Scenario: Block before preparation moves the charge

- **WHEN** an operator blocks an unpaid cycle before its preparation day
- **THEN** Stripe `trial_end` moves to 00:00 of the following delivery's next valid preparation day, the queue still shows the cycle as blocked, and returning it restores the original preparation day

#### Scenario: Block from in_production requires a note

- **WHEN** an operator sets `in_production` to `blocked` with a 1–255 character note
- **THEN** the item is blocked with that note

#### Scenario: Block without a note is rejected

- **WHEN** an operator sets a non-ready item to `blocked` with a missing or empty note
- **THEN** the update is rejected and the cycle is unchanged

#### Scenario: Reopen a ready cycle

- **WHEN** an operator sets a `ready` paid cycle to `in_production` with its `periodEnd`
- **THEN** the update succeeds

#### Scenario: Stale period end

- **WHEN** the PATCH `periodEnd` matches neither a paid cycle nor the subscription's unpaid renewal
- **THEN** the response is 409 and no cycle is written

#### Scenario: Subscription left the queue

- **WHEN** an unpaid cycle's ledger row is `canceled`, has `cancel_at_period_end` true, or has no `current_period_end`
- **THEN** PATCH returns 409 and no cycle is written

#### Scenario: Unauthorized write

- **WHEN** a caller without `production.write` sends PATCH
- **THEN** the update is rejected and the cycle is unchanged

### Requirement: Production screen is an Operação queue for kitchen staff

The admin app MUST expose **Produção** at `/operations/production` in the Operação menu for `admin`, `operator`, and `readonly`, and MUST hide it from nutritionist-only accounts. The page MUST show four metric cards bound to `metrics`: Vence hoje (`today`), Amanhã (`tomorrow`), Próximos Nd (`upcoming`, N = `windowDays`), Atrasados (`overdue`). Filters: window 7/14/30, account (admin: todas|BR|US; single-market staff: only their Stripe account, locked), production status todos|a preparar|em produção|pronto|bloqueado, search `q`, include overdue, clear. Single-market staff MUST send their account on every queue request and MUST NOT be able to select the other account. The table MUST use the grid columns defined above, group visible rows by `dueBucket`, key rows by subscription and cycle, and MUST NOT display last4, street, or postal code. The Vencimento column MUST show a paid cycle's preparation day and an unpaid cycle's charge. The Produção column MUST show the payment label when there is one. Empty state MUST read “Nenhuma renovação nesta janela.” Loading MUST use the panel table skeleton. Errors MUST render in `div.alert`. Callers with `production.write` MUST see status-advance actions; others MUST not. "Em produção" MUST NOT be offered for an unpaid cycle. Dense mix MAY open a dialog of `lineItems`. Blocking MUST prompt for a required note.

#### Scenario: Operator opens Produção

- **WHEN** an operator with `production.read` opens `/operations/production`
- **THEN** they see the four KPIs, filters, and the grid columns of due cycles

#### Scenario: Awaiting payment hides the start action

- **WHEN** an operator with `production.write` sees an unpaid cycle and a paid cycle
- **THEN** the unpaid row shows "Aguardando pagamento" and only "Bloquear", and the paid row offers "Em produção"

#### Scenario: Nutritionist cannot reach the screen via the menu

- **WHEN** a nutritionist-only session loads the shell
- **THEN** Produção is absent from the menu and the only Operação item remains the nutrition simulator

#### Scenario: Readonly can view but not change status

- **WHEN** a readonly user opens Produção
- **THEN** the queue is visible with the same columns (no street/last4) and status-advance controls are hidden

#### Scenario: Empty window

- **WHEN** the API returns zero items for the current filters
- **THEN** the page shows “Nenhuma renovação nesta janela.”

#### Scenario: Operator BR cannot list the US queue

- **WHEN** an operator assigned `BR` opens Produção
- **THEN** the account filter is locked to BR, “Todas” is absent, and the queue request sends `account=br`
