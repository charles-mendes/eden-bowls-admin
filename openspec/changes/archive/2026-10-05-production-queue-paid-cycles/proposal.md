# Proposal

## Why

The production queue spec describes one row per subscription at the ledger's `current_period_end`, the next renewal. The change `redesign-my-plan` (in the `eden-bowls` OpenSpec, tasks 1.5, 3.12, and 3.13) replaced that model in the API and in this app, because the old one dropped a delivery from the queue the moment it was paid: `invoice.paid` moves the ledger to the next period, and `cancel_at_period_end` removed the last contracted delivery as well. The old model also let a cycle move to production before it was paid, and never listed the first delivery. This change brings the published spec in line with the queue that ships.

## What Changes

- A queue row is one production cycle, not one subscription. A subscription can have a paid cycle and its next renewal in the queue at once.
- An unpaid cycle (the next renewal, or for `past_due` the renewal that failed) shows "Aguardando pagamento" or "Pagamento atrasado" until that cycle's `invoice.paid`, and cannot move to `in_production`.
- A paid cycle stays in the queue until it is marked ready, including the last contracted delivery after `cancel_at_period_end` is set. That flag only stops the renewals after it.
- The first delivery enters the queue: the `invoice.paid` of `subscription_create` records it as a paid cycle.
- A paid cycle is due on its preparation day: the first valid day whose local midnight is at or after the payment.
- Blocking an unpaid cycle before preparation moves `trial_end` to the following delivery's preparation day, and returning it restores the original day, as in task 1.5 of `redesign-my-plan`. The cycle moves with its charge.
- The PATCH `periodEnd` is the cycle's own key.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `operations/production-queue`: membership, window, ordering, item fields, cycle storage, the status transition rules, and the page actions change from one row per subscription to one row per production cycle, gated by payment.

## Impact

- API (`eden-bowls-backend`): `GET /api/v1/admin/production/queue` and `PATCH /api/v1/admin/production/queue/:id`, `subscription_production_cycles` (payment columns, migration `1700000000025`), and the `invoice.paid` webhook. Already implemented from commit `3e7eebc` on.
- Admin (`eden-bowls-admin`): the existing Produção page shows the payment label, hides "Em produção" for an unpaid cycle, shows the preparation day of a paid cycle, and keys rows by cycle (commit `179a1cb`). No new page.
- Origin: `redesign-my-plan` in `eden-bowls/openspec/changes/redesign-my-plan`.
