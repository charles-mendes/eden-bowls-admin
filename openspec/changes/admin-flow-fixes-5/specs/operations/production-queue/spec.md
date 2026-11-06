## MODIFIED Requirements

### Requirement: Queue shows stock coverage

For each item whose `stockCoverage` is not null, the Produção column MUST show a coverage badge: `covered` → "Coberto", `short` → "Falta estoque" in the warning colour, `unknown` → "Sem tamanho". Items with null coverage MUST show no badge. The "Falta estoque" badge MUST be a link to Estoque filtered by `situacao=short` and, when the session has both markets, by the item's market. When `stockShortages` has a single entry, the link MUST also search for that recipe name.

#### Scenario: Later delivery is short

- **WHEN** the queue returns a `to_prepare` cycle with `stockCoverage` `short`
- **THEN** its Produção column shows "Falta estoque"

#### Scenario: One recipe short

- **WHEN** a short cycle has one shortage, "Frango", and the session has both markets
- **THEN** "Falta estoque" links to `/operations/stock?mercado=BR&situacao=short&busca=Frango`

#### Scenario: Two recipes short

- **WHEN** a short cycle has two shortages
- **THEN** the link filters by `situacao=short` without a search

#### Scenario: Ready cycle has no badge

- **WHEN** a `ready` cycle has `stockCoverage` null
- **THEN** no coverage badge appears

### Requirement: Blocking an unpaid cycle warns about the charge

When the cycle being blocked is not paid (`paymentState` is `awaiting_payment` or `past_due`), the "Bloquear pedido" dialog MUST ask for the block preview of that cycle and state that blocking postpones the charge and that reopening may charge the customer at once. When the preview answers a `chargeMovesTo`, the text MUST give that date, in the market's timezone, as "Bloquear adia a cobrança para {dd/mm}". While the preview loads, when it fails, or when it has no date, the text MUST stay without a date. For a paid cycle the dialog MUST NOT ask for the preview nor show this text.

#### Scenario: Block an unpaid cycle

- **WHEN** the operator opens "Bloquear pedido" on a row with `paymentState: "awaiting_payment"` and the preview answers `chargeMovesTo` on 12 November
- **THEN** the dialog says "Bloquear adia a cobrança para 12/11" and that reopening may charge at once

#### Scenario: Preview fails

- **WHEN** the preview answers an error
- **THEN** the dialog says the charge is postponed, without a date, and the block can still be confirmed

#### Scenario: Block a paid cycle

- **WHEN** the operator opens "Bloquear pedido" on a paid row
- **THEN** no preview is requested and the dialog shows no charge warning

## ADDED Requirements

### Requirement: Marking a short order ready asks first

"Marcar como pronto" on a row with `stockCoverage: "short"` MUST open a confirmation before the status change. The confirmation MUST say "Pela ordem da fila, falta estoque de {recipes} para este pedido. Marcar como pronto pode deixar o saldo negativo.", listing the `stockShortages` recipes and pack sizes. It MUST offer "Marcar como pronto", which sends the change, "Abrir estoque", which opens the badge's link, and cancel. Other rows MUST change at once, as today.

#### Scenario: Short order

- **WHEN** the operator clicks "Marcar como pronto" on a short row missing Frango 300 g
- **THEN** a confirmation names "Frango 300 g" and nothing is sent until they confirm

#### Scenario: Covered order

- **WHEN** the operator clicks "Marcar como pronto" on a covered row
- **THEN** the change is sent with no confirmation
