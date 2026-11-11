# operations/courier-deliveries Specification

## Purpose

Defines the panel's Entregas Brasil screen (`/operations/courier`), where operators dispatch and close Brazilian courier deliveries, starting with which tab it opens.

## Requirements

### Requirement: Courier tab lives in the URL

Entregas Brasil MUST read the tab from `aba` in the URL (`a_despachar`, `em_rota`, `falhas`, `entregues`), MUST default to `a_despachar` when it is absent or unknown, and MUST write it back when the operator changes tab.

#### Scenario: Link to the failed tab

- **WHEN** the operator opens `/operations/courier?aba=falhas`
- **THEN** the Falhas tab is selected

#### Scenario: Unknown tab

- **WHEN** the operator opens `/operations/courier?aba=xyz`
- **THEN** the A despachar tab is selected

### Requirement: A row has what Uber and WhatsApp need

Rows in "A despachar" and "Em rota" MUST show the delivery address ready to copy (street and number, complement, neighborhood, city/state, ZIP) with a "Copiar endereço" button, the recipient, the account phone with a "Copiar" button, the delivery instructions labeled as from the customer's profile, and the flavors and packs. A missing phone or instructions MUST read "Sem telefone" / "Sem instruções".

#### Scenario: Full row

- **WHEN** a row to dispatch has address, phone and instructions
- **THEN** all show on the row, and "Copiar endereço" copies the address lines

### Requirement: The dispatch link says what it is

A new dispatch MUST keep "Uber" preselected. While the method is Uber, the dialog MUST show the method and the cost, and MUST keep the courier name, the tracking link and the note behind "Detalhes". The tracking link, once "Detalhes" is open, MUST say it is the app's tracking link. The cost MUST stay optional. Choosing another method MUST show the courier name, the tracking link, the cost and the note together. The same dialog, opened from the subscription detail, MUST follow this rule. Editing a delivery MUST show every saved field and MUST NOT use the short form.

#### Scenario: Open dispatch

- **WHEN** an operator opens "Despachar"
- **THEN** the method is Uber, the cost is visible, and the courier name, the link and the note are behind "Detalhes"

#### Scenario: Link hint

- **WHEN** the operator opens "Detalhes" on a new Uber dispatch
- **THEN** the link field explains the tracking link

#### Scenario: Another method

- **WHEN** the operator changes the method to Motoboy
- **THEN** the courier name, the link, the cost and the note are all visible

#### Scenario: Edit keeps every field

- **WHEN** an operator edits a delivery on the road
- **THEN** the dialog shows the saved method, courier, link, cost and note, not the short form

### Requirement: A delivery on the road can be edited

A delivery on the road MUST offer "Editar" to a user with `shipping.write`, which opens the dispatch dialog filled with the saved method, courier, link, cost and note of that delivery (not the dispatch defaults, and refilled when another delivery is edited), and saves the changes without canceling, without a new dispatch and without telling the customer again.

#### Scenario: Wrong Uber link

- **WHEN** an operator edits a delivery on the road and changes the link
- **THEN** the delivery keeps its status and dates and shows the new link

### Requirement: A failure says what kind it was

"Falhou" MUST ask for the kind (Endereço não serve, Cliente ausente, Outro) and the reason text, both required, and send both. The failed row MUST show the kind.

#### Scenario: Address does not work

- **WHEN** an operator marks a failure as "Endereço não serve" with a reason
- **THEN** the request carries `failure_kind: "address_unusable"` and the row in "Falhas" shows the kind

### Requirement: A row records the contact

Rows in "Em rota" and "Falhas" MUST offer "Registrar contato" to a user with `customers.contact.write`, with the reason preset to delivery failure on "Falhas".

#### Scenario: Customer absent

- **WHEN** an operator records a contact from a failed row
- **THEN** the dialog opens with reason "Falha de entrega"

### Requirement: To dispatch is read by delivery range

Entregas Brasil MUST read the delivery range from `de` and `ate` in the URL (`YYYY-MM-DD`) and send them as `from` and `to`. Without them, it MUST send none and label the range "Até amanhã". It MUST offer "Até amanhã", "Próximos 7 dias" (today to six days ahead) and a free range of two dates, and MUST write the choice back to the URL. A `400 invalid_delivery_range` MUST show "Período inválido: até 31 dias, a partir de 30 dias atrás." and keep the previous list.

