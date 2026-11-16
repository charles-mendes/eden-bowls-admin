## ADDED Requirements

### Requirement: Ready Brazil orders waiting to leave are pending

Hoje MUST list a pending item, with severity "Média", for the Brazil orders whose `dueBucket` is `overdue`, whose production status is ready and whose `courierDelivery` is `none` or absent (the box has not left). It MUST read "N pedidos prontos esperando saída" ("1 pedido pronto esperando saída"). With one order its detail MUST read "{cliente}: o dia de preparo já passou e a caixa ainda não saiu."; with more, "O dia de preparo já passou e as caixas ainda não saíram." Its action MUST read "Abrir entregas" and MUST open `/operations/courier`. It MUST be placed after the "Alta" items and before the other "Média" items. A ready order already on the road, delivered or failed, and a US order, MUST NOT count. While this item shows, Hoje MUST NOT say "Nada travado. Tudo em dia."

#### Scenario: One ready order past its day

- **WHEN** Hoje loads with `totals.overdue` 0 and one ready Brazil order, Charles Mendes, prepared 8 days ago with no courier delivery
- **THEN** Pendências shows "1 pedido pronto esperando saída" as "Média" with "Charles Mendes: o dia de preparo já passou e a caixa ainda não saiu." and "Abrir entregas" linking to `/operations/courier`, the "Atrasados" card shows 0, and "Nada travado. Tudo em dia." does not show

#### Scenario: Box already on the road

- **WHEN** the only ready Brazil order past its day has a courier delivery out for delivery
- **THEN** no "pronto esperando saída" item shows

## MODIFIED Requirements

### Requirement: The Hoje overdue card says what it counts

The "Atrasados" card on Hoje MUST keep showing `totals.overdue` and MUST carry the hint "Só o que a cozinha não terminou. Pronto esperando saída conta em pedidos a despachar." It MUST NOT show a second number. The per-market split and the "Abrir na fila" link MUST stay as they are. Ready orders past their day MUST NOT add to this card; they are counted in the "pedidos a despachar" line and, while their box has not left, listed as the pending item "pedidos prontos esperando saída".

#### Scenario: Ready orders past their day are elsewhere

- **WHEN** Hoje loads with `totals.overdue` 1 while three ready Brazil orders past their day wait to leave
- **THEN** the "Atrasados" card shows 1 and the hint "Só o que a cozinha não terminou. Pronto esperando saída conta em pedidos a despachar.", the three are counted in the "pedidos a despachar" line, and Pendências shows "3 pedidos prontos esperando saída"
