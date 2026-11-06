## ADDED Requirements

### Requirement: A blocked note says what is missing and where it is fixed

A note with `missing_fields` MUST list "CPF" and "Nome fiscal" as missing, MUST say the customer fixes them in Meu plano → Editar assinatura, and MUST show the subscription's `address_issue` email state. "Corrigir dados" MUST stay available as an exception.

#### Scenario: Missing fiscal name

- **WHEN** an operator opens a note with `missing_fields: ["fiscal_name"]` and an open problem whose email went out
- **THEN** the detail says the fiscal name is missing, that the customer fixes it in the store, and shows "E-mail enviado em" with the date
