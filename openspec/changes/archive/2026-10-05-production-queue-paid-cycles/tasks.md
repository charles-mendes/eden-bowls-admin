# Tasks

## 1. API (eden-bowls-backend)

- [x] 1.1 Build the queue from cycles: unpaid next renewal (or failed renewal for `past_due`) and paid cycles, ordered by due date. Commit `3e7eebc`.
- [x] 1.2 Record a paid cycle on the `invoice.paid` of a counted cycle invoice, with the preparation day from the payment and the delivery date from the market rule; keep the first payment on a repeat. Commits `3e7eebc`, `0ca9d54` (migration tests).
- [x] 1.3 Refuse `in_production` for an unpaid cycle with 409 `production_awaiting_payment`, and accept the PATCH `periodEnd` of a paid cycle whatever happens to later renewals. Commit `3e7eebc`.
- [x] 1.4 Keep the paid last contracted delivery in the queue after `cancel_at_period_end` is set, until it is ready. Commits `3e7eebc`, `d751504` (test).
- [x] 1.5 List the first delivery from the `invoice.paid` of `subscription_create`. Commits `3e7eebc`, `ea9427e` (test).
- [x] 1.6 Wire the delivery calendar into the production service so a block and a return move `trial_end`, and move the unpaid cycle with its charge. Commit `90f28ae`.

## 2. Admin page (eden-bowls-admin)

- [x] 2.1 Show the payment label, hide "Em produção" for an unpaid cycle, show the preparation day of a paid cycle, and key rows by cycle. Commit `179a1cb`.

## 3. Spec

- [x] 3.1 Record the cycle-based queue in `operations/production-queue` with this change's delta, citing `redesign-my-plan` as the origin.
