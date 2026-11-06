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

### Requirement: A row says whether its NF-e lets the box leave

Entregas Brasil MUST show, on each row of "A despachar" and "Falhas", the invoice's NF-e from the queue: "NF-e {number}" when `authorized` ("NF-e autorizada" without a number). When the queue reports `nfe_required` and the note is not `authorized`, the row MUST show "Aguardando NF-e: {reason}" and its dispatch button MUST be unavailable. When `nfe_required` is false, the row MUST show "NF-e: {reason}" and the button MUST work as before.

#### Scenario: Authorized note

- **WHEN** a row has `nfe` `{ status: "authorized", number: "123" }` and `nfe_required` is true
- **THEN** it shows "NF-e 123" and "Despachar" works

#### Scenario: Authorized without a number

- **WHEN** a row has `nfe` `{ status: "authorized", number: null }`
- **THEN** it shows "NF-e autorizada"

#### Scenario: Note in flight

- **WHEN** `nfe_required` is true and the row's note is `submitted`
- **THEN** it shows "Aguardando NF-e: em emissão" and "Despachar" is unavailable

#### Scenario: No note

- **WHEN** `nfe_required` is true and the row has `nfe` null
- **THEN** it shows "Aguardando NF-e: sem nota registrada" and "Despachar" is unavailable

#### Scenario: Failure tab

- **WHEN** `nfe_required` is true and a "Falhas" row's note is `canceled`
- **THEN** it shows "Aguardando NF-e: cancelada" and "Despachar de novo" is unavailable

#### Scenario: Lock off

- **WHEN** `nfe_required` is false and the row's note is `rejected`
- **THEN** the row shows "NF-e: rejeitada" and "Despachar" works

### Requirement: A blocked note opens where it is fixed

When the row's note is `rejected`, `error` or `blocked_missing_document`, the row MUST link to that note's detail (`/operations/nfe/{id}`), where it is retried or corrected, whether `nfe_required` is on or off. A `canceled` note MUST NOT get the link, since it cannot be retried.

#### Scenario: Rejected note

- **WHEN** a row's note with id 9 is `rejected`
- **THEN** the row links to `/operations/nfe/9`

#### Scenario: Missing CPF

- **WHEN** `nfe_required` is true and a row's note with id 4 is `blocked_missing_document`
- **THEN** it shows "Aguardando NF-e: falta CPF ou nome fiscal" with a link to `/operations/nfe/4`

#### Scenario: Canceled note

- **WHEN** a row's note is `canceled`
- **THEN** the row has no link to the note

### Requirement: A dispatch refused for the NF-e says why

When a dispatch, from Entregas Brasil or from the subscription detail, is refused with `courier_nfe_not_authorized`, the dialog MUST say that the box only leaves with an authorized NF-e, name the note's situation from `nfe_status` (or "sem nota registrada" when null), and say that nothing was dispatched.

#### Scenario: Note changed after the queue loaded

- **WHEN** the API refuses a dispatch with `courier_nfe_not_authorized` and `nfe_status` `rejected`
- **THEN** the dialog shows "A caixa só sai com NF-e autorizada. Situação da nota: rejeitada. Nada foi despachado."

### Requirement: A row with an address problem cannot be dispatched

A row under "A despachar" or "Falhas" whose `issues` is not empty MUST list what is missing in plain words and MUST NOT offer "Despachar". The panel MUST NOT offer any way to dispatch it anyway or to edit the address.

#### Scenario: Missing number

- **WHEN** a to-dispatch row has `issues: ["address_number_missing"]`
- **THEN** the row says "Falta o número" and has no "Despachar" button

### Requirement: New dispatch refusals have their own text

The dispatch dialog MUST show a specific message for `courier_address_incomplete`, listing the missing fields, and for `shipment_market_exception`.

#### Scenario: Refused after the queue was read

- **WHEN** the API answers 422 `courier_address_incomplete` with `issues: ["address_neighborhood_missing"]`
- **THEN** the dialog says the address lacks the neighborhood and nothing was dispatched

### Requirement: A row shows the address problem and the email

When a row has `address_issue`, it MUST show the email state: "E-mail enviado em dd/mm", "E-mail não enviado", "Cliente corrigiu em dd/mm", or "Sem correção há N dias" when open for more than 2 days.

#### Scenario: Open for 4 days

- **WHEN** a row's problem opened 4 days ago and its email went out the same day
- **THEN** the row shows "E-mail enviado em" with that date and "Sem correção há 4 dias"
