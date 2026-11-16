## ADDED Requirements

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
