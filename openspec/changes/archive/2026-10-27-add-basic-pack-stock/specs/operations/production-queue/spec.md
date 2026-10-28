# Spec Delta

## ADDED Requirements

### Requirement: Queue shows stock coverage

For each item whose `stockCoverage` is not null, the Produção column MUST show a coverage badge: `covered` → "Coberto", `short` → "Falta estoque" in the warning colour, `unknown` → "Sem tamanho". Items with null coverage MUST show no badge.

#### Scenario: Later delivery is short

- **WHEN** the queue returns a `to_prepare` cycle with `stockCoverage` `short`
- **THEN** its Produção column shows "Falta estoque"

#### Scenario: Ready cycle has no badge

- **WHEN** a `ready` cycle has `stockCoverage` null
- **THEN** no coverage badge appears

### Requirement: Separation shortage warning

After a successful update to `ready` whose response has a non-empty `stock.shortages` or a positive `stock.unsized`, the page MUST show a non-blocking warning listing each short item with its on-hand after the separation, and the number of lines without size. The status change MUST already be applied.

#### Scenario: Marked ready with too little stock

- **WHEN** an operator marks a cycle ready and the response lists `frango / 300 g` at -2
- **THEN** the row shows `ready` and a warning reads "Separado com estoque negativo: frango 300 g (-2)."
