# operations/production-queue Specification

## Purpose

Gives kitchen operators a queue of Stripe subscriptions due soon, with pack/flavor mix from the persisted checkout snapshot and a per-cycle production status overlay that does not duplicate the billing ledger.

## Requirements

### Requirement: Queue membership follows live Stripe ledger status

The production queue SHALL list production cycles, not subscriptions. A cycle is keyed by `(subscription_id, period_end)`, where `period_end` is the charge the cycle belongs to. The queue MUST include two kinds of cycle. An unpaid cycle is the ledger's next renewal (`current_period_end`), or for a `past_due` subscription the renewal that failed (`current_period_start`), when no paid cycle exists for that key; it MUST require Stripe status `active`, `trialing`, or `past_due`, and `cancel_at_period_end` false unless the status is `past_due`. A paid cycle is any cycle whose invoice was paid; it MUST stay listed whatever the subscription status or `cancel_at_period_end`, until it is marked ready. A ready paid cycle of the Brazil shipping market whose preparation day passed, no more than 30 days ago, MUST stay listed until a courier delivery is registered for its invoice, as the API returns it. The first delivery MUST be listed: the paid `subscription_create` invoice records it as a paid cycle. One subscription MAY appear twice, once for a paid cycle and once for its next renewal. The system MUST exclude unpaid cycles of `paused`, `canceled`, `incomplete`, and `incomplete_expired` subscriptions.

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

#### Scenario: Late Brazil order marked ready

- **WHEN** an operator marks ready a paid Brazil cycle prepared 24 days ago that has not left
- **THEN** the row stays in the queue, now ready, until a delivery is registered for its invoice

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

### Requirement: Calendar buckets are disjoint civil days

The system SHALL compute `daysUntil` as the difference in civil calendar dates in the query timezone. US account filter MUST still default buckets to `America/Sao_Paulo` when timezone is omitted. Each item MUST expose `dueBucket` of `overdue` (`daysUntil < 0`), `today` (`0`), `tomorrow` (`1`), or `upcoming` (`> 1`), and labels: 0 → “Vence hoje”; 1 → “Amanhã”; `> 1` → “Faltam N dias”; `< 0` → “Atrasado N dias”.

#### Scenario: Same civil day is today even if hours remain

- **WHEN** period end is later today in `America/Sao_Paulo`
- **THEN** `daysUntil` is 0, `dueBucket` is `today`, and the label is “Vence hoje”

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

### Requirement: Queue items expose kitchen-ready pack and flavor mix

Each queue item MUST support these grid columns, in order: Vencimento (datetime + due badge); Cliente (ledger snapshot: email, plus name from the row address when present — not a live WordPress `displayName`); Pets + mix de sabores × quantidade; Packs (sum of quantities) + tamanho (`500 g` or “misto”); Plano (`plan_label` + term); País / cidade; Pagamento (Stripe status); Produção (badge); Ações (status advance when permitted; link Assinante / Cliente and link Onboarding 360 only when `customerProfileInScope` is true). When `customerProfileInScope` is false, Cliente identity MUST remain visible as text without those links. Plan subtotal MUST appear only when `catalog_pricing.subtotal` exists. Packs and flavors MUST come from `plan_selection.catalog_pricing.line_items` when present, else `pets[].selected_flavors` / `flavor_weights`. When a positive term in months is present, the Plano term subline MUST use the same spelled-out form as Onboarding 360 checkouts (`1 mês` or `<n> meses`) and MUST NOT use compact `Nm`. When the term is missing, the subline MUST be omitted.

#### Scenario: Line items drive packs and flavors

- **WHEN** `catalog_pricing.line_items` contains two beef 500 g packs and one turkey 500 g pack
- **THEN** the item shows flavor mix “beef × 2, turkey × 1”, pack count 3, size “500 g”, and `lineItems.length` 2 or 3 according to the snapshot lines

#### Scenario: Mixed pack sizes are dense

