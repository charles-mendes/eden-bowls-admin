## ADDED Requirements

### Requirement: Ready orders past their day have their own group

Rows whose `dueBucket` is `overdue` and whose production status is ready MUST be shown in a group "Prontos para expedir", placed before the "Atrasados" group, and MUST NOT be shown under "Atrasados". The "Atrasados" metric card MUST keep showing the API's `overdue` metric, which counts only overdue rows not ready.

#### Scenario: One late order ready and one still in the kitchen

- **WHEN** the queue lists two overdue rows, one ready and one to prepare, and the metric `overdue` is 1
- **THEN** the ready row is under "Prontos para expedir", the other under "Atrasados", and the card shows Atrasados 1

#### Scenario: Marked ready from the overdue filter

- **WHEN** an operator on `?prazo=atrasados` marks an overdue Brazil row ready
- **THEN** after the refresh the row is under "Prontos para expedir" with its fulfillment action

## MODIFIED Requirements

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
