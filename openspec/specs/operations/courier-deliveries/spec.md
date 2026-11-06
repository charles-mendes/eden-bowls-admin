# operations/courier-deliveries Specification

## Purpose

Defines the panel's Entregas Brasil screen (`/operations/courier`), where operators dispatch and close Brazilian courier deliveries, starting with which tab it opens.

## Requirements

### Requirement: Courier tab lives in the URL

Entregas Brasil MUST read the tab from `aba` in the URL (`a_despachar`, `em_rota`, `falhas`, `entregues`), MUST default to `a_despachar` when it is absent or unknown, and MUST write it back when the operator changes tab.

#### Scenario: Link to the failed tab

- **WHEN** the operator opens `/operations/courier?aba=falhas`
- **THEN** the Falhas tab is selected

#### Scenario: Unknown tab

- **WHEN** the operator opens `/operations/courier?aba=xyz`
- **THEN** the A despachar tab is selected

### Requirement: A row has what Uber and WhatsApp need

Rows in "A despachar" and "Em rota" MUST show the delivery address ready to copy (street and number, complement, neighborhood, city/state, ZIP) with a "Copiar endereço" button, the recipient, the account phone with a "Copiar" button, the delivery instructions labeled as from the customer's profile, and the flavors and packs. A missing phone or instructions MUST read "Sem telefone" / "Sem instruções".

#### Scenario: Full row

- **WHEN** a row to dispatch has address, phone and instructions
- **THEN** all show on the row, and "Copiar endereço" copies the address lines

### Requirement: The dispatch link says what it is

The dispatch dialog MUST keep "Uber" preselected, as today, and the link field MUST say it is the app's tracking link.

#### Scenario: Open dispatch

- **WHEN** an operator opens "Despachar"
- **THEN** the method is Uber and the link field explains the tracking link

### Requirement: A delivery on the road can be edited

A delivery on the road MUST offer "Editar" to a user with `shipping.write`, which opens the dispatch dialog filled with the saved method, courier, link, cost and note of that delivery (not the dispatch defaults, and refilled when another delivery is edited), and saves the changes without canceling, without a new dispatch and without telling the customer again.

#### Scenario: Wrong Uber link

- **WHEN** an operator edits a delivery on the road and changes the link
- **THEN** the delivery keeps its status and dates and shows the new link

### Requirement: A failure says what kind it was

"Falhou" MUST ask for the kind (Endereço não serve, Cliente ausente, Outro) and the reason text, both required, and send both. The failed row MUST show the kind.

#### Scenario: Address does not work

- **WHEN** an operator marks a failure as "Endereço não serve" with a reason
- **THEN** the request carries `failure_kind: "address_unusable"` and the row in "Falhas" shows the kind

### Requirement: A row records the contact

Rows in "Em rota" and "Falhas" MUST offer "Registrar contato" to a user with `customers.contact.write`, with the reason preset to delivery failure on "Falhas".

#### Scenario: Customer absent

- **WHEN** an operator records a contact from a failed row
- **THEN** the dialog opens with reason "Falha de entrega"

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