- **WHEN** line items include both 500 g and another pack size
- **THEN** pack size is “misto” and the mix is dense

#### Scenario: Missing subtotal

- **WHEN** `catalog_pricing.subtotal` is absent
- **THEN** the value shows a placeholder, not zero invented from other fields

#### Scenario: Cliente uses ledger identity

- **WHEN** a queue item has ledger email `ana@edenbowls.com` and a WordPress display name that differs
- **THEN** the Cliente column shows the ledger email (and snapshot name when present), not the live WordPress display name

#### Scenario: Out-of-scope profile hides Onboarding 360

- **WHEN** a queue item has `customerProfileInScope` false
- **THEN** Onboarding 360 and Assinante/Cliente are not links

#### Scenario: Plan term is spelled out

- **WHEN** a queue item has `plan_label` and term months 1
- **THEN** the Plano column shows the plan label and **1 mês**, not `1m`

#### Scenario: Missing plan term hides the subline

- **WHEN** a queue item has a plan label and no positive term months
- **THEN** the Plano column does not show a term subline

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

The admin app MUST expose **Produção** at `/operations/production` in the Operação menu for `admin`, `operator`, and `readonly`, and MUST hide it from veterinarian-only accounts. The page MUST show four metric cards bound to `metrics`: Vence hoje (`today`), Amanhã (`tomorrow`), Próximos Nd (`upcoming`, N = `windowDays`), Atrasados (`overdue`). Filters: window 7/14/30, account (admin: todas|BR|US; single-market staff: only their Stripe account, locked), production status todos|a preparar|em produção|pronto|bloqueado, search `q`, include overdue, clear. Single-market staff MUST send their account on every queue request and MUST NOT be able to select the other account. The table MUST use the grid columns defined above, group visible rows by `dueBucket`, key rows by subscription and cycle, and MUST NOT display last4, street, or postal code. The Vencimento column MUST show a paid cycle's preparation day and an unpaid cycle's charge. The Produção column MUST show the payment label when there is one. Empty state MUST read “Nenhuma renovação nesta janela.” Loading MUST use the panel table skeleton. Errors MUST render in `div.alert`. Callers with `production.write` MUST see status-advance actions; others MUST not. "Em produção" MUST NOT be offered for an unpaid cycle. Dense mix MAY open a dialog of `lineItems`. Blocking MUST prompt for a required note.

#### Scenario: Operator opens Produção

- **WHEN** an operator with `production.read` opens `/operations/production`
- **THEN** they see the four KPIs, filters, and the grid columns of due cycles

#### Scenario: Awaiting payment hides the start action

- **WHEN** an operator with `production.write` sees an unpaid cycle and a paid cycle
- **THEN** the unpaid row shows "Aguardando pagamento" and only "Bloquear", and the paid row offers "Em produção"

#### Scenario: Veterinarian cannot reach the screen via the menu

- **WHEN** a veterinarian-only session loads the shell
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

### Requirement: Queue shows stock coverage

For each item whose `stockCoverage` is not null, the Produção column MUST show a coverage badge: `covered` → "Coberto", `short` → "Falta estoque" in the warning colour, `unknown` → "Sem tamanho". Items with null coverage MUST show no badge. The "Falta estoque" badge MUST be a link to Estoque filtered by `situacao=short` and, when the session has both markets, by the item's market. When `stockShortages` has a single entry, the link MUST also search for that recipe name.

#### Scenario: Later delivery is short

- **WHEN** the queue returns a `to_prepare` cycle with `stockCoverage` `short`
- **THEN** its Produção column shows "Falta estoque"

#### Scenario: One recipe short

- **WHEN** a short cycle has one shortage, "Frango", and the session has both markets
- **THEN** "Falta estoque" links to `/operations/stock?mercado=BR&situacao=short&busca=Frango`

#### Scenario: Two recipes short

- **WHEN** a short cycle has two shortages
- **THEN** the link filters by `situacao=short` without a search

#### Scenario: Ready cycle has no badge

