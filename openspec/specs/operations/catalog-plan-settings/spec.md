# operations/catalog-plan-settings Specification

## Purpose
TBD - created by archiving change plan-settings-per-market. Update Purpose after archive.

## Requirements

### Requirement: Plano screen edits the plan settings of a market

The panel MUST show a **Plano** item in the Loja group of the menu for sessions with `catalog.read`, opening `/catalog/plan`. The screen MUST use the market filter of Produtos, limited to the session's markets, and show the market's plan days and large-pack limit from `GET /api/v1/admin/catalog/plan-settings?market=`, with the weights of the active variations the recommendation uses as pack sizes. A session with `catalog.write` MUST be able to save both with `PUT` on the same route; without it the fields MUST be read-only and there MUST be no save button.

#### Scenario: Readonly sees the values

- **WHEN** a session with only `catalog.read` opens **Plano** for BR
- **THEN** the screen shows the BR plan days and large-pack limit without inputs or save button

#### Scenario: Save the limit

- **WHEN** a writer sets the BR large-pack limit to 6 and saves
- **THEN** the panel sends `{ planDays, largePackLimit: 6 }` to the BR route and shows the saved values

### Requirement: Plano screen checks the values before sending

Plan days MUST be a whole number greater than zero and the large-pack limit a whole number from 1 to 60. An invalid value MUST be marked on its field and MUST NOT be sent. API refusals `plan_days_invalid` and `large_pack_limit_invalid` MUST appear in Portuguese on the field, keeping the typed values. Leaving the screen with unsaved values MUST warn.

#### Scenario: Limit out of range

- **WHEN** a writer types 0 in the large-pack limit
- **THEN** the field is marked invalid and no request is sent

#### Scenario: Decimal plan days

- **WHEN** a writer types 28.5 in plan days
- **THEN** the field is marked invalid and no request is sent
