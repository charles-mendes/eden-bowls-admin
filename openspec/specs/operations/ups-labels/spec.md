# operations/ups-labels Specification

## Purpose

Defines how Etiquetas UPS buys labels from the panel and handles an order the API says is not ready.

## Requirements

### Requirement: The batch sends the confirmation the operator gave

When the selection holds orders not ready or with a subscription not active, the queue MUST ask once, listing them, and send `confirm_not_ready: true` only for those the operator confirmed. When the API still answers `409 ups_label_needs_confirmation` for an order, that order MUST end as "Precisa confirmar" with the reasons, nothing bought, and the batch MUST go on. The "Verificar na UPS" section MUST be reachable by the anchor `verificar-ups`.

#### Scenario: Confirmed order not ready

- **WHEN** the operator confirms buying an order in production
- **THEN** its purchase carries `confirm_not_ready: true` and the label is bought

#### Scenario: Opened from Today

- **WHEN** the page opens at `/operations/labels#verificar-ups`
- **THEN** it scrolls to the "Verificar na UPS" section once the queue loads

#### Scenario: Status changed meanwhile

- **WHEN** an order was ready when the queue loaded and the API answers 409 for it
- **THEN** it ends as "Precisa confirmar", no label is bought for it, and the other orders are bought

### Requirement: Ready labels are read by delivery range

Etiquetas UPS MUST read the delivery range from `de` and `ate` in the URL and send them as `from` and `to`, with the same choices, texts and invalid-range message as Entregas Brasil: "Até amanhã" by default, "Próximos 7 dias", a free range, "Ver a partir de {next_from}" when `truncated` (the list shows the first 100 orders), and "Mais {later} pedidos com entrega depois de {to}." when `later` is above zero. The range applies to the ready orders only. Created labels and unconfirmed purchases MUST keep showing whatever the range.

#### Scenario: Default range

- **WHEN** the operator opens `/operations/labels`
- **THEN** the queue is requested without `from` and `to` and the range reads "Até amanhã"

#### Scenario: Label created for later

- **WHEN** the queue answers a created label for a delivery in five days with the default range
- **THEN** the created label is listed

#### Scenario: Orders after the range

- **WHEN** the queue answers `later: 2`
- **THEN** the ready list says "Mais 2 pedidos com entrega depois de {to}."

### Requirement: The label queue filters orders with an address problem

Etiquetas UPS MUST read `problema=endereco` from the URL and, when present, show only the ready rows whose `address_issue` is open, with a chip "Com problema de endereço" that removes the filter. When no ready row is left, it MUST say "Nenhum pedido com problema de endereço neste período." next to the range choice.

#### Scenario: Link from Today

- **WHEN** the operator opens `/operations/labels?problema=endereco`
- **THEN** only ready rows with an open address problem show, and created labels are not hidden

### Requirement: The pickup section requests the day's UPS pickup

Etiquetas UPS MUST have a "Coleta" section (`#coleta`) that lists the created labels with `pickup` null and no tracking scan (`in_transit_at` and `out_for_delivery_at` empty), the same labels Today counts, all selected, and asks for the date (today by default), the ready and close times, and the box count, suggested as the number of selected labels. Only staff with `shipping.write` MUST see the form. "Pedir coleta à UPS" MUST confirm the date, the window, the box count and the label count before calling the API, and MUST show the PRN when UPS confirms.

#### Scenario: Monday with eight boxes

- **WHEN** eight created labels have no pickup
- **THEN** the section lists the eight, selected, and the count field shows 8

#### Scenario: Box already scanned

- **WHEN** a created label without pickup already has `in_transit_at`
- **THEN** the section does not list it

#### Scenario: Fewer boxes than labels

- **WHEN** the operator types 14 boxes with 15 labels selected
- **THEN** the confirmation says "com 14 caixas (15 etiquetas)"

#### Scenario: Requested

