# delivery/api-route-contract Specification

## Purpose
Keeps the panel and its test mocks honest against the backend: a route the panel calls or a mock fakes must exist in the backend's published route list, so a missing route fails a test instead of reaching an admin as "Route not found".

## Requirements

### Requirement: Backend publishes its route manifest

The backend MUST keep a versioned manifest listing the method and path of every route under `/api/v1`, with path parameters written as `:name`. A backend test MUST fail when the committed manifest differs from the routes the application actually registers.

#### Scenario: Route added without manifest update

- **WHEN** a developer registers a new `/api/v1` route and does not regenerate the manifest
- **THEN** the backend test suite fails and names the missing route

### Requirement: Route removals are acknowledged

A backend test MUST fail when a route present in `docs/api-routes.json` on `origin/main` is missing from the current manifest, unless that method and path are listed with a reason in `docs/api-routes-removed.json`. When the base version cannot be read (no git history or the file does not exist on the base), the test MUST pass and say why it skipped.

#### Scenario: Route removed silently

- **WHEN** a branch deletes `GET /api/v1/admin/billing/webhooks` and regenerates the manifest without acknowledging it
- **THEN** the removal test fails and names that route

#### Scenario: Route removal acknowledged

- **WHEN** the same route is listed in `docs/api-routes-removed.json` with a reason
- **THEN** the removal test passes

### Requirement: Panel calls only routes in the manifest

The panel MUST keep a copy of the backend manifest. Its Vitest suite MUST fail when a static API path used in panel source, or a path handled by the Vitest or Playwright API mocks, has no matching method and path in that copy. Calls that the panel builds at run time MUST be checked when the Vitest mock receives them. The check MUST NOT need network access, a backend checkout or any secret in CI.

#### Scenario: Component calls a route that does not exist

- **WHEN** panel source calls `GET /admin/markets/conflicts` and the manifest has no such route
- **THEN** the contract test fails and names `GET /api/v1/admin/markets/conflicts`

#### Scenario: Mock fakes a route that does not exist

- **WHEN** a mock answers a path that is not in the manifest
- **THEN** the contract test fails and names that mock path

#### Scenario: Manifest copy is refreshed locally

- **WHEN** a developer runs the panel's manifest sync command with the backend checked out next to the panel
- **THEN** the panel copy is replaced by the backend manifest and the command reports added and removed routes
