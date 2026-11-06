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

#### Scenario: Nothing pending

- **WHEN** every count is zero
- **THEN** no shipping or invoice item shows

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
