## ADDED Requirements

### Requirement: Dispatch here is held by the address

In "Entrega Brasil", when the subscription detail's `courier_issues` is not empty, each "Despachar" MUST be disabled and the section MUST say what is missing, in the same words as Entregas Brasil, before any dialog opens. The detail MUST NOT offer any way to dispatch anyway. When `courier_issues` is empty, null or absent, "Despachar" MUST behave as before.

#### Scenario: No recipient name

- **WHEN** an operator with `shipping.write` opens a Brazil subscription whose `courier_issues` is `["recipient_name_missing"]` and that has a paid cycle waiting
- **THEN** "Despachar" is disabled, the section says "Falta o nome de quem recebe", and no dispatch dialog can open

#### Scenario: Complete address

- **WHEN** `courier_issues` is empty
- **THEN** "Despachar" opens the dispatch dialog as before