When `truncated` is true, the warning MUST say the list shows the first 200 orders and link "Ver a partir de {next_from}", which sets `de` to `next_from` and keeps `ate` when it is still within 31 days, or else sets it six days after. When `later` is above zero, the tab MUST say "Mais {later} pedidos com entrega depois de {to}." with a link to the seven days after `to`. The range applies to "A despachar" only; the other tabs MUST say nothing about it.

#### Scenario: Default range

- **WHEN** the operator opens `/operations/courier`
- **THEN** the queue is requested without `from` and `to` and the range reads "Até amanhã"

#### Scenario: Next seven days

- **WHEN** the operator picks "Próximos 7 dias"
- **THEN** the URL gets `de` today and `ate` six days ahead and the queue is requested with them

#### Scenario: Orders after the range

- **WHEN** the queue answers `later: 4` with `range.to` tomorrow
- **THEN** "A despachar" says "Mais 4 pedidos com entrega depois de {tomorrow}." with a link to the following seven days

#### Scenario: List cut

- **WHEN** the queue answers `truncated: true` and `next_from` 2026-11-20
- **THEN** the warning links to the range starting on 2026-11-20

### Requirement: The queue filters orders with an address problem

Entregas Brasil MUST read `problema=endereco` from the URL and, when present, show in "A despachar" and "Falhas" only the rows whose `address_issue` is open or whose `issues` is not empty (held by the address, with or without a problem opened), with a chip "Com problema de endereço" that removes the filter. When no row is left, the tab MUST say "Nenhum pedido com problema de endereço neste período." next to the range choice. Without the filter, every row MUST show.

#### Scenario: Link from Today

- **WHEN** the operator opens `/operations/courier?problema=endereco`
- **THEN** "A despachar" lists only the rows with an open address problem and the chip shows

#### Scenario: Held with no problem opened

- **WHEN** the operator opens `/operations/courier?problema=endereco` and a to-dispatch row has `issues: ["recipient_name_missing"]` and no `address_issue`
- **THEN** that row is listed

### Requirement: A row says whether its NF-e lets the box leave

Entregas Brasil MUST show, on each row of "A despachar" and "Falhas", the invoice's NF-e from the queue: "NF-e {number}" when `authorized` ("NF-e autorizada" without a number). When the queue reports `nfe_required` and the note is not `authorized`, the row MUST show "Aguardando NF-e: {reason}" and its dispatch button MUST be unavailable. When `nfe_required` is false, the row MUST show "NF-e: {reason}" and the button MUST work as before.

#### Scenario: Authorized note

- **WHEN** a row has `nfe` `{ status: "authorized", number: "123" }` and `nfe_required` is true
- **THEN** it shows "NF-e 123" and "Despachar" works

#### Scenario: Authorized without a number

- **WHEN** a row has `nfe` `{ status: "authorized", number: null }`
- **THEN** it shows "NF-e autorizada"

#### Scenario: Note in flight

- **WHEN** `nfe_required` is true and the row's note is `submitted`
- **THEN** it shows "Aguardando NF-e: em emissão" and "Despachar" is unavailable

#### Scenario: No note

- **WHEN** `nfe_required` is true and the row has `nfe` null
- **THEN** it shows "Aguardando NF-e: sem nota registrada" and "Despachar" is unavailable

#### Scenario: Failure tab

- **WHEN** `nfe_required` is true and a "Falhas" row's note is `canceled`
- **THEN** it shows "Aguardando NF-e: cancelada" and "Despachar de novo" is unavailable

#### Scenario: Lock off

- **WHEN** `nfe_required` is false and the row's note is `rejected`
- **THEN** the row shows "NF-e: rejeitada" and "Despachar" works

### Requirement: A blocked note opens where it is fixed

When the row's note is `rejected`, `error` or `blocked_missing_document`, the row MUST link to that note's detail (`/operations/nfe/{id}`), where it is retried or corrected, whether `nfe_required` is on or off. A `canceled` note MUST NOT get the link, since it cannot be retried.

#### Scenario: Rejected note

- **WHEN** a row's note with id 9 is `rejected`
- **THEN** the row links to `/operations/nfe/9`

#### Scenario: Missing CPF

- **WHEN** `nfe_required` is true and a row's note with id 4 is `blocked_missing_document`
- **THEN** it shows "Aguardando NF-e: falta CPF ou nome fiscal" with a link to `/operations/nfe/4`

#### Scenario: Canceled note

- **WHEN** a row's note is `canceled`
- **THEN** the row has no link to the note

### Requirement: A dispatch refused for the NF-e says why

When a dispatch, from Entregas Brasil or from the subscription detail, is refused with `courier_nfe_not_authorized`, the dialog MUST say that the box only leaves with an authorized NF-e, name the note's situation from `nfe_status` (or "sem nota registrada" when null), and say that nothing was dispatched.

