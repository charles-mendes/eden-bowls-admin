## MODIFIED Requirements

### Requirement: Ready orders past their day have their own group

Rows whose `dueBucket` is `overdue` and whose production status is ready MUST be shown in a group "Prontos para expedir", placed before the "Atrasados" group, and MUST NOT be shown under "Atrasados". The "Atrasados" metric card MUST keep showing the API's `overdue` metric, which counts only overdue rows not ready. The card MUST carry the text "Só o que a cozinha não terminou. Pronto esperando saída não conta." and MUST NOT show a second number.

#### Scenario: One late order ready and one still in the kitchen

- **WHEN** the queue lists two overdue rows, one ready and one to prepare, and the metric `overdue` is 1
- **THEN** the ready row is under "Prontos para expedir", the other under "Atrasados", and the card shows Atrasados 1

#### Scenario: Marked ready from the overdue filter

- **WHEN** an operator on `?prazo=atrasados` marks an overdue Brazil row ready
- **THEN** after the refresh the row is under "Prontos para expedir" with its fulfillment action

#### Scenario: The card says what it counts

- **WHEN** the queue shows the "Atrasados" card
- **THEN** the card shows the `overdue` number and the text "Só o que a cozinha não terminou. Pronto esperando saída não conta.", and no other number
