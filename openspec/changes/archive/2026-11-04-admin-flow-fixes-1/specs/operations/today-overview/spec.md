# Spec Delta

## Purpose

Defines the Hoje page (`/dashboard`), where a shift starts: its cards, its pending items and the next step of each order, and the screen each one opens so the operator lands where the work gets done.

## ADDED Requirements

### Requirement: Refused payments open the refused subscribers

The pending item for refused payments MUST open the subscription when it holds one order. When it holds more than one, its action MUST read "Ver assinantes" and MUST open `/billing?status=past_due`.

#### Scenario: Several refused payments

- **WHEN** Hoje lists three orders whose `paymentState` is `past_due`
- **THEN** the pending item "3 pagamentos recusados" links to `/billing?status=past_due`

#### Scenario: One refused payment

- **WHEN** Hoje lists one order whose `paymentState` is `past_due`
- **THEN** the pending item links to `/billing/subscriptions/<id>` with the action "Abrir pedido"

### Requirement: Missing UPS labels open the label queue

The card "Sem etiqueta UPS" MUST link to `/operations/labels`. The pending item for ready orders without a UPS label MUST link to `/operations/labels` when it holds more than one order, with the action "Ver etiquetas", and to the subscription when it holds one.

#### Scenario: Card opens the label queue

- **WHEN** a session with the US market opens Hoje
- **THEN** the card "Sem etiqueta UPS" links to `/operations/labels`

#### Scenario: Several orders without a label

- **WHEN** two ready US orders have no UPS label
- **THEN** the pending item reads "2 pedidos prontos sem etiqueta UPS" and links to `/operations/labels`

### Requirement: Next step after a UPS label

When an order's `upsLabel` is `created`, its next step MUST read "Aguardando coleta UPS" with the success tone and MUST link to the subscription. The text MUST NOT ask the operator to dispatch.

#### Scenario: Label already bought

- **WHEN** a ready US order has `upsLabel: "created"`
- **THEN** its next step reads "Aguardando coleta UPS"