#### Scenario: Note changed after the queue loaded

- **WHEN** the API refuses a dispatch with `courier_nfe_not_authorized` and `nfe_status` `rejected`
- **THEN** the dialog shows "A caixa só sai com NF-e autorizada. Situação da nota: rejeitada. Nada foi despachado."

### Requirement: A row with an address problem cannot be dispatched

A row under "A despachar" or "Falhas" whose `issues` is not empty MUST list what is missing in plain words and MUST NOT offer "Despachar". The panel MUST NOT offer any way to dispatch it anyway or to edit the address, except the recipient name.
A row locked by `recipient_name_missing` MUST offer "Informar quem recebe" to a user with `users.delivery.write`. It MUST open a dialog with one empty field, "Nome de quem recebe", the text "Fica nesta assinatura e vale para os próximos pedidos. O nome da conta não muda. Se for presente, confirme com o cliente." and "Salvar nome". When the item has `account_name`, the dialog MUST offer "Usar nome da conta ({account_name})", which fills the field without saving. A 409 `recipient_name_present` MUST say "Esta assinatura já tem nome de quem recebe." and reload. Saving MUST send the name to the subscription's recipient-name route and reload the list; a 422 MUST show under the field.

#### Scenario: Missing number

- **WHEN** a to-dispatch row has `issues: ["address_number_missing"]`
- **THEN** the row says "Falta o número" and has no "Despachar" button

#### Scenario: Missing recipient filled

- **WHEN** a to-dispatch row has only `issues: ["recipient_name_missing"]` and an operator with `users.delivery.write` saves "João Lima" in "Informar quem recebe"
- **THEN** the tab reloads and the row offers "Despachar"

#### Scenario: Recipient and number missing

- **WHEN** a row has `issues: ["recipient_name_missing", "address_number_missing"]` and the operator saves the name
- **THEN** the row still says "Falta o número" and has no "Despachar"

### Requirement: New dispatch refusals have their own text

The dispatch dialog MUST show a specific message for `courier_address_incomplete`, listing the missing fields, and for `shipment_market_exception`.

#### Scenario: Refused after the queue was read

- **WHEN** the API answers 422 `courier_address_incomplete` with `issues: ["address_neighborhood_missing"]`
- **THEN** the dialog says the address lacks the neighborhood and nothing was dispatched

### Requirement: A row shows the address problem and the email

When a row has `address_issue`, it MUST show the email state: "E-mail enviado em dd/mm", "E-mail não enviado", "Cliente corrigiu em dd/mm", or "Sem correção há N dias" when open for more than 2 days.

#### Scenario: Open for 4 days

- **WHEN** a row's problem opened 4 days ago and its email went out the same day
- **THEN** the row shows "E-mail enviado em" with that date and "Sem correção há 4 dias"

### Requirement: A despachar opens on ready orders

Entregas Brasil MUST request "A despachar" without `preparo` unless the URL has `preparo=todos`. It MUST offer "Mostrar todos", which sets `preparo=todos` and sends it, and "Só prontos", which removes `preparo` from the URL. The address filter MUST still apply on top of that list. The empty text of the default list MUST say that no ready order is waiting to leave.

#### Scenario: First open

- **WHEN** the operator opens `/operations/courier`
- **THEN** the queue is requested without `preparo` and "Mostrar todos" is available

#### Scenario: Show the kitchen too

- **WHEN** the operator chooses "Mostrar todos"
- **THEN** the URL has `preparo=todos` and the queue is requested with it

#### Scenario: Back to ready orders

- **WHEN** the operator then chooses "Só prontos"
- **THEN** the URL has no `preparo` and the queue is requested without it

### Requirement: A fatura in the URL opens that order

Entregas Brasil MUST read `fatura` and `assinatura`, and look the invoice up in the queue loaded for the range of the URL (`de` and `ate` when present, the default range otherwise). When that invoice is loaded under "A despachar" and the row can be dispatched, it MUST open the dispatch dialog for that row. When the invoice is loaded on another tab, it MUST select that tab and MUST NOT open the dialog. When the invoice is in none of the loaded groups, it MUST say the order is outside this period and, when `assinatura` is present, link to `/billing/subscriptions/{assinatura}`. A row that cannot be dispatched MUST NOT open the dialog. `fatura` MUST win over `aba` when the invoice is loaded.

#### Scenario: Ready order from the kitchen

