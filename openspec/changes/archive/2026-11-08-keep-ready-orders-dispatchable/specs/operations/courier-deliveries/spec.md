## MODIFIED Requirements

### Requirement: The queue filters orders with an address problem

Entregas Brasil MUST read `problema=endereco` from the URL and, when present, show in "A despachar" and "Falhas" only the rows whose `address_issue` is open or whose `issues` is not empty (held by the address, with or without a problem opened), with a chip "Com problema de endereço" that removes the filter. When no row is left, the tab MUST say "Nenhum pedido com problema de endereço neste período." next to the range choice. Without the filter, every row MUST show.

#### Scenario: Link from Today

- **WHEN** the operator opens `/operations/courier?problema=endereco`
- **THEN** "A despachar" lists only the rows with an open address problem and the chip shows

#### Scenario: Held with no problem opened

- **WHEN** the operator opens `/operations/courier?problema=endereco` and a to-dispatch row has `issues: ["recipient_name_missing"]` and no `address_issue`
- **THEN** that row is listed
