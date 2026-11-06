## ADDED Requirements

### Requirement: A market exception reads as a blocking reason

The label queue and the subscription detail MUST show `shipment_market_exception` as "Conta e país do endereço não combinam", and a row with an `address_issue` MUST show its email state as the courier queue does.

#### Scenario: Crossed order in a single purchase

- **WHEN** a single label purchase returns 422 `shipment_market_exception`
- **THEN** the detail shows "Conta e país do endereço não combinam" and no label is listed
