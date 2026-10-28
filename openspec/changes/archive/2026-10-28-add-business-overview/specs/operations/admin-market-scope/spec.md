# Spec Delta

## ADDED Requirements

### Requirement: Business overview market picker follows the session

The Visão do negócio market control MUST only offer markets in the session. It MUST NOT offer Todos, even when the session has both markets. Staff with one market MUST have the control omitted, and the page subtitle MUST name that market.

#### Scenario: Admin with both markets still has no Todos

- **WHEN** an admin with `BR` and `US` opens `/insights` with the demo flag on
- **THEN** the market group offers Brasil and EUA and does not offer Todos

#### Scenario: US operator has no market control

- **WHEN** an operator assigned only `US` opens `/insights` with the demo flag on
- **THEN** the market control is absent, the subtitle names EUA, and Brasil is not offered
