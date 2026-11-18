# Spec Delta

## ADDED Requirements

### Requirement: A US subscription shows its shipping condition

The detail of a US subscription with `shipping_waived` true MUST show "Frete grátis para o cliente, pago pela empresa" with `company_shipping_cost` (amount and source: UPS, fixa or contingência), and without an amount when the API does not send it. A US subscription that pays shipping, and every BR subscription, MUST show the freight the customer paid, as before.

#### Scenario: Free US subscription

- **WHEN** an operator opens a US subscription with `shipping_waived` true and a company cost of US$ 18.40 from UPS
- **THEN** the freight block shows "Frete grátis para o cliente, pago pela empresa: US$ 18.40 (UPS)"

#### Scenario: Charged US subscription

- **WHEN** an operator opens a US subscription with `shipping_waived` false
- **THEN** the freight block shows what the customer paid, as before
