# Spec Delta

## MODIFIED Requirements

### Requirement: Admin conflict card lists profile vs Stripe mismatches

The panel MUST show a conflicts card only to admin sessions. The card MUST load an admin-only conflicts list from `GET /api/v1/admin/markets/conflicts` and MUST present counts (and rows when returned) of customers whose profile market disagrees with a Stripe account on their billing records. Non-admin sessions MUST NOT request or render the card. Load failure MUST use `div.alert`.

#### Scenario: Admin sees the conflicts card

- **WHEN** an admin opens Dashboard (or the conflicts surface defined in design) and the API returns at least one conflict
- **THEN** the card is visible with that count and one table row per returned conflict showing e-mail, profile market and Stripe account

#### Scenario: Operator does not see the conflicts card

- **WHEN** an operator opens Dashboard
- **THEN** the panel does not call the conflicts endpoint and does not render the card

#### Scenario: More conflicts than one page

- **WHEN** the API reports a `total` larger than the rows on the current page
- **THEN** the card shows the total and lets the admin move to the next page, which requests `page=2`

## ADDED Requirements

### Requirement: Conflicts endpoint is admin-only

`GET /api/v1/admin/markets/conflicts` MUST return `401` without a valid Bearer token and `403` for any authenticated session whose roles do not include `admin` (operator, readonly, nutritionist). It MUST NOT be narrowed by the caller's market assignment: an admin sees conflicts from both markets.

#### Scenario: No token

- **WHEN** the endpoint is called without `Authorization`
- **THEN** the response is `401`

#### Scenario: Operator is forbidden

- **WHEN** an operator assigned to `BR` and `US` calls the endpoint
- **THEN** the response is `403` and no conflict data is returned

### Requirement: Conflicts endpoint returns paginated rows and a total

The endpoint MUST accept `page` (default 1) and `perPage` (default 20, max 100) and MUST respond `200` with `{ total, page, perPage, totalPages, items }`. Each item MUST carry `userId` (string), `email`, `profileMarket` (`BR`|`US`) and `stripeAccount` (`br`|`us`). Items MUST be ordered by e-mail, then Stripe account.

#### Scenario: No conflicts

- **WHEN** every customer's profile market matches the Stripe account of all their subscriptions
- **THEN** the response is `200` with `total: 0` and `items: []`

#### Scenario: One conflict

- **WHEN** a customer with profile market `BR` has a subscription recorded on Stripe account `us`
- **THEN** the response contains one item with that customer's id and e-mail, `profileMarket: "BR"` and `stripeAccount: "us"`, and `total: 1`

### Requirement: Conflict rule is the same for the endpoint and the backfill check

A conflict MUST be one distinct pair of customer and Stripe account where the customer's stored profile market is `BR` or `US`, a subscription of that customer is on Stripe account `br` or `us`, and the account does not match the market (`BR`↔`br`, `US`↔`us`). Several subscriptions of one customer on the same account MUST count once. The backfill dry-run MUST report the same total as the endpoint.

#### Scenario: Two subscriptions on the same wrong account

- **WHEN** a `BR` customer has two subscriptions on Stripe account `us`
- **THEN** the endpoint returns one item and `total: 1`, and the backfill dry-run reports 1 conflict

#### Scenario: Profile without a market

- **WHEN** a customer has no stored profile market
- **THEN** that customer is not reported as a conflict
