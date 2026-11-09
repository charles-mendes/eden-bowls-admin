## ADDED Requirements

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
