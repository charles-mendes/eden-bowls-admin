# Spec Delta

## Purpose

Covers the shipping settings that operators edit on `/shipping`.

## ADDED Requirements

### Requirement: UPS section edits the US maximum transit days

The UPS section of the US rules MUST show "Prazo máximo de trânsito" (`us.max_transit_days`, 1 to 10 business days), and an operator with `shipping.write` MUST save it with the other US rules. Above 1 day, the page MUST warn that the insulated box was planned for about 48 hours.

#### Scenario: Save two days

- **WHEN** an operator sets the transit limit to 2 and saves the US rules
- **THEN** the request carries `us.max_transit_days: 2` and the page shows the insulated-box warning

#### Scenario: Value from the API

- **WHEN** the settings response has no `max_transit_days`
- **THEN** the field shows 1, the value before this change
