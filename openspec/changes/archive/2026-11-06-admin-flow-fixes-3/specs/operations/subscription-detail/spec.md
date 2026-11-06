## ADDED Requirements

### Requirement: The detail shows the address problem

When the subscription detail has `address_issue`, the page MUST show its codes in plain words, the source, the email state, and the "Registrar contato" action for users with `customers.contact.write`. It MUST NOT offer a field to rewrite the address.

#### Scenario: Open problem

- **WHEN** an operator opens a subscription whose problem lists a missing neighborhood and whose email went out
- **THEN** the detail says the neighborhood is missing, shows "E-mail enviado em" with the date, and offers "Registrar contato"
