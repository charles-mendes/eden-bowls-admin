# Spec Delta

## ADDED Requirements

### Requirement: Catalog sync runs are persisted per market

Every catalog price sync MUST be stored as one run per market it touched, with market (`BR`|`US`), currency, scope (`market`|`product`), product id when scoped to a product, result (`completed`, `completed_with_skips` or `failed`), created/updated/skipped counts, start and finish time. A failed sync MUST be stored with result `failed` and its error message (up to 500 characters), and the API MUST still return the original error to the caller.

#### Scenario: Successful market sync

- **WHEN** an operator syncs market `BR` and 3 prices are created
- **THEN** one `BR` run is stored with result `completed` and `created: 3`, and it survives an API restart

#### Scenario: Failed sync

- **WHEN** a `US` sync fails with the Stripe error "No such product"
- **THEN** a `US` run is stored with result `failed` and error "No such product", and the sync request still fails with that error

### Requirement: Sync runs are kept 50 per market

The system MUST keep at most the 50 most recent runs per market. Storing a new run MUST delete older runs of the same market beyond the newest 50, and MUST NOT delete runs of the other market.

#### Scenario: Fifty-first run

- **WHEN** market `BR` already has 50 runs and a new `BR` run is stored
- **THEN** the oldest `BR` run is removed, `BR` keeps 50 runs, and the `US` runs are unchanged

### Requirement: Sync status is scoped to the caller's markets

`GET /api/v1/admin/catalog/sync/status` MUST return the newest run within the caller's market scope (narrowed by `market` when given) as the top-level object, keeping the existing fields (`syncJobId`, `status`, `scope`, `market`, `currency`, `summary`, `createdAt`, `updatedAt`) plus `error`. It MUST also return `byMarket` with the newest run of each market in scope. With no run in scope it MUST return `{ status: null, byMarket: {} }`.

#### Scenario: Operator assigned to US

- **WHEN** an operator assigned only to `US` reads the status and the newest overall run is `BR`
- **THEN** the response shows the newest `US` run and `byMarket` has only `US`

#### Scenario: Admin sees both markets

- **WHEN** an admin reads the status and both markets have runs
- **THEN** `byMarket` has `BR` and `US`, each with its newest run

#### Scenario: No runs yet

- **WHEN** no sync has ever run in the caller's scope
- **THEN** the response is `{ status: null, byMarket: {} }`
