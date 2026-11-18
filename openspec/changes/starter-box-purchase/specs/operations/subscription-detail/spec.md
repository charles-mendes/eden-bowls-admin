# Spec Delta

## ADDED Requirements

### Requirement: A Starter subscription is named as such

The subscription detail of a subscription with `plan_kind` `starter` MUST show a "Starter" badge in its header and MUST say that it is a single charge that does not renew, in place of the renewal and contract information. Assinantes MUST show the same badge on its row. A plan subscription MUST look as before.

#### Scenario: Starter detail

- **WHEN** an operator opens a Starter subscription
- **THEN** the header shows "Starter" and the page says "Cobrança única, sem renovação" in place of the contract terms

#### Scenario: Subscriber list

- **WHEN** Assinantes lists a Starter
- **THEN** its row shows the "Starter" badge
