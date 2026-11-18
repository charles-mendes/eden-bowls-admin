# Spec Delta

## ADDED Requirements

### Requirement: A Starter shows its Day 1 and invite

The detail of a Starter subscription MUST show its Day 1 with "confirmada" or "prevista", "Convite enviado em <data>" or "Convite ainda não enviado", and a link to the plan confirmed from it, or "Sem plano confirmado". When the API does not send these fields the section MUST NOT be shown.

#### Scenario: Invite from the expected date

- **WHEN** a Starter's Day 1 is expected on 03/12 and the invite was sent on 07/12
- **THEN** the detail shows "Dia 1: 03/12 (prevista)" and "Convite enviado em 07/12"

#### Scenario: Plan confirmed

- **WHEN** the customer confirmed a plan from the Starter
- **THEN** the detail links to that plan's subscription
