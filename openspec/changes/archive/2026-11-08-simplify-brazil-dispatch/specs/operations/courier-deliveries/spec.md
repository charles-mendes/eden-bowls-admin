## MODIFIED Requirements

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

## ADDED Requirements

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
