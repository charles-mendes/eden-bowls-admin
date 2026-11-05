# Spec Delta

## ADDED Requirements

### Requirement: Ready row points to fulfillment

A `ready` row MUST replace "Concluído" with "Expedir". It MUST link to `/operations/courier` when the item's `stripeAccount` is `br` and its `country` is `BR`, and to `/operations/labels` when the `stripeAccount` is `us` and the `country` is `US`. Otherwise it MUST show "Mercado divergente" without a link. The top of the queue MUST link to the fulfillment screens of the session's markets.

#### Scenario: Brazilian ready order

- **WHEN** a ready row has `stripeAccount: "br"` and `country: "BR"`
- **THEN** it shows "Expedir" linking to `/operations/courier`

#### Scenario: US ready order

- **WHEN** a ready row has `stripeAccount: "us"` and `country: "US"`
- **THEN** it shows "Expedir" linking to `/operations/labels`

#### Scenario: Account and address in different countries

- **WHEN** a ready row has `stripeAccount: "us"` and `country: "BR"`
- **THEN** it shows "Mercado divergente" and no fulfillment link

### Requirement: Blocking an unpaid cycle warns about the charge

When the cycle being blocked is not paid (`paymentState` is `awaiting_payment` or `past_due`), the "Bloquear pedido" dialog MUST state that blocking postpones the charge and that reopening may charge the customer at once. For a paid cycle the dialog MUST NOT show this text.

#### Scenario: Block an unpaid cycle

- **WHEN** the operator opens "Bloquear pedido" on a row with `paymentState: "awaiting_payment"`
- **THEN** the dialog says the charge is postponed and reopening may charge at once

#### Scenario: Block a paid cycle

- **WHEN** the operator opens "Bloquear pedido" on a paid row
- **THEN** the dialog shows no charge warning

### Requirement: Queue search matches the name the queue shows

The queue search (`q`) MUST also match, case-insensitively and as a substring, the subscription address keys the queue reads the customer name from: `recipient_name`, `name`, `full_name` and `recipient`. It MUST keep matching email, Stripe ids and user id. The search field placeholder MUST read "Nome ou e-mail".

#### Scenario: Search by recipient

- **WHEN** a subscription address has `recipient_name: "Ana Souza"` and the operator searches "souza"
- **THEN** the queue lists that cycle

#### Scenario: Search by a legacy name key

- **WHEN** an older subscription address has only `full_name: "Bruno Lima"` and the operator searches "bruno"
- **THEN** the queue lists that cycle
