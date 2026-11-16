## MODIFIED Requirements

### Requirement: Ready orders past their day have their own group

Rows whose `dueBucket` is `overdue` and whose production status is ready MUST be shown in a group "Prontos para expedir", placed before the "Atrasados" group, and MUST NOT be shown under "Atrasados". The "Atrasados" metric card MUST keep showing the API's `overdue` metric, which counts only overdue rows not ready. The card MUST carry the text "Só o que a cozinha não terminou. Pronto esperando saída não conta." and MUST NOT show a second number. Under `?prazo=atrasados` without a status filter, the list MUST hold only what the API returns for `due=overdue`, which leaves out ready rows. When a single or batch status change sets ready while `?prazo=atrasados` is active, the panel MUST show a notice with role `status` saying the order left Atrasados and waits in "Prontos para expedir" (for a batch, how many), with a link to the queue filtered by status Pronto that keeps the market filter. A row under "Prontos para expedir" MUST NOT show the red "Atrasado N dias" badge; it MUST show a warning badge "Aguardando saída há N dias" ("há 1 dia"), N being how many days ago its preparation day was. Rows under "Atrasados" MUST keep the red "Atrasado N dias" badge.

#### Scenario: One late order ready and one still in the kitchen

- **WHEN** the queue without a due filter lists two overdue rows, one ready and one to prepare, and the metric `overdue` is 1
- **THEN** the ready row is under "Prontos para expedir", the other under "Atrasados", and the card shows Atrasados 1

#### Scenario: A ready row says how long it waits to leave

- **WHEN** the queue lists a ready row prepared 24 days ago and a row to prepare from the same day
- **THEN** the ready row shows "Aguardando saída há 24 dias" as a warning badge, and the other shows "Atrasado 24 dias" in red

#### Scenario: Marked ready from the overdue filter

- **WHEN** an operator on `?prazo=atrasados&mercado=br` marks an overdue Brazil row ready
- **THEN** after the refresh the row is no longer in the list, and a notice says it left Atrasados and waits in "Prontos para expedir", with a link to `?status=ready&mercado=br`

#### Scenario: Batch marked ready from the overdue filter

- **WHEN** an operator on `?prazo=atrasados` marks two overdue rows ready in a batch
- **THEN** after the refresh neither row is in the list, and the notice says 2 orders went to "Prontos para expedir"

#### Scenario: Marked ready without the overdue filter

- **WHEN** an operator on the queue without a due filter marks an overdue Brazil row ready
- **THEN** after the refresh the row is under "Prontos para expedir" with its fulfillment action, and no notice is shown

#### Scenario: The card says what it counts

- **WHEN** the queue shows the "Atrasados" card
- **THEN** the card shows the `overdue` number and the text "Só o que a cozinha não terminou. Pronto esperando saída não conta.", and no other number
