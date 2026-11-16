## ADDED Requirements

### Requirement: The Hoje overdue card says what it counts

The "Atrasados" card on Hoje MUST keep showing `totals.overdue` and MUST carry the hint "Só o que a cozinha não terminou. Pronto esperando saída conta em pedidos a despachar." It MUST NOT show a second number. The per-market split and the "Abrir na fila" link MUST stay as they are.

#### Scenario: Ready orders past their day are elsewhere

- **WHEN** Hoje loads with `totals.overdue` 1 while three ready Brazil orders past their day wait to leave
- **THEN** the "Atrasados" card shows 1 and the hint "Só o que a cozinha não terminou. Pronto esperando saída conta em pedidos a despachar.", and the three are counted only in the "pedidos a despachar" line
