# operations/production-batch Specification

## Purpose

Lets kitchen staff start and finish several production orders at once, through the same status change the single row uses.

## Requirements

### Requirement: Orders are selected for a batch

For a caller with `production.write`, each production row that is paid and `to_prepare`, or `in_production`, MUST show a checkbox. Unpaid, blocked and ready rows MUST NOT. The header MUST offer selecting every selectable row of the page. The selection MUST be cleared when the page, filters or window change, and after a batch runs. A caller without `production.write` MUST see no checkbox.

#### Scenario: Unpaid order

- **WHEN** an operator sees an unpaid `to_prepare` row and a paid one
- **THEN** only the paid row has a checkbox

#### Scenario: Read-only staff

- **WHEN** a `readonly` user opens the queue
- **THEN** no checkbox shows

#### Scenario: Filter changes

- **WHEN** the operator selects two rows and changes the status filter
- **THEN** the selection is empty

### Requirement: A batch confirms before it runs

With at least one row selected, a bar MUST show "Iniciar preparo (N)", N being the selected paid `to_prepare` rows, and "Marcar como pronto (N)", N being the selected `in_production` rows. A button with N = 0 MUST be disabled. Each button MUST open a confirmation listing the orders it will change, by customer and recipe mix. For "Marcar como pronto", the rows with `stockCoverage: "short"` MUST be marked with their `stockShortages` recipes and the text "Pela ordem da fila, falta estoque para estes pedidos. Marcar como pronto pode deixar o saldo negativo."

#### Scenario: Mixed selection

- **WHEN** the operator selects two `to_prepare` rows and one `in_production` row
- **THEN** the bar shows "Iniciar preparo (2)" and "Marcar como pronto (1)"

#### Scenario: Short order in the batch

- **WHEN** the operator confirms "Marcar como pronto" for three rows and one is `short` of Frango 300 g
- **THEN** the confirmation lists the three and marks that one with "Frango 300 g"

### Requirement: A batch reports each order

A confirmed batch MUST send the existing status change for each order, one after the other, in the order of the queue. It MUST NOT stop at a failure. When it ends, the page MUST say how many orders changed and list each failure with the customer and the API's message. It MUST then list the separation shortages the responses returned, as the single change does, and reload the queue. The bar MUST be disabled while the batch runs.

#### Scenario: All changed

- **WHEN** a batch of three succeeds
- **THEN** the page says "3 pedidos atualizados" and reloads

#### Scenario: One fails

- **WHEN** the second of three requests answers 409 `production_period_stale`
- **THEN** the third is still sent and the page says "2 pedidos atualizados" and lists the second with its message
