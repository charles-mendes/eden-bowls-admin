# Spec Delta

## Purpose

Defines how the customer page (`/users/:userId`) presents the copies of the customer's delivery address and fiscal data, so the operator knows which deliveries and notes each correction reaches.

## ADDED Requirements

### Requirement: Profile delivery address is presented as an exception

The "Endereço de entrega" section MUST state that this address is the account's copy and does not change where a subscription box goes: deliveries use the subscription address, which the customer edits in Meu Plano on the store. The "Nome de quem recebe" field MUST NOT be described as the label or courier name.

#### Scenario: Section text

- **WHEN** an operator opens a customer page
- **THEN** the "Endereço de entrega" section says the box follows the subscription address the customer edits in the store

### Requirement: Saving the profile address asks for confirmation and a reason

"Salvar endereço" MUST open a confirmation that repeats that the subscription address does not change and MUST require a reason of 3 to 255 characters. Confirming MUST send the reason as `reason` with the delivery update. Cancelling MUST NOT send anything.

#### Scenario: Confirm with a reason

- **WHEN** the operator saves the address with reason "Cliente pediu por telefone"
- **THEN** `PATCH /api/v1/admin/users/<id>/delivery` carries `reason: "Cliente pediu por telefone"`

#### Scenario: Cancel the confirmation

- **WHEN** the operator opens the confirmation and cancels
- **THEN** no request is sent and the form keeps the edited values

### Requirement: Fiscal data section says which notes it reaches

The "Dados fiscais" section MUST keep its edit and MUST state that the data is used by the next NF-e and by retrying a note that has not been authorized, and that an authorized note does not change.

#### Scenario: Fiscal data text

- **WHEN** an operator opens a Brazilian customer page
- **THEN** the "Dados fiscais" section says an authorized note does not change
