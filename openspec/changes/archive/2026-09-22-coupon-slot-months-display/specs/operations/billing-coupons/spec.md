# Spec Delta

## Purpose

Shows operators the first-purchase promo slot on the billing coupons table as a spelled-out month count instead of a compact `Nm` label.

## ADDED Requirements

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

Alerts for an incomplete map, codes missing in Stripe, and inactive codes MUST keep their current compact month text. The slot-mapping field labels and the create-coupon name placeholder MUST stay as they are. This change MUST NOT restyle the coupons page.

#### Scenario: Incomplete map alert

- **WHEN** the first-purchase map is missing the 6-month term
- **THEN** the alert still names that gap as **6m**
