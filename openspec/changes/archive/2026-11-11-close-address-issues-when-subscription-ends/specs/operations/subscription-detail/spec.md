# Spec Delta

## MODIFIED Requirements

### Requirement: The detail shows the address problem

When the subscription detail has `address_issue`, the page MUST show its codes in plain words, the source, the email state, and the "Registrar contato" action for users with `customers.contact.write`. It MUST NOT offer a field to rewrite the address.

#### Scenario: Open problem

- **WHEN** an operator opens a subscription whose problem lists a missing neighborhood and whose email went out
- **THEN** the detail says the neighborhood is missing, shows "E-mail enviado em" with the date, and offers "Registrar contato"

#### Scenario: Problem closed because the subscription ended

- **WHEN** an operator opens a canceled subscription whose problem was closed on 5 November with `resolved_by: ended`
- **THEN** the detail shows "Assinatura encerrada em 05/11"

#### Scenario: Problem closed by an operator

- **WHEN** an operator opens a subscription whose problem was closed on 5 November with `resolved_by: operator`
- **THEN** the detail shows "Operador corrigiu em 05/11"
