# Design

## Context

Origin: `redesign-my-plan` (`eden-bowls` OpenSpec), design section "A cycle is produced only after its invoice is paid" and tasks 1.5, 3.12, and 3.13. This change records in the admin spec what that change implemented. It adds no code of its own.

## Decisions

### A queue row is one cycle

A cycle is keyed by `(subscription_id, period_end)`, where `period_end` is the charge the cycle belongs to. The API builds the queue from two sources:

- Unpaid: the ledger's next renewal (`current_period_end`), or for `past_due` the renewal that failed (`current_period_start`), when no paid cycle exists for that key. It requires Stripe status `active`, `trialing`, or `past_due`, and `cancel_at_period_end` false unless the status is `past_due`. Its due date is the charge.
- Paid: every cycle with `paid_at`. Its due date is its preparation day (stored as `preparation_day`, compared at noon UTC so it stays on the same civil day in both markets). It ignores `cancel_at_period_end` and the subscription status.

### Payment gate

The `invoice.paid` of a counted cycle invoice (`subscription_create` or `subscription_cycle`, subtotal above zero) records `paid_at`, `paid_invoice_id`, `preparation_day`, and `delivery_date`. The preparation day is the first valid day of the market whose local midnight is at or after the payment, so a late payment after `past_due` moves preparation and delivery. A repeated `invoice.paid` keeps the first payment. A move to `in_production` without payment fails with 409 `production_awaiting_payment`. An unpaid cycle can still be blocked.

### First delivery

Before this change no path put the first delivery into production. The `invoice.paid` of `subscription_create` now records it as a paid cycle. The "Nova assinatura paga" email to operations remains a notice, and the per-invoice UPS label on the subscription page is unchanged.

### Block and return

The queue passes the delivery calendar to the production service (`createAdminProductionService` in the API). Blocking an unpaid cycle before preparation sets `trial_end` to 00:00 of the following delivery's next valid preparation day, without proration; returning it before that start restores 00:00 of the original preparation day, or the next valid one. The ledger takes the new period at once and the unpaid cycle row moves to the new charge, keeping its status and the original preparation day, so the queue keeps showing it. A paid cycle never moves Stripe.

## Risks / Trade-offs

- [Cycles stored before migration 025 have no payment] → They show as awaiting payment until their next `invoice.paid`. Only Stripe sandbox subscriptions exist today.
- [Two rows for one subscription] → Rows are keyed by subscription and cycle in the page, and the PATCH carries the cycle key.
