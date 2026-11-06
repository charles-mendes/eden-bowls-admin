## Purpose

Defines how the panel records and shows the contacts an operator makes with a customer by WhatsApp.

## ADDED Requirements

### Requirement: Recording a contact is short

"Registrar contato" MUST open a dialog with reason (Pagamento recusado, Atraso, Falha de entrega, Endereço), outcome (Sem resposta, Cliente vai resolver, Resolvido) and an optional note of up to 500 characters, with the channel shown as WhatsApp and the account phone with a copy button when known. Saving MUST send it to the API and show the new contact. An API error MUST show in the dialog and keep what was typed.

#### Scenario: Save

- **WHEN** an operator picks Pagamento recusado and Sem resposta and saves
- **THEN** the contact is sent and appears as the latest

#### Scenario: Error

- **WHEN** the API refuses the contact
- **THEN** the dialog stays open with the message and the fields filled

### Requirement: Only who can record sees the button

"Registrar contato" MUST show only for a user with `customers.contact.write`. The history MUST show to anyone who reads the subscription.

#### Scenario: Readonly

- **WHEN** a readonly user opens a subscription with contacts
- **THEN** the history shows and "Registrar contato" does not
