## Purpose

Shows operations the subscriptions whose Stripe account and delivery address country fit no shipping market, so they are resolved by hand instead of silently leaving or getting a note.

## ADDED Requirements

### Requirement: Market exceptions have their own page

The panel MUST have a "Exceções de mercado" page under Operação, shown to users with `shipping.read`, listing each exception with its account, address country, customer, open paid cycles and a link to the subscription. An empty list MUST say there are no exceptions.

#### Scenario: One crossed subscription

- **WHEN** the API lists one subscription with account `br` and address country `US`
- **THEN** the page shows a row with "Conta BR", "Endereço US", the customer and a link to its detail

#### Scenario: No exceptions

- **WHEN** the API returns no items
- **THEN** the page says "Nenhuma exceção de mercado"

#### Scenario: No permission

- **WHEN** a user without `shipping.read` opens the panel
- **THEN** the menu has no "Exceções de mercado"

### Requirement: The subscription detail warns about an exception

When the subscription detail has `market_exception: true`, the page MUST show a warning saying the subscription does not ship or get an NF-e until the account and the address country agree.

#### Scenario: Crossed subscription

- **WHEN** an operator opens a subscription with `market_exception: true`
- **THEN** the detail shows the warning above the shipping sections
