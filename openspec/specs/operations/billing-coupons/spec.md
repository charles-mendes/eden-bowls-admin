# operations/billing-coupons Specification

## Purpose

Shows operators the first-purchase promo slot on the billing coupons table as a spelled-out month count instead of a compact `Nm` label.

## Requirements

### Requirement: Promotion code slot is shown in words

On `/billing/coupons`, the **Slot** column of “Promotion codes recentes” MUST show the promotion code’s slot as `1 mês` when the slot is 1, and as `<n> meses` when the slot is a finite number greater than 1. The cell MUST show `-` when the slot is missing, empty, zero, or not a positive finite number. The cell MUST NOT show compact `Nm` text such as `1m`, `3m`, or `6m`.

#### Scenario: Six-month slot

- **WHEN** an operator opens `/billing/coupons` and a promotion code row has slot 6
- **THEN** the Slot cell is **6 meses**

#### Scenario: One-month slot

- **WHEN** a promotion code row has slot 1
- **THEN** the Slot cell is **1 mês**

#### Scenario: Three-month slot

- **WHEN** a promotion code row has slot 3
- **THEN** the Slot cell is **3 meses**

#### Scenario: Unmapped promotion code

- **WHEN** a promotion code row has no slot
- **THEN** the Slot cell is **-**

#### Scenario: Non-positive slot

- **WHEN** a promotion code row has slot 0
- **THEN** the Slot cell is **-** and not **0 mês**

### Requirement: Slot wording does not change the promotion-code payload

The promotion-code list payload MUST keep `slot` as a number (`1`, `3`, or `6`) or `null`. This change MUST NOT add a display-label field and MUST NOT require a different response shape from the admin API.

#### Scenario: Numeric slot stays on the payload

- **WHEN** the panel loads recent promotion codes for a mapped six-month slot
- **THEN** the row data still carries numeric slot 6, and only the Slot cell text is **6 meses**

### Requirement: Other coupon-page month abbreviations stay

Alerts for an incomplete map, codes missing in Stripe, and inactive codes MUST keep their current compact month text (`6m` and the same form for other terms). The create-coupon name placeholder MUST stay `First purchase` plus the term and percent, and that placeholder MUST NOT be sent as the coupon name unless the operator types a name. The **Slot** cell wording MUST stay as specified by the slot-in-words requirement. Other fixed labels on the page, including code, name, max redemptions, duration, the recent promotion-codes section title, and the sync success message, MUST be Portuguese. This change MUST NOT restyle the coupons page.

#### Scenario: Incomplete map alert

- **WHEN** the first-purchase map is missing the 6-month term
- **THEN** the alert still names that gap as **6m**

#### Scenario: Name placeholder is not a default payload

- **WHEN** an operator creates a coupon and leaves the name field empty
- **THEN** the request does not send the English placeholder as `name`

#### Scenario: Recent codes section is Portuguese

- **WHEN** an operator opens `/billing/coupons`
- **THEN** the recent promotion-codes section title is Portuguese, the **Slot** cell for slot 1 is still **1 mês**, and the sync success message is Portuguese

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
