# operations/today-overview Specification

## Purpose

Defines the Hoje page (`/dashboard`), where a shift starts: its cards, its pending items and the next step of each order, and the screen each one opens so the operator lands where the work gets done.

## Requirements

### Requirement: Refused payments open the refused subscribers

The pending item for refused payments MUST open the subscription when it holds one order. When it holds more than one, its action MUST read "Ver assinantes" and MUST open `/billing?status=past_due`.

#### Scenario: Several refused payments

- **WHEN** Hoje lists three orders whose `paymentState` is `past_due`
- **THEN** the pending item "3 pagamentos recusados" links to `/billing?status=past_due`

#### Scenario: One refused payment

- **WHEN** Hoje lists one order whose `paymentState` is `past_due`
- **THEN** the pending item links to `/billing/subscriptions/<id>` with the action "Abrir pedido"

### Requirement: Missing UPS labels open the label queue

The card "Sem etiqueta UPS" MUST link to `/operations/labels`. The pending item for ready orders without a UPS label MUST link to `/operations/labels` when it holds more than one order, with the action "Ver etiquetas", and to the subscription when it holds one.

#### Scenario: Card opens the label queue

- **WHEN** a session with the US market opens Hoje
- **THEN** the card "Sem etiqueta UPS" links to `/operations/labels`

#### Scenario: Several orders without a label

- **WHEN** two ready US orders have no UPS label
- **THEN** the pending item reads "2 pedidos prontos sem etiqueta UPS" and links to `/operations/labels`

### Requirement: Next step after a UPS label

When an order's `upsLabel` is `created`, its next step MUST read "Aguardando coleta UPS" with the success tone and MUST link to the subscription. The text MUST NOT ask the operator to dispatch.

#### Scenario: Label already bought

- **WHEN** a ready US order has `upsLabel: "created"`
- **THEN** its next step reads "Aguardando coleta UPS"

### Requirement: Unconfirmed UPS purchase says to check UPS

A US item with `upsLabel: "unresolved"` MUST show the next step "Verificar na UPS" in the error tone, linking to the "Verificar na UPS" section of Etiquetas UPS, and MUST NOT show "Gerar etiqueta UPS".

#### Scenario: UPS did not answer

- **WHEN** Today returns a ready US item with `upsLabel: "unresolved"`
- **THEN** its next step reads "Verificar na UPS" and links to `/operations/labels#verificar-ups`, which scrolls to that section

### Requirement: Shipping and invoice work opens the filtered screen

Today MUST list, for the market on screen, each `fulfillment` count above zero with a link to where it is solved: Brazil to dispatch (Entregas Brasil, "A despachar"), on the road for more than 24 hours (Entregas Brasil, "Em rota"), failed with no new dispatch (Entregas Brasil, "Falhas"), NF-e without CPF, rejected or with error (Notas fiscais filtered by that status), unconfirmed UPS purchases (Etiquetas UPS). When `blingConnected` is false and Brazil is on screen (all markets or Brazil), it MUST show "Bling desconectado" linking to Notas fiscais; with the screen filtered to the US it MUST NOT. Counts of zero and markets not on screen MUST NOT show.

For each market on screen, it MUST also list the open address problems of `addressIssues` ("N problemas de endereço abertos", adding "M sem correção há mais de 2 dias" when `stale` is above zero), linking to Entregas Brasil for Brazil and to Etiquetas UPS for the US, both with `problema=endereco`, and the market exceptions of `marketExceptions` ("N exceções de mercado"), linking to Exceções de mercado. The address count is every open problem of the market; the filtered queue shows only the ones on its rows in the range on screen, so the two numbers may differ. The exceptions count has no 200 limit, while the exceptions page lists the first 200.

