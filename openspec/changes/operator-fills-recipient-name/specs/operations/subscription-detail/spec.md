## MODIFIED Requirements

### Requirement: Dispatch here is held by the address

In "Entrega Brasil", when the subscription detail's `courier_issues` is not empty, each "Despachar" MUST be disabled and the section MUST say what is missing, in the same words as Entregas Brasil, before any dialog opens. The detail MUST NOT offer any way to dispatch anyway.
A section locked by `recipient_name_missing` MUST offer "Informar quem recebe" to a user with `users.delivery.write`. It MUST open a dialog with one field, "Nome de quem recebe", filled with the detail's `account_name` when present, the text "Fica só nesta assinatura. O nome da conta não muda." and "Salvar nome". Saving MUST send the name to the subscription's recipient-name route and reload the subscription; a 422 MUST show under the field. When `courier_issues` is empty, null or absent, "Despachar" MUST behave as before.

#### Scenario: No recipient name

- **WHEN** an operator with `shipping.write` opens a Brazil subscription whose `courier_issues` is `["recipient_name_missing"]` and that has a paid cycle waiting
- **THEN** "Despachar" is disabled, the section says "Falta o nome de quem recebe", and no dispatch dialog can open

#### Scenario: Complete address

- **WHEN** `courier_issues` is empty
- **THEN** "Despachar" opens the dispatch dialog as before

#### Scenario: Recipient filled in the detail

- **WHEN** `courier_issues` is `["recipient_name_missing"]` and an operator with `users.delivery.write` saves a name in "Informar quem recebe"
- **THEN** the subscription reloads and "Despachar" is enabled
