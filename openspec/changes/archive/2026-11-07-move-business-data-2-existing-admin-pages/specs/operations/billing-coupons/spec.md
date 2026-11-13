# Spec Delta

## ADDED Requirements

### Requirement: Creating a coupon sets the term percent

The "Criar cupom na Stripe" form MUST have a "Desconto na 1ª fatura" field from 1 to 90, starting at the stored percent of the chosen term and reset to it when the term changes. The page MUST send it as `percent_off`. When the value differs from the stored percent and the coupon is to be used in the term's checkout, the form MUST warn that new checkouts of the term get the new percent and that the terms of use cite the percent; when the coupon is not to be used in the checkout, it MUST warn that the term's percent does not change.

#### Scenario: Raise the 3-month percent

- **WHEN** an operator opens the form for 3 months, changes the percent from 25 to 30 and creates the coupon
- **THEN** the request carries `percent_off: 30` and the form showed the warning about the terms of use

#### Scenario: Keep the stored percent

- **WHEN** an operator creates a 1-month coupon without touching the percent
- **THEN** the request carries the stored percent of 1 month and no percent warning is shown

### Requirement: Term card shows a percent mismatch

A term card MUST warn when the mapped coupon gives another percent than the stored one, using `slots[term].percent_mismatch` and `percent_off` of the health response, or, without them, the `percent_off` of the listed promotion code.

#### Scenario: Coupon mapped with another percent

- **WHEN** the 1-month slot reports `percent_mismatch: true` and `percent_off` 15 while the stored percent is 10
- **THEN** the 1-month card shows that the coupon gives 15%