- **WHEN** the operator confirms a pickup for today, 14:00 to 18:00, 8 boxes
- **THEN** the panel sends `pickup_date`, `ready_time`, `close_time`, `package_count` 8 and the eight `shipment_ids`, and shows "Coleta pedida. PRN 2929602E9CP."

#### Scenario: Nothing to collect

- **WHEN** every created label already has a pickup, or there is none
- **THEN** the section says "Nenhuma etiqueta sem coleta." and offers no request

#### Scenario: Read-only staff

- **WHEN** staff without `shipping.write` open the page
- **THEN** the section shows the labels and pickups without the form or the actions

### Requirement: A refused pickup says what to fix

The pickup request MUST show a text for each refusal: `pickup_date_not_allowed` ("Não há coleta da UPS nesse dia. Escolha hoje ou o próximo dia útil sem fechamento no calendário."), `pickup_window_invalid`, `pickup_count_invalid`, `pickup_shipment_not_eligible` (the list is reloaded), `pickup_ship_from_incomplete` (with a link to the shipping settings; when `missing` is only `phone`, the text says the phone is missing or short and needs 10 digits) and `pickup_unconfirmed` ("A UPS não confirmou a coleta. Confira no portal da UPS antes de pedir de novo.").

#### Scenario: Phone missing

- **WHEN** the API refuses with `pickup_ship_from_incomplete`
- **THEN** the panel says the US location phone is missing or short and UPS needs 10 digits, with a link to Configurações > Frete

#### Scenario: No UPS answer

- **WHEN** the API answers `pickup_unconfirmed`
- **THEN** the panel shows the text and reloads, and the pickup appears as waiting for a check

### Requirement: Requested pickups can be canceled or closed

The "Coleta" section MUST list the pickups from `GET /admin/shipments/pickups` with date, window, boxes, PRN and status. With `shipping.write`, a `requested` pickup MUST offer "Cancelar coleta" with a confirmation, and an `unknown` pickup MUST show "Verificar no portal da UPS" and offer "Não foi criada" with a confirmation that asks to check the UPS portal first. A `pending` pickup (a request in progress) MUST show "Pedindo à UPS" without actions; the API shows a pending left behind as `unknown`. After either, the queue and the pickups MUST reload.

#### Scenario: Cancel

- **WHEN** the operator confirms "Cancelar coleta" on a requested pickup
- **THEN** the panel calls the cancel route and its labels return to "Sem coleta"

#### Scenario: Checked on the portal

- **WHEN** the operator confirms "Não foi criada" on an unknown pickup
- **THEN** the panel calls the not-created route and its labels can join a new pickup

### Requirement: A created label shows its pickup

Each row of "Etiquetas criadas" MUST show "Coleta pedida para dd/mm · PRN {prn}" when `pickup` is `requested`, "Coleta sem confirmação da UPS" when it is `unknown`, and "Sem coleta" when `pickup` is null.

#### Scenario: Label in a pickup

- **WHEN** a created label has `pickup` `{ pickup_date: "2026-11-09", status: "requested", prn: "2929602E9CP" }`
- **THEN** its row shows "Coleta pedida para 09/11 · PRN 2929602E9CP"

#### Scenario: No pickup

- **WHEN** a created label has `pickup` null
- **THEN** its row shows "Sem coleta"

### Requirement: The US location has a phone for the pickup

The US location card in Configurações > Frete MUST have a "Telefone" field saved as `ship_from.phone`, with a hint that UPS asks for it on the pickup. A phone that is not empty and has fewer than 10 digits MUST show "O telefone precisa de 10 dígitos (código de área e número)." and MUST NOT be saved; an empty phone can be saved.

#### Scenario: Phone too short

- **WHEN** an admin types "555 0100" in the phone
- **THEN** the card shows the 10 digits message and "Salvar sede" stays disabled

#### Scenario: Phone saved

- **WHEN** an admin saves the US location with phone "305 555 0100"
- **THEN** the panel sends `us.ship_from.phone` "305 555 0100" and shows it on the card
