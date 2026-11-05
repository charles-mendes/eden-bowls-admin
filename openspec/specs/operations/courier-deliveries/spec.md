# operations/courier-deliveries Specification

## Purpose

Defines the panel's Entregas Brasil screen (`/operations/courier`), where operators dispatch and close Brazilian courier deliveries, starting with which tab it opens.

## Requirements

### Requirement: Courier tab lives in the URL

Entregas Brasil MUST read the tab from `aba` in the URL (`a_despachar`, `em_rota`, `falhas`, `entregues`), MUST default to `a_despachar` when it is absent or unknown, and MUST write it back when the operator changes tab.

#### Scenario: Link to the failed tab

- **WHEN** the operator opens `/operations/courier?aba=falhas`
- **THEN** the Falhas tab is selected

#### Scenario: Unknown tab

- **WHEN** the operator opens `/operations/courier?aba=xyz`
- **THEN** the A despachar tab is selected
