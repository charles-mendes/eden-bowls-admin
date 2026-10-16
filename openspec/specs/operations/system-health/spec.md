# operations/system-health Specification

## Purpose
Gives admins one collapsed Dashboard section that tells whether billing plumbing works: Stripe webhooks arriving per account, catalog prices mapped, and customer markets consistent with Stripe.

## Requirements

### Requirement: System health section is admin-only

The Dashboard MUST render the collapsed section **Saúde do sistema** only when the session has the `admin` role. For any other session it MUST NOT render the section and MUST NOT request the webhook health or conflicts endpoints.

#### Scenario: Admin opens Dashboard

- **WHEN** an admin opens `/dashboard`
- **THEN** the collapsed **Saúde do sistema** section is present

#### Scenario: Operator opens Dashboard

- **WHEN** an operator opens `/dashboard`
- **THEN** the section is absent and neither `/admin/billing/webhooks/health` nor `/admin/markets/conflicts` is requested

### Requirement: System health shows webhooks, catalog prices and conflicts only

The section MUST contain, in this order: the Stripe webhook indicator, **Preços Stripe no catálogo** (unchanged except for the last-sync line), and **Conflitos de mercado**. It MUST NOT show the checkout metric cards Checkouts, Vinculados Stripe, Stripe ativos or Com simplificado, and MUST NOT request `/admin/onboarding/metrics`.

#### Scenario: Checkout cards are gone

- **WHEN** an admin expands the section
- **THEN** no card labelled Checkouts, Vinculados Stripe, Stripe ativos or Com simplificado is rendered and `/admin/onboarding/metrics` is not requested by the section

### Requirement: Webhook health endpoint is admin-only

`GET /api/v1/admin/billing/webhooks/health` MUST return `401` without a valid Bearer token and `403` for any session without the `admin` role. It MUST report both Stripe accounts regardless of the caller's market assignment.

#### Scenario: Operator is forbidden

- **WHEN** an operator calls the endpoint
- **THEN** the response is `403`

### Requirement: Webhook health reports each Stripe account

The endpoint MUST respond `200` with `{ generatedAt, staleAfterHours, accounts }`, where `accounts` holds exactly one entry for `br` and one for `us`. Each entry MUST carry `account`, `status`, `lastEventAt` (ISO 8601 or `null`), `lastEventType` (or `null`), `failedLast24h` (events marked failed in the last 24 hours) and `pendingOverdue` (events received more than 1 hour ago that are neither processed nor failed).

#### Scenario: Account has received events

- **WHEN** account `us` received a `invoice.paid` event 2 hours ago as its newest event
- **THEN** the `us` entry has `lastEventType: "invoice.paid"` and `lastEventAt` equal to that receipt time

#### Scenario: Failure older than 24 hours

- **WHEN** account `br` has one event marked failed 30 hours ago and none since
- **THEN** the `br` entry has `failedLast24h: 0`

### Requirement: Webhook status is derived from fixed thresholds

`status` MUST be `no_events` when the account has never received an event. Otherwise it MUST be `attention` when `failedLast24h > 0`, `pendingOverdue > 0`, or the newest event is older than 72 hours (`staleAfterHours: 72`). Otherwise it MUST be `ok`.

#### Scenario: Healthy account

- **WHEN** account `us` received an event 3 hours ago, has no failure in 24 hours and nothing overdue
- **THEN** its status is `ok`

#### Scenario: Silent account

- **WHEN** the newest `br` event is 80 hours old and nothing failed
- **THEN** its status is `attention`

#### Scenario: Recent failure

- **WHEN** account `us` received an event 10 minutes ago and one event failed 5 hours ago
- **THEN** its status is `attention`

#### Scenario: Never received anything

- **WHEN** there is no event for account `br`
- **THEN** its status is `no_events`, `lastEventAt` is `null` and the counters are 0

### Requirement: Panel shows one webhook indicator per account

The section MUST show one row each for Brasil (`br`) and EUA (`us`) with a status badge (`ok` → success **OK**, `attention` → warning **Atenção**, `no_events` → info **Sem eventos**), the last event time and type, and the 24h failure count. A load failure MUST render `div.alert` and MUST NOT render an OK badge.

#### Scenario: One account needs attention

- **WHEN** the API returns `br` as `attention` with 2 failures and `us` as `ok`
- **THEN** the Brasil row shows **Atenção** and 2 failures, and the EUA row shows **OK**

#### Scenario: Endpoint fails

- **WHEN** the webhook health request fails
- **THEN** the indicator shows the error in `div.alert` and no account is shown as OK

### Requirement: Last sync is shown per market

Inside **Preços Stripe no catálogo**, the section MUST show the newest catalog sync of each market returned in `byMarket`: market, finish time, result in Portuguese and, for a failed run, its error message. When there is no run it MUST say that no sync has been recorded, and MUST NOT mention the server session.

#### Scenario: Failed BR sync

- **WHEN** `byMarket.BR` is a failed run with error "No such product"
- **THEN** the Brasil line shows the failure, its time and "No such product"

#### Scenario: No sync recorded

- **WHEN** the status response is `{ status: null, byMarket: {} }`
- **THEN** the section says no sync has been recorded
