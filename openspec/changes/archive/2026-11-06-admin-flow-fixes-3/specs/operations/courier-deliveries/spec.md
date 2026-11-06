## ADDED Requirements

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
