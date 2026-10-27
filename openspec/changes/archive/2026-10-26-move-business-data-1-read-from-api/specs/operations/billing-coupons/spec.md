# Spec Delta

## ADDED Requirements

### Requirement: Term percents come from the API

On `/billing/coupons`, every percent the page shows for a subscription term (the term cards, the term options of the create-coupon form, the code and name placeholders, and the note on the first invoice) MUST come from the `terms` list of the first-purchase coupon health response for the selected Stripe account. The page MUST NOT hold its own percent per term. When the response has no `terms`, or no entry for a term, the page MUST show `-` in place of that term's percent and the placeholders MUST omit the percent.

#### Scenario: Percents from the response

- **WHEN** an operator opens `/billing/coupons` for BR and the health response has `terms` 1 → 10, 3 → 30 and 6 → 40
- **THEN** the 3-month card shows **30% na 1ª fatura** and the 3-month form option shows **3 meses — 30%**

#### Scenario: Note follows the response

- **WHEN** the health response has 3 → 25 and 6 → 40
- **THEN** the note on the first invoice cites **25%/40%**

#### Scenario: Response without terms

- **WHEN** the health response has no `terms`
- **THEN** each term card shows **-** in place of the percent, and no percent from the panel code is shown