- **WHEN** a `ready` cycle has `stockCoverage` null
- **THEN** no coverage badge appears

### Requirement: Separation shortage warning

After a successful update to `ready` whose response has a non-empty `stock.shortages` or a positive `stock.unsized`, the page MUST show a non-blocking warning listing each short item with its on-hand after the separation, and the number of lines without size. The status change MUST already be applied.

#### Scenario: Marked ready with too little stock

- **WHEN** an operator marks a cycle ready and the response lists `frango / 300 g` at -2
- **THEN** the row shows `ready` and a warning reads "Separado com estoque negativo: frango 300 g (-2)."

### Requirement: Ready row points to fulfillment

A `ready` row MUST replace "Concluído" with "Expedir". When the item's `stripeAccount` is `br` and its `country` is `BR`, it MUST link to `/operations/courier?fatura={paidInvoiceId}&assinatura={id}` using that item's `paidInvoiceId` and its subscription `id`. When the item's `deliveryDate` is after tomorrow (civil days in `America/Sao_Paulo`), the link MUST also carry `de={today}&ate={deliveryDate}`, so Entregas Brasil loads a range that holds that order; when `deliveryDate` is tomorrow or earlier, or absent, the link MUST NOT carry `de` or `ate`. When the item has no `paidInvoiceId`, it MUST link to `/operations/courier` with no query. When the `stripeAccount` is `us` and the `country` is `US`, it MUST link to `/operations/labels`. Otherwise it MUST show "Mercado divergente" without a link. When a Brazil row's `courierIssues` is not empty, the row MUST show "Travado: " followed by what is missing, in the same words as Entregas Brasil, instead of "Expedir", with a link "Ver na entrega" to the same courier path; when `courierIssues` is empty, null or absent, the row MUST show "Expedir" as above. The top of the queue MUST link to the fulfillment screens of the session's markets.

#### Scenario: Brazilian ready order

- **WHEN** a ready row has `id` 42, `stripeAccount: "br"`, `country: "BR"` and `paidInvoiceId: "in_123"`
- **THEN** it shows "Expedir" linking to `/operations/courier?fatura=in_123&assinatura=42`

#### Scenario: US ready order

- **WHEN** a ready row has `stripeAccount: "us"` and `country: "US"`
- **THEN** it shows "Expedir" linking to `/operations/labels`

#### Scenario: Account and address in different countries

- **WHEN** a ready row has `stripeAccount: "us"` and `country: "BR"`
- **THEN** it shows "Mercado divergente" and no fulfillment link

#### Scenario: Ready ahead of the delivery day

- **WHEN** on 2026-11-08 a ready Brazil row has `id` 42, `paidInvoiceId: "in_123"` and `deliveryDate: "2026-11-11"`
- **THEN** "Expedir" links to `/operations/courier?fatura=in_123&assinatura=42&de=2026-11-08&ate=2026-11-11`

#### Scenario: No delivery date

- **WHEN** a ready Brazil row has `id` 42, `paidInvoiceId: "in_123"` and no `deliveryDate`
- **THEN** "Expedir" links to `/operations/courier?fatura=in_123&assinatura=42` with no range

#### Scenario: No paid invoice on the item

- **WHEN** a ready Brazil row has no `paidInvoiceId`, as with an API that does not send it yet
- **THEN** "Expedir" links to `/operations/courier`

#### Scenario: Ready order held by the address

- **WHEN** a ready Brazil row has `id` 42, `paidInvoiceId: "in_123"` and `courierIssues: ["recipient_name_missing"]`
- **THEN** it shows "Travado: Falta o nome de quem recebe" and a link "Ver na entrega" to `/operations/courier?fatura=in_123&assinatura=42`, and no "Expedir"

#### Scenario: API without courierIssues

- **WHEN** a ready Brazil row has no `courierIssues`
- **THEN** it shows "Expedir" as before

### Requirement: Blocking an unpaid cycle warns about the charge

