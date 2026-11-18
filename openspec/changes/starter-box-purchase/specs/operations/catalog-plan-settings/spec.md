# Spec Delta

## ADDED Requirements

### Requirement: Plano screen edits the Starter Box

The **Plano** screen MUST show a "Starter Box" section with the market's Starter days and Starter discount percent, from the same plan settings route. A session with `catalog.write` MUST save them together with the plan days and the large-pack limit, as `starterDays` and `starterDiscountPercent`; without it they MUST be read-only. Before sending, the panel MUST refuse Starter days outside 1 to 30 and a percent outside 1 to 90 with a message next to the field. A 422 `starter_days_invalid` MUST show "Os dias da Starter vão de 1 a 30." and a 422 `starter_discount_percent_invalid` MUST show "O desconto da Starter vai de 1% a 90%.", keeping the typed values. The section MUST say that the discount applies only to the food and that the next Starter checkouts use the saved values.

#### Scenario: Save the US percent

- **WHEN** a writer sets the US Starter discount to 35 and saves
- **THEN** the panel sends `starterDiscountPercent: 35` with the other US plan settings and shows the saved values

#### Scenario: Days out of range

- **WHEN** a writer types 0 Starter days
- **THEN** the panel shows the message next to the field and does not send the request

#### Scenario: Read-only session

- **WHEN** a session with only `catalog.read` opens **Plano**
- **THEN** the Starter days and percent are shown without inputs
