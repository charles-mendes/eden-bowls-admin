## ADDED Requirements

### Requirement: Queue shows each order's boxes

Each production queue item MUST show its `boxes` from the API, by box name and pack count, for example "Caixa mensal · 30 pacotes + Caixa mensal · 15 pacotes", so the kitchen packs the right boxes. An item without `boxes` MUST show nothing extra.

#### Scenario: Order with two boxes

- **WHEN** an item has two monthly boxes with 30 and 15 packs
- **THEN** the item shows both boxes with their pack counts
