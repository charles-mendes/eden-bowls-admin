# operations/ups-labels Specification

## Purpose

Defines how Etiquetas UPS buys labels from the panel and handles an order the API says is not ready.

## Requirements

### Requirement: The batch sends the confirmation the operator gave

When the selection holds orders not ready or with a subscription not active, the queue MUST ask once, listing them, and send `confirm_not_ready: true` only for those the operator confirmed. When the API still answers `409 ups_label_needs_confirmation` for an order, that order MUST end as "Precisa confirmar" with the reasons, nothing bought, and the batch MUST go on. The "Verificar na UPS" section MUST be reachable by the anchor `verificar-ups`.

#### Scenario: Confirmed order not ready

- **WHEN** the operator confirms buying an order in production
- **THEN** its purchase carries `confirm_not_ready: true` and the label is bought

#### Scenario: Opened from Today

- **WHEN** the page opens at `/operations/labels#verificar-ups`
- **THEN** it scrolls to the "Verificar na UPS" section once the queue loads

#### Scenario: Status changed meanwhile

- **WHEN** an order was ready when the queue loaded and the API answers 409 for it
- **THEN** it ends as "Precisa confirmar", no label is bought for it, and the other orders are bought

### Requirement: Ready labels are read by delivery range

Etiquetas UPS MUST read the delivery range from `de` and `ate` in the URL and send them as `from` and `to`, with the same choices, texts and invalid-range message as Entregas Brasil: "Até amanhã" by default, "Próximos 7 dias", a free range, "Ver a partir de {next_from}" when `truncated` (the list shows the first 100 orders), and "Mais {later} pedidos com entrega depois de {to}." when `later` is above zero. The range applies to the ready orders only. Created labels and unconfirmed purchases MUST keep showing whatever the range.

#### Scenario: Default range

- **WHEN** the operator opens `/operations/labels`
- **THEN** the queue is requested without `from` and `to` and the range reads "Até amanhã"

#### Scenario: Label created for later

- **WHEN** the queue answers a created label for a delivery in five days with the default range
- **THEN** the created label is listed

#### Scenario: Orders after the range

- **WHEN** the queue answers `later: 2`
- **THEN** the ready list says "Mais 2 pedidos com entrega depois de {to}."

### Requirement: The label queue filters orders with an address problem

Etiquetas UPS MUST read `problema=endereco` from the URL and, when present, show only the ready rows whose `address_issue` is open, with a chip "Com problema de endereço" that removes the filter. When no ready row is left, it MUST say "Nenhum pedido com problema de endereço neste período." next to the range choice.

#### Scenario: Link from Today

- **WHEN** the operator opens `/operations/labels?problema=endereco`
- **THEN** only ready rows with an open address problem show, and created labels are not hidden
