# Spec Delta

## MODIFIED Requirements

### Requirement: Market pickers follow the session

On catalog, billing, production, coupons, feedbacks, privacy, shipping, nutrition, and dashboard, market / account / country controls MUST only offer values inside the session markets. A “todos” / empty / all-accounts option MUST appear only when the session has both markets. Staff with one market MUST have the control locked or omitted and MUST send their market (or the matching Stripe account `br`/`us`) on list and write requests. Coupon account MUST default to the session market, not `us`. Nutrition `country` for a single-market session MUST be locked to that market.

#### Scenario: Operator BR cannot pick US on billing

- **WHEN** an operator assigned `BR` opens billing
- **THEN** the account filter does not include US or “todas”, and list requests do not send `account=us`

#### Scenario: Coupons default to the staff market

- **WHEN** an operator assigned `BR` opens cupons
- **THEN** the account control is `br` and the first load requests the BR Stripe account

#### Scenario: Nutritionist country is locked

- **WHEN** a nutritionist assigned `US` opens the simulator
- **THEN** country is `US`, the other country cannot be selected, and submit sends `country` `US`

#### Scenario: Admin may still pick one market

- **WHEN** an admin opens catalog or dashboard and selects US
- **THEN** subsequent health and list requests use that market (US / USD or `account=us` as the screen already maps)

#### Scenario: Operator BR cannot pick US on product detail

- **WHEN** an operator assigned `BR` opens a product detail
- **THEN** the plan country control offers `BR` and does not offer `US`

#### Scenario: Admin can still pick either country on product detail

- **WHEN** an admin opens a product detail
- **THEN** the plan country control offers both `BR` and `US`
