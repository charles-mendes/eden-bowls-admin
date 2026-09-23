# Spec Delta

## Purpose

Lets operators work the local Stripe subscription ledger from Assinantes without a technical webhook inbox on the same page.

## ADDED Requirements

### Requirement: Assinantes hides the local webhook inbox

The Assinantes page at `/billing` MUST NOT render a Webhooks Stripe section, event ids, event types, or processed timestamps from the local webhook inbox. Loading the page MUST NOT request `GET /api/v1/admin/billing/webhooks`. Catalog sync, billing metrics, and the subscriptions table MUST remain on the page.

#### Scenario: Operator opens Assinantes

- **WHEN** an operator opens `/billing`
- **THEN** the page shows catalog sync, billing metrics, and subscriptions, and does not show Webhooks Stripe

#### Scenario: Page load does not list webhook events

- **WHEN** the Assinantes page loads its data
- **THEN** it does not call `GET /api/v1/admin/billing/webhooks`
