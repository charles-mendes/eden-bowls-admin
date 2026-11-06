## MODIFIED Requirements

### Requirement: Shipping and invoice work opens the filtered screen

Today MUST list, for the market on screen, each `fulfillment` count above zero with a link to where it is solved: Brazil to dispatch (Entregas Brasil, "A despachar"), on the road for more than 24 hours (Entregas Brasil, "Em rota"), failed with no new dispatch (Entregas Brasil, "Falhas"), NF-e without CPF, rejected or with error (Notas fiscais filtered by that status), unconfirmed UPS purchases (Etiquetas UPS). When `blingConnected` is false and Brazil is on screen (all markets or Brazil), it MUST show "Bling desconectado" linking to Notas fiscais; with the screen filtered to the US it MUST NOT. Counts of zero and markets not on screen MUST NOT show.

For each market on screen, it MUST also list the open address problems of `addressIssues` ("N problemas de endereço abertos", adding "M sem correção há mais de 2 dias" when `stale` is above zero), linking to Entregas Brasil for Brazil and to Etiquetas UPS for the US, both with `problema=endereco`, and the market exceptions of `marketExceptions` ("N exceções de mercado"), linking to Exceções de mercado. The address count is every open problem of the market; the filtered queue shows only the ones on its rows in the range on screen, so the two numbers may differ. The exceptions count has no 200 limit, while the exceptions page lists the first 200.

When `courierAwaitingNfe` is above zero and Brazil is on screen, Today MUST show "N pedidos a despachar aguardando NF-e" ("1 pedido a despachar aguardando NF-e") linking to Entregas Brasil. It is part of "N pedidos a despachar", which MUST keep counting them; both items open "A despachar". When it is `null` or absent, it MUST NOT show.

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

- **WHEN** Today returns `courierAwaitingNfe` 2 with Brazil on screen
- **THEN** it shows "2 pedidos a despachar aguardando NF-e" linking to `/operations/courier`

#### Scenario: Fiscal lock off

- **WHEN** Today returns `courierAwaitingNfe` null
- **THEN** no "aguardando NF-e" item shows

#### Scenario: Labels waiting for a pickup

- **WHEN** Today returns `upsLabelsWithoutPickup` 3 with the US on screen
- **THEN** it shows "3 etiquetas sem coleta pedida" linking to `/operations/labels#coleta`

#### Scenario: Labels without pickup on the Brazil screen

- **WHEN** an admin filters Today to Brazil and `upsLabelsWithoutPickup` is 3
- **THEN** no pickup item shows