Today MUST NOT show a separate work item for `courierAwaitingNfe` or for `courierAddressLocked`. "N pedidos a despachar" MUST use `courierToDispatch`. When `courierAddressLocked` is above zero the same item MUST add "· M travados por endereço" ("1 travado por endereço"), linking to `/operations/courier?problema=endereco`; when it is 0, null or absent, it MUST NOT add it. When `courierAwaitingNfe` is above zero the same item MUST then add "· K aguardando NF-e" (those orders are part of the N, held by the fiscal lock). When `courierAwaitingNfe` is 0 or null, the item MUST NOT add it. Both parts are part of the N and MAY overlap. NF-e without CPF, rejected or with error MUST keep their own items.

When `upsLabelsWithoutPickup` is above zero and the US is on screen, Today MUST show "N etiquetas sem coleta pedida" ("1 etiqueta sem coleta pedida") linking to `/operations/labels#coleta`. When it is zero or absent, it MUST NOT show.

#### Scenario: Brazil morning

- **WHEN** Today returns 3 to dispatch and 1 rejected NF-e for Brazil
- **THEN** it shows "3 pedidos a despachar" linking to Entregas Brasil and "1 NF-e rejeitada" linking to Notas fiscais filtered by rejected

#### Scenario: Bling disconnected

- **WHEN** an admin opens Today and `blingConnected` is false
- **THEN** "Bling desconectado" shows with a link to Notas fiscais

#### Scenario: Bling with the US on screen

- **WHEN** an admin filters Today to the US and `blingConnected` is false
- **THEN** "Bling desconectado" does not show

#### Scenario: On the road for a day

- **WHEN** Today reports 2 deliveries on the road for more than 24 hours
- **THEN** "2 entregas em rota há mais de 24 h" links to the whole "Em rota" tab, oldest first

#### Scenario: Address problems in Brazil

- **WHEN** Today returns `addressIssues.BR` `{ open: 3, stale: 1 }`
- **THEN** it shows "3 problemas de endereço abertos · 1 sem correção há mais de 2 dias" linking to `/operations/courier?problema=endereco`

#### Scenario: Market exceptions on the US screen

- **WHEN** an admin filters Today to the US and `marketExceptions` is `{ BR: 2, US: 1 }`
- **THEN** it shows "1 exceção de mercado" linking to `/operations/market-exceptions`

#### Scenario: Nothing pending

- **WHEN** every count is zero
- **THEN** no shipping or invoice item shows

#### Scenario: Orders waiting for the NF-e

- **WHEN** Today returns `courierToDispatch` 3 and `courierAwaitingNfe` 2 with Brazil on screen
- **THEN** it shows one item "3 pedidos a despachar · 2 aguardando NF-e" and no separate "aguardando NF-e" item

#### Scenario: Fiscal lock off

- **WHEN** Today returns `courierToDispatch` 3 and `courierAwaitingNfe` null
- **THEN** it shows "3 pedidos a despachar" with no "aguardando NF-e"

#### Scenario: Every ready order has its note

- **WHEN** Today returns `courierToDispatch` 3 and `courierAwaitingNfe` 0
- **THEN** it shows "3 pedidos a despachar" with no "aguardando NF-e"

#### Scenario: Labels waiting for a pickup

- **WHEN** Today returns `upsLabelsWithoutPickup` 3 with the US on screen
- **THEN** it shows "3 etiquetas sem coleta pedida" linking to `/operations/labels#coleta`

#### Scenario: Labels without pickup on the Brazil screen

- **WHEN** an admin filters Today to Brazil and `upsLabelsWithoutPickup` is 3
- **THEN** no pickup item shows

#### Scenario: Orders held by the address

- **WHEN** Today returns `courierToDispatch` 4 and `courierAddressLocked` 4 with Brazil on screen
- **THEN** it shows one item "4 pedidos a despachar · 4 travados por endereço", the second part linking to `/operations/courier?problema=endereco`

#### Scenario: Held and waiting for the NF-e

- **WHEN** Today returns `courierToDispatch` 5, `courierAddressLocked` 1 and `courierAwaitingNfe` 2
- **THEN** it shows "5 pedidos a despachar · 1 travado por endereço · 2 aguardando NF-e"

