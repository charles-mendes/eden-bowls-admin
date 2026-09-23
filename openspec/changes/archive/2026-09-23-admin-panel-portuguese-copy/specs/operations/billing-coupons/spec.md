# Spec Delta

## MODIFIED Requirements

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