- **WHEN** the operator opens `/operations/courier?fatura=in_123` and that invoice is under "A despachar" with no address problem and no NF-e block
- **THEN** the dispatch dialog opens for that order

#### Scenario: Already on the road

- **WHEN** `fatura=in_123` is loaded under "Em rota"
- **THEN** the Em rota tab is selected and the dispatch dialog stays closed

#### Scenario: Outside the period

- **WHEN** the operator opens `/operations/courier?fatura=in_123&assinatura=42` and that invoice is in none of the loaded groups
- **THEN** the page says the order is outside this period, links to `/billing/subscriptions/42`, and does not open the dialog

#### Scenario: Range from Expedir

- **WHEN** the operator opens `/operations/courier?fatura=in_123&assinatura=42&de=2026-11-08&ate=2026-11-11` and that invoice is a dispatchable row delivered on 2026-11-11
- **THEN** the queue is requested with that range and the dispatch dialog opens for that order

#### Scenario: Address holds the box

- **WHEN** the invoice is under "A despachar" and its `issues` is not empty
- **THEN** the dialog stays closed

### Requirement: Selected deliveries on the road can be closed together

On "Em rota", a user with `shipping.write` MUST be able to select deliveries one by one. The screen MUST NOT offer a control that selects every row. With one or more selected, "Marcar entregues (N)" MUST open a dialog whose time defaults to now and can be changed. Confirming MUST mark each selected delivery delivered at that time, one request per delivery, using the delivered action that already exists. A delivery the API accepts MUST leave the tab. A delivery the API refuses MUST stay, with that delivery's error, and the ones that succeeded MUST stay delivered. The single-row "Entregue" MUST keep asking for confirmation and MUST keep sending no date. A user without `shipping.write` MUST NOT see the selection.

#### Scenario: Two deliveries closed at the same time

- **WHEN** an operator selects two deliveries on the road and confirms "Marcar entregues" at 15:40
- **THEN** each selected delivery is marked delivered at 15:40 and both leave the tab

#### Scenario: One of them is refused

- **WHEN** the API accepts the first delivery and refuses the second because the time is before it left
- **THEN** the first leaves the tab and the second stays, with the error

#### Scenario: No mark-all

- **WHEN** an operator looks at "Em rota" with several deliveries
- **THEN** there is no control that selects every row

#### Scenario: One row, as before

- **WHEN** an operator uses "Entregue" on a single row and confirms
- **THEN** that delivery is marked delivered with no date in the request

### Requirement: A name taken from the account is marked

When a row has `name_source: "account"`, the row MUST show the name followed by "(conta)" in muted text. With `recipient` or `email` the row MUST show the name as today.

#### Scenario: Account name on a locked row

- **WHEN** a to-dispatch row has `recipient_name: "Ana Costa"`, `name_source: "account"` and `issues: ["recipient_name_missing"]`
- **THEN** the row shows "Ana Costa (conta)" and "Falta o nome de quem recebe"

### Requirement: The dispatch confirmation is titled by its reason

When the API answers a dispatch with `409 courier_dispatch_needs_confirmation`, the dialog title MUST come from the reasons. With exactly one known reason, the title MUST be:
- "Pedido ainda não está pronto" for `production_not_ready`;
- for `subscription_not_active`: "Assinatura cancelada" (`canceled`), "Assinatura pausada" (`paused`), "Assinatura com pagamento pendente" (`past_due`), and "Assinatura não está ativa" for any other status.

With two or more reasons, with no reasons, or with a code the panel does not know, the title MUST be "Confirme antes de despachar". The list of reasons and the "Voltar" and "Despachar mesmo assim" buttons MUST stay as they are.

#### Scenario: Canceled subscription

- **WHEN** the API answers 409 with only `subscription_not_active` and status `canceled`
- **THEN** the dialog is titled "Assinatura cancelada", lists "Assinatura: Cancelada", and offers "Despachar mesmo assim"

#### Scenario: Order still in the kitchen

- **WHEN** the API answers 409 with only `production_not_ready`
- **THEN** the dialog is titled "Pedido ainda não está pronto"

#### Scenario: Two reasons

- **WHEN** the API answers 409 with `production_not_ready` and `subscription_not_active`
- **THEN** the dialog is titled "Confirme antes de despachar" and lists both reasons

### Requirement: Deliveries show the box count

Each courier delivery MUST show how many boxes it carries, from its `boxes`, for example "2 caixas". A delivery without `boxes` MUST show nothing extra.

#### Scenario: Two-box delivery

- **WHEN** a delivery has two boxes
- **THEN** it shows "2 caixas"
