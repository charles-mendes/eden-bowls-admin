## ADDED Requirements

### Requirement: To dispatch is read by delivery range

Entregas Brasil MUST read the delivery range from `de` and `ate` in the URL (`YYYY-MM-DD`) and send them as `from` and `to`. Without them, it MUST send none and label the range "Até amanhã". It MUST offer "Até amanhã", "Próximos 7 dias" (today to six days ahead) and a free range of two dates, and MUST write the choice back to the URL. A `400 invalid_delivery_range` MUST show "Período inválido: até 31 dias, a partir de 30 dias atrás." and keep the previous list.

When `truncated` is true, the warning MUST say the list shows the first 200 orders and link "Ver a partir de {next_from}", which sets `de` to `next_from` and keeps `ate` when it is still within 31 days, or else sets it six days after. When `later` is above zero, the tab MUST say "Mais {later} pedidos com entrega depois de {to}." with a link to the seven days after `to`. The range applies to "A despachar" only; the other tabs MUST say nothing about it.

#### Scenario: Default range

- **WHEN** the operator opens `/operations/courier`
- **THEN** the queue is requested without `from` and `to` and the range reads "Até amanhã"

#### Scenario: Next seven days

- **WHEN** the operator picks "Próximos 7 dias"
- **THEN** the URL gets `de` today and `ate` six days ahead and the queue is requested with them

#### Scenario: Orders after the range

- **WHEN** the queue answers `later: 4` with `range.to` tomorrow
- **THEN** "A despachar" says "Mais 4 pedidos com entrega depois de {tomorrow}." with a link to the following seven days

#### Scenario: List cut

- **WHEN** the queue answers `truncated: true` and `next_from` 2026-11-20
- **THEN** the warning links to the range starting on 2026-11-20

### Requirement: The queue filters orders with an address problem

Entregas Brasil MUST read `problema=endereco` from the URL and, when present, show in "A despachar" and "Falhas" only the rows whose `address_issue` is open, with a chip "Com problema de endereço" that removes the filter. When no row is left, the tab MUST say "Nenhum pedido com problema de endereço neste período." next to the range choice. Without the filter, every row MUST show.

#### Scenario: Link from Today

- **WHEN** the operator opens `/operations/courier?problema=endereco`
- **THEN** "A despachar" lists only the rows with an open address problem and the chip shows