### Requirement: A ready Brazil order says where the box is

A paid Brazil item marked ready MUST show its next step from `courierDelivery`, never "Pronto para entregar": `none` → "Despachar" (Entregas Brasil, "A despachar"); `out_for_delivery` → "Em rota" (Entregas Brasil, "Em rota"); `delivered` → "Entregue"; `failed` → "Despachar de novo" (Entregas Brasil, "Falhas"), in the warning tone.

#### Scenario: Ready in Brazil

- **WHEN** Today returns a ready paid Brazil item with `courierDelivery: "none"`
- **THEN** its next step reads "Despachar" and links to `/operations/courier`

#### Scenario: Already on the road

- **WHEN** the item carries `courierDelivery: "out_for_delivery"`
- **THEN** its next step reads "Em rota" and links to `/operations/courier?aba=em_rota`

#### Scenario: Failed

- **WHEN** the item carries `courierDelivery: "failed"`
- **THEN** its next step reads "Despachar de novo" and links to `/operations/courier?aba=falhas`

### Requirement: Refused payments show the last contact

A refused-payment item MUST show its last contact ("Contatado ontem, 14:05, sem resposta") when there is one, and a "Registrar contato" action for a user with `customers.contact.write`. The dialog opened from Today MUST show the account phone the item carries, with a copy button.

#### Scenario: Contacted

- **WHEN** a past_due item carries a contact from yesterday with outcome no_answer
- **THEN** the item shows when, the outcome and who contacted

### Requirement: The Hoje overdue card says what it counts

The "Atrasados" card on Hoje MUST keep showing `totals.overdue` and MUST carry the hint "Só o que a cozinha não terminou. Pronto esperando saída conta em pedidos a despachar." It MUST NOT show a second number. The per-market split and the "Abrir na fila" link MUST stay as they are. Ready orders past their day MUST NOT add to this card; they are counted in the "pedidos a despachar" line and, while their box has not left, listed as the pending item "pedidos prontos esperando saída".

#### Scenario: Ready orders past their day are elsewhere

- **WHEN** Hoje loads with `totals.overdue` 1 while three ready Brazil orders past their day wait to leave
- **THEN** the "Atrasados" card shows 1 and the hint "Só o que a cozinha não terminou. Pronto esperando saída conta em pedidos a despachar.", the three are counted in the "pedidos a despachar" line, and Pendências shows "3 pedidos prontos esperando saída"

### Requirement: Ready Brazil orders waiting to leave are pending

Hoje MUST list a pending item, with severity "Média", for the Brazil orders whose `dueBucket` is `overdue`, whose production status is ready and whose `courierDelivery` is `none` or absent (the box has not left). It MUST read "N pedidos prontos esperando saída" ("1 pedido pronto esperando saída"). With one order its detail MUST read "{cliente}: o dia de preparo já passou e a caixa ainda não saiu."; with more, "O dia de preparo já passou e as caixas ainda não saíram." Its action MUST read "Abrir entregas" and MUST open `/operations/courier`. It MUST be placed after the "Alta" items and before the other "Média" items. A ready order already on the road, delivered or failed, and a US order, MUST NOT count. While this item shows, Hoje MUST NOT say "Nada travado. Tudo em dia."

#### Scenario: One ready order past its day

- **WHEN** Hoje loads with `totals.overdue` 0 and one ready Brazil order, Charles Mendes, prepared 8 days ago with no courier delivery
- **THEN** Pendências shows "1 pedido pronto esperando saída" as "Média" with "Charles Mendes: o dia de preparo já passou e a caixa ainda não saiu." and "Abrir entregas" linking to `/operations/courier`, the "Atrasados" card shows 0, and "Nada travado. Tudo em dia." does not show

#### Scenario: Box already on the road

- **WHEN** the only ready Brazil order past its day has a courier delivery out for delivery
- **THEN** no "pronto esperando saída" item shows
