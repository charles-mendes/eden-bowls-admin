# operations/billing-subscribers Specification

## Purpose

Lets operators work the local Stripe subscription ledger from Assinantes without a technical webhook inbox on the same page.

## Requirements

### Requirement: Assinantes hides the local webhook inbox

The Assinantes page at `/billing` MUST NOT render a Webhooks Stripe section, event ids, event types, or processed timestamps from the local webhook inbox. Loading the page MUST NOT request `GET /api/v1/admin/billing/webhooks`. Catalog sync, billing metrics, and the subscriptions table MUST remain on the page.

#### Scenario: Operator opens Assinantes

- **WHEN** an operator opens `/billing`
- **THEN** the page shows catalog sync, billing metrics, and subscriptions, and does not show Webhooks Stripe

#### Scenario: Page load does not list webhook events

- **WHEN** the Assinantes page loads its data
- **THEN** it does not call `GET /api/v1/admin/billing/webhooks`

### Requirement: Subscriber filters live in the URL

Assinantes (`/billing`) MUST read `status`, `conta`, `busca` and `pagina` from the URL on load and MUST write them back when they change. `status` MUST accept the values the status filter offers (`active`, `trialing`, `past_due`, `canceled`, `canceling`, `all`) and MUST default to `active` when absent or unknown. "Limpar filtros" MUST remove the parameters.

#### Scenario: Open the refused subscribers

- **WHEN** the operator opens `/billing?status=past_due`
- **THEN** the status filter shows Pagamento atrasado and the list request sends `status=past_due`

#### Scenario: Search from a link

- **WHEN** the operator opens `/billing?busca=sub_123&status=all`
- **THEN** the search field shows `sub_123` and the request sends `q=sub_123` and `status=all`

#### Scenario: Unknown status

- **WHEN** the operator opens `/billing?status=xyz`
- **THEN** the status filter shows Ativa
