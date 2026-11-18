# Spec Delta

## ADDED Requirements

### Requirement: Starter orders are marked in the queues

A production queue item, a courier delivery row and a UPS label row whose `plan_kind` is `starter` MUST show a "Starter" badge next to the customer, so the kitchen packs the Starter box and its material. An item without `plan_kind`, or with `subscription`, MUST show no badge.

#### Scenario: Starter in production

- **WHEN** the production queue lists a cycle with `plan_kind` `starter`
- **THEN** its item shows the "Starter" badge

#### Scenario: Older API

- **WHEN** an item has no `plan_kind`
- **THEN** it shows no badge
