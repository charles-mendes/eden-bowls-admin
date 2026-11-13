# Spec Delta

## ADDED Requirements

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
