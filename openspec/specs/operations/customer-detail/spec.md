# operations/customer-detail Specification

## Purpose

Defines how the customer page (`/users/:userId`) presents the copies of the customer's delivery address and fiscal data, so the operator knows which deliveries and notes each correction reaches.

## Requirements

### Requirement: Profile delivery address is presented as an exception

The "Endereço de entrega" section MUST state that this address is the account's copy and does not change where a subscription box goes: deliveries use the subscription address, which the customer edits in Meu Plano on the store. The "Nome de quem recebe" field MUST NOT be described as the label or courier name.

#### Scenario: Section text

- **WHEN** an operator opens a customer page
- **THEN** the "Endereço de entrega" section says the box follows the subscription address the customer edits in the store

### Requirement: Saving the profile address asks for confirmation and a reason

"Salvar endereço" MUST open a confirmation that repeats that the subscription address does not change and MUST require a reason of 3 to 255 characters. Confirming MUST send the reason as `reason` with the delivery update. Cancelling MUST NOT send anything.

#### Scenario: Confirm with a reason

- **WHEN** the operator saves the address with reason "Cliente pediu por telefone"
- **THEN** `PATCH /api/v1/admin/users/<id>/delivery` carries `reason: "Cliente pediu por telefone"`

#### Scenario: Cancel the confirmation

- **WHEN** the operator opens the confirmation and cancels
- **THEN** no request is sent and the form keeps the edited values

### Requirement: Fiscal data section says which notes it reaches

The "Dados fiscais" section MUST keep its edit and MUST state that the data is used by the next NF-e and by retrying a note that has not been authorized, and that an authorized note does not change.

#### Scenario: Fiscal data text

- **WHEN** an operator opens a Brazilian customer page
- **THEN** the "Dados fiscais" section says an authorized note does not change

### Requirement: Subscriptions tab shows each subscription's contract

The "Assinaturas" tab MUST show one card per subscription. The card MUST show:
- the Stripe id, linking to the subscription detail;
- status, plan, market, start date, period end and whether it is canceling;
- the contract: term, charged deliveries and auto renew.

When the payload carries `paymentMethod` and `checkoutShipping`, the card MUST also show the card brand with its last four digits and the freight paid at checkout. A value the payload sends as `null` MUST show as "-".

#### Scenario: Brazil subscription with a 6-month term

- **WHEN** an operator opens the tab for a subscription with a 6-month term, 2 charged deliveries, auto renew, a Visa ending in 4242 and R$ 25,00 of freight
- **THEN** the card shows "6 meses", "2 entregas cobradas", that it renews, "Visa •••• 4242" and "R$ 25,00"

#### Scenario: Payload without billing data

- **WHEN** the payload has no `paymentMethod` and no `checkoutShipping`
- **THEN** the card shows neither the card nor the freight

### Requirement: Subscriptions tab shows the latest paid cycle

Each card MUST show a "Último ciclo" block when the subscription carries `latestCycle`. The block MUST show:
- paid date, preparation day and delivery date;
- production status and note, linking to the production queue;
- delivery: the courier status with its date, linking to Entregas Brasil, or the UPS status with its tracking number, linking to the subscription detail;
- NF-e number, status, last error and email status, linking to the note.

A part absent from the payload MUST NOT show. `latestCycle: null` MUST show "Nenhum ciclo pago". A delivery or NF-e sent as `null` MUST show "Não despachado" or "Sem NF-e". `latestCycleUnavailable: true` MUST show a warning that the latest cycle could not be loaded.

#### Scenario: Ready cycle delivered with an authorized note

- **WHEN** the latest cycle is ready, the courier delivered it and NF-e 123 is authorized
- **THEN** the block shows "Pronto", "Entregue" and "NF-e 123" with "Autorizada", and NF-e 123 links to `/operations/nfe/<id>`

#### Scenario: Rejected note

- **WHEN** the note was rejected with an error
- **THEN** the block shows the rejected status and that error

#### Scenario: Subscription not paid yet

- **WHEN** `latestCycle` is `null`
- **THEN** the block says "Nenhum ciclo pago"

#### Scenario: Latest cycle unavailable

- **WHEN** the subscription carries `latestCycleUnavailable: true`
- **THEN** the card warns that the latest cycle could not be loaded and still shows the contract data
