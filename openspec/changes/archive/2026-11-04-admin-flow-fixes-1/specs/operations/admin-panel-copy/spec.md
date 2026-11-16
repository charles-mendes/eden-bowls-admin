# Spec Delta

## ADDED Requirements

### Requirement: UPS label blocks say where the customer fixes them

Every label block caused by the customer's address or recipient (`po_box_not_allowed`, `military_address_not_supported`, `address_incomplete`, `recipient_name_missing`) MUST say what is missing or refused, that the customer fixes it in Meu Plano on the store, and that, if the customer does not fix it, the operator talks to them on WhatsApp. No text MUST ask the operator to fill in the account name or the address.

#### Scenario: Missing recipient

- **WHEN** a label is blocked with `recipient_name_missing`
- **THEN** the text says the subscription has no recipient name, the customer adds it in Meu Plano (or the name in Meu Perfil for older subscriptions), and the operator uses WhatsApp if it is not fixed

#### Scenario: PO Box

- **WHEN** a label is blocked with `po_box_not_allowed`
- **THEN** the text says UPS does not deliver to a PO Box, the customer fixes it in Meu Plano, and the operator uses WhatsApp if it is not fixed

### Requirement: Recipient block does not send the operator to the customer page

The label block `recipient_name_missing` MUST NOT offer "Abrir cliente" as the way to fix it, on the label queue or on the subscription detail.

#### Scenario: Subscription detail block list

- **WHEN** the subscription detail lists a `recipient_name_missing` block
- **THEN** no "Abrir cliente" link is offered next to that block
