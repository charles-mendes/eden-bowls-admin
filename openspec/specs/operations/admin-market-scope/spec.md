# operations/admin-market-scope Specification

## Purpose

Isolates the admin panel by assigned market so Brazil staff only see Brazil records and controls, United States staff only see United States records and controls, and admins can still operate both markets from the same session.

## Requirements

### Requirement: Session exposes assigned markets

The panel MUST load `markets` and derived permissions `market.br` / `market.us` from `GET /api/v1/admin/me` into the operational session. The access token MUST continue to identify only the user id. Admin (and allowlisted admin) sessions MUST expose both `BR` and `US`. Other operational roles MUST expose exactly the markets returned by the session. The panel MUST NOT reconstruct markets from a persisted profile other than that `/admin/me` payload.

#### Scenario: Admin session can use both markets

- **WHEN** an admin session finishes bootstrap from `/admin/me`
- **THEN** `markets` includes `BR` and `US` and the session has both `market.br` and `market.us`

#### Scenario: Operator session is one market

- **WHEN** an operator assigned `BR` finishes bootstrap from `/admin/me`
- **THEN** `markets` is `["BR"]` and the session has `market.br` and does not have `market.us`

### Requirement: Non-admin invite and role assignment require a market

When creating staff access, editing staff access, or assigning a panel role other than `admin`, the panel MUST require a **Mercado** field of `BR` or `US` and MUST send `market` on `POST /admin/users`, `PATCH /admin/users/:id`, and `PUT /admin/users/:id/roles`. Assigning `admin` MUST NOT require Mercado. Existing last-admin, self-demote, self-delete, and allowlist locks MUST remain visible and blocking. Readonly sessions MUST NOT see those mutation controls.

#### Scenario: Invite operator without market is blocked in the dialog

- **WHEN** an admin opens the create-access dialog, chooses role `operator`, leaves Mercado empty, and submits
- **THEN** the panel does not call `POST /admin/users` and shows a validation error on Mercado

#### Scenario: Invite operator with market sends market

- **WHEN** an admin creates access with role `operator` and Mercado `US`
- **THEN** `POST /admin/users` includes `market` `US`

#### Scenario: Assigning admin omits market

- **WHEN** an admin assigns role `admin` to an existing account
- **THEN** the save request does not require Mercado and succeeds without sending a staff market

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

### Requirement: Dashboard uses the session market

Dashboard catalog health MUST stop hardcoding Brazil / BRL. It MUST request sync health for a market in the session. A single-market session MUST use that market and its currency. An admin session MUST choose which market to view. Checkout metric cards MAY stay unfiltered in the UI only when the backend already scopes `/admin/onboarding/metrics`; the catalog section MUST show which market is in view.

#### Scenario: Operator BR dashboard is Brazil

- **WHEN** an operator assigned `BR` opens Dashboard
- **THEN** catalog health is requested with Brazil / BRL and the copy does not describe the US catalog

#### Scenario: Admin can switch dashboard market

- **WHEN** an admin selects US on Dashboard
- **THEN** catalog health is requested for US / USD

### Requirement: Cross-market profile links stay closed

On billing subscription detail, the Cliente and Onboarding 360 actions MUST be links only when the payload marks the customer profile as in the actor’s markets (`customerProfileInScope` true). When the flag is false or omitted as false, the panel MUST show the ledger identity (email and name from the subscription snapshot) as text without those links. The panel MUST NOT send the operator to `/users/:id` or `/onboarding/sessions/:id` for an out-of-scope profile.

#### Scenario: In-scope profile keeps the Cliente link

- **WHEN** subscription detail returns `customerProfileInScope` true and a user id
- **THEN** Cliente and 360 are links to that customer and onboarding session

#### Scenario: Out-of-scope profile has no Cliente link

- **WHEN** an operator assigned `US` opens a US subscription whose customer profile is BR
- **THEN** the screen shows the ledger email and does not render links to `/users/:id` or `/onboarding/sessions/:id`

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

### Requirement: Backfill apply does not depend on the conflict count

Counting conflicts by customer and account MUST NOT change what the backfill apply mode writes. Apply MUST keep filling only empty profile and onboarding markets from the address country, and MUST NOT change the market of a customer that already has one or the Stripe account of any subscription.

#### Scenario: Customer with two subscriptions on the wrong account

- **WHEN** a `BR` customer has two subscriptions on Stripe account `us` and the backfill runs in apply mode
- **THEN** the dry-run reports 1 conflict, the customer's profile market stays `BR`, and both subscriptions stay on account `us`

### Requirement: Out-of-scope API errors stay visible

When a list or record request fails with `403` `market_required` or `market_forbidden`, the panel MUST show the error in `div.alert` and MUST NOT replace it with an empty-success table. Readonly mutation controls MUST remain hidden.

#### Scenario: Unassigned operator with enforcement on sees market_required

- **WHEN** a non-admin session with no markets loads customers and the API returns `403` `market_required`
- **THEN** the page shows the error alert and does not render a successful empty customer list
