## ADDED Requirements

### Requirement: Shipping sections list the paid cycles

"Envio UPS" and "Entrega Brasil" MUST list the subscription's paid cycles from the API, each with preparation day, production status, delivery date and shipping state, without needing "Sincronizar faturas". Paid invoices with no cycle (old or zero-value) MUST NOT appear as waiting for a label or a courier. The section shown MUST follow the same rule as today.

#### Scenario: Opened from Today

- **WHEN** an operator opens a subscription with one ready paid cycle and no label
- **THEN** "Envio UPS" lists that cycle as waiting for a label, before any sync

#### Scenario: Zero-value invoice

- **WHEN** the subscription's invoices include a paid zero-value invoice with no cycle
- **THEN** it is not listed as waiting

### Requirement: Buying a label here asks when the order is not ready

Buying a label from the subscription detail MUST, on `409 ups_label_needs_confirmation`, show the reasons and ask to confirm, and buy only after confirmation, sending `confirm_not_ready`.

#### Scenario: Order in production

- **WHEN** the API answers 409 with `production_not_ready`
- **THEN** the detail asks "Este pedido ainda não está pronto. Comprar mesmo assim?" and buys only if confirmed

### Requirement: The detail keeps the contact history

The detail MUST show the subscription's contacts, newest first, and offer "Registrar contato" to a user with `customers.contact.write`, with the account phone and a copy button beside it.

#### Scenario: History

- **WHEN** the subscription has two contacts
- **THEN** both show, newest first, with reason, outcome, note, who and when