When the cycle being blocked is not paid (`paymentState` is `awaiting_payment` or `past_due`), the "Bloquear pedido" dialog MUST ask for the block preview of that cycle and state that blocking postpones the charge and that reopening may charge the customer at once. When the preview answers a `chargeMovesTo`, the text MUST give that date, in the market's timezone, as "Bloquear adia a cobrança para {dd/mm}". While the preview loads, when it fails, or when it has no date, the text MUST stay without a date. For a paid cycle the dialog MUST NOT ask for the preview nor show this text.

#### Scenario: Block an unpaid cycle

- **WHEN** the operator opens "Bloquear pedido" on a row with `paymentState: "awaiting_payment"` and the preview answers `chargeMovesTo` on 12 November
- **THEN** the dialog says "Bloquear adia a cobrança para 12/11" and that reopening may charge at once

#### Scenario: Preview fails

- **WHEN** the preview answers an error
- **THEN** the dialog says the charge is postponed, without a date, and the block can still be confirmed

#### Scenario: Block a paid cycle

- **WHEN** the operator opens "Bloquear pedido" on a paid row
- **THEN** no preview is requested and the dialog shows no charge warning

### Requirement: Queue search matches the name the queue shows

The queue search (`q`) MUST also match, case-insensitively and as a substring, the subscription address keys the queue reads the customer name from: `recipient_name`, `name`, `full_name` and `recipient`, and the account name the queue shows when the address has none. It MUST keep matching email, Stripe ids and user id. The search field placeholder MUST read "Nome ou e-mail".

#### Scenario: Search by recipient

- **WHEN** a subscription address has `recipient_name: "Ana Souza"` and the operator searches "souza"
- **THEN** the queue lists that cycle

#### Scenario: Search by a legacy name key

- **WHEN** an older subscription address has only `full_name: "Bruno Lima"` and the operator searches "bruno"
- **THEN** the queue lists that cycle

#### Scenario: Search by account name

- **WHEN** a subscription address has no recipient, the account name is "Carla Dias" and the operator searches "dias"
- **THEN** the queue lists that cycle, showing "Carla Dias"

### Requirement: Marking a short order ready asks first

"Marcar como pronto" on a row with `stockCoverage: "short"` MUST open a confirmation before the status change. The confirmation MUST say "Pela ordem da fila, falta estoque de {recipes} para este pedido. Marcar como pronto pode deixar o saldo negativo.", listing the `stockShortages` recipes and pack sizes. It MUST offer "Marcar como pronto", which sends the change, "Abrir estoque", which opens the badge's link, and cancel. Other rows MUST change at once, as today.

#### Scenario: Short order

- **WHEN** the operator clicks "Marcar como pronto" on a short row missing Frango 300 g
- **THEN** a confirmation names "Frango 300 g" and nothing is sent until they confirm

#### Scenario: Covered order

- **WHEN** the operator clicks "Marcar como pronto" on a covered row
- **THEN** the change is sent with no confirmation

### Requirement: Ready orders past their day have their own group

Rows whose `dueBucket` is `overdue` and whose production status is ready MUST be shown in a group "Prontos para expedir", placed before the "Atrasados" group, and MUST NOT be shown under "Atrasados". The "Atrasados" metric card MUST keep showing the API's `overdue` metric, which counts only overdue rows not ready. The card MUST carry the text "Só o que a cozinha não terminou. Pronto esperando saída não conta." and MUST NOT show a second number. Under `?prazo=atrasados` without a status filter, the list MUST hold only what the API returns for `due=overdue`, which leaves out ready rows. When a single or batch status change sets ready while `?prazo=atrasados` is active, the panel MUST show a notice with role `status` saying the order left Atrasados and waits in "Prontos para expedir" (for a batch, how many), with a link to the queue filtered by status Pronto that keeps the market filter. A row under "Prontos para expedir" MUST NOT show the red "Atrasado N dias" badge; it MUST show a warning badge "Aguardando saída há N dias" ("há 1 dia"), N being how many days ago its preparation day was. Rows under "Atrasados" MUST keep the red "Atrasado N dias" badge.

