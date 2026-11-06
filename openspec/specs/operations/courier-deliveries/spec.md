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
