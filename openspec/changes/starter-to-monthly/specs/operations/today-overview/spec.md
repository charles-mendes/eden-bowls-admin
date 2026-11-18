# Spec Delta

## ADDED Requirements

### Requirement: Hoje flags Starters with an unconfirmed delivery

When `fulfillment.startersUnconfirmed` is present, **Hoje** MUST show a card "Starter sem entrega confirmada" with the count of each market the session sees, and list each Starter with the customer, the expected delivery date, and a link to its UPS shipment (US) or courier delivery (BR). The card MUST say that the Day 5 invite went out from the expected date and that the delivery needs to be checked. With a count of 0 the card MUST show "Nenhuma". When the field is absent (older API) the card MUST NOT be shown.

#### Scenario: Courier did not mark the delivery

- **WHEN** the API reports `startersUnconfirmed.BR` 1 with one BR Starter
- **THEN** Hoje shows the card with 1 and the Starter's customer, expected date and a link to its courier delivery

#### Scenario: Older API

- **WHEN** `fulfillment` has no `startersUnconfirmed`
- **THEN** the card is not shown