#### Scenario: One late order ready and one still in the kitchen

- **WHEN** the queue without a due filter lists two overdue rows, one ready and one to prepare, and the metric `overdue` is 1
- **THEN** the ready row is under "Prontos para expedir", the other under "Atrasados", and the card shows Atrasados 1

#### Scenario: A ready row says how long it waits to leave

- **WHEN** the queue lists a ready row prepared 24 days ago and a row to prepare from the same day
- **THEN** the ready row shows "Aguardando saída há 24 dias" as a warning badge, and the other shows "Atrasado 24 dias" in red

#### Scenario: Marked ready from the overdue filter

- **WHEN** an operator on `?prazo=atrasados&mercado=br` marks an overdue Brazil row ready
- **THEN** after the refresh the row is no longer in the list, and a notice says it left Atrasados and waits in "Prontos para expedir", with a link to `?status=ready&mercado=br`

#### Scenario: Batch marked ready from the overdue filter

- **WHEN** an operator on `?prazo=atrasados` marks two overdue rows ready in a batch
- **THEN** after the refresh neither row is in the list, and the notice says 2 orders went to "Prontos para expedir"

#### Scenario: Marked ready without the overdue filter

- **WHEN** an operator on the queue without a due filter marks an overdue Brazil row ready
- **THEN** after the refresh the row is under "Prontos para expedir" with its fulfillment action, and no notice is shown

#### Scenario: The card says what it counts

- **WHEN** the queue shows the "Atrasados" card
- **THEN** the card shows the `overdue` number and the text "Só o que a cozinha não terminou. Pronto esperando saída não conta.", and no other number

### Requirement: A ready row locked by the recipient name can be filled here
A row locked by `recipient_name_missing` MUST offer "Informar quem recebe" to a user with `users.delivery.write`. It MUST open a dialog with one empty field, "Nome de quem recebe", the text "Fica nesta assinatura e vale para os próximos pedidos. O nome da conta não muda. Se for presente, confirme com o cliente." and "Salvar nome". When the item has `account_name`, the dialog MUST offer "Usar nome da conta ({account_name})", which fills the field without saving. A 409 `recipient_name_present` MUST say "Esta assinatura já tem nome de quem recebe." and reload. Saving MUST send the name to the subscription's recipient-name route and reload the list; a 422 MUST show under the field.

#### Scenario: Fill the suggested name

- **WHEN** a ready Brazil row has `courierIssues: ["recipient_name_missing"]` and `accountName: "Ana Costa"`, and an operator with `users.delivery.write` clicks "Informar quem recebe", "Usar nome da conta (Ana Costa)" and "Salvar nome"
- **THEN** the panel sends "Ana Costa" for that subscription, reloads the queue, and the row offers "Expedir"

#### Scenario: Without the permission

- **WHEN** the operator lacks `users.delivery.write`
- **THEN** the row shows the lock and "Ver na entrega" only

### Requirement: A name taken from the account is marked

When a queue item has `nameSource: "account"`, the row MUST show the name followed by "(conta)" in muted text, so it does not read as the recipient. With `recipient` or `email` the row MUST show the name as today.

#### Scenario: Account name beside the lock

- **WHEN** a ready row has `displayName: "Ana Costa"`, `nameSource: "account"` and `courierIssues: ["recipient_name_missing"]`
- **THEN** the row shows "Ana Costa (conta)" and "Travado: Falta o nome de quem recebe"

### Requirement: Queue shows each order's boxes

Each production queue item MUST show its `boxes` from the API, by box name and pack count, for example "Caixa mensal · 30 pacotes + Caixa mensal · 15 pacotes", so the kitchen packs the right boxes. An item without `boxes` MUST show nothing extra.

#### Scenario: Order with two boxes

- **WHEN** an item has two monthly boxes with 30 and 15 packs
- **THEN** the item shows both boxes with their pack counts
