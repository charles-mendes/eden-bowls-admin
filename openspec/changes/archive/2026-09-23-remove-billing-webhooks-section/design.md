# Design

## Context

See proposal.md for why the section goes away. Today `BillingPage` loads health, webhooks, subscriptions, and metrics in one `Promise.all`. The webhook call reads `GET /api/v1/admin/billing/webhooks`, which lists `stripe_webhook_events`. The store never calls that route. Webhook ingestion stays on `POST /stripe/v1/webhook` in the backend.

## Goals / Non-Goals

**Goals:**

- Drop the inbox from the Assinantes UI and stop that page from fetching it.
- Leave the list endpoint and the events table in place so a later replay screen can reuse them.

**Non-Goals:**

- Deleting or changing `GET /api/v1/admin/billing/webhooks`.
- Changing Stripe webhook processing, deduplication, or `stripe_webhook_events`.
- Any edit in `eden-bowls` or `eden-bowls-backend`.
- Building replay, payload inspection, or a replacement ops screen.

## Decisions

- Remove only the admin section, the `WebhookItem` type, `webhooks` / `webhookPage` state, and the webhooks request inside the existing parallel load. `Pager` and `Section` stay because catalog and subscriptions still use them.
- Keep the backend route. The page stopping its call does not change the contract. Removing the route would be a separate change and is not required for the QA answer.
- Leave the fetch stubs in `src/test/mockAdminFetch.ts` and `e2e/helpers/mockAdminApi.ts`. They match a route that still exists. `BillingPage.test.tsx` and `e2e/specs/admin-billing.spec.ts` do not assert the table.
- Update `docs-new/PORTAL_ADMINISTRATIVO_ATUAL/TELAS.md` so the current screen description no longer lists the webhook table. Do not rewrite `CONTRATO_API.md`: that document describes the route, which remains.

## Risks / Trade-offs

- [Someone uses the table as a quick check without the Stripe Dashboard] → The API and table stay, so restoring the section is a UI-only revert. No data migration.
- [TELAS.md still describes older billing behavior besides webhooks] → Touch only the webhook sentences. Do not restyle the rest of that document in this change.

## Migration Plan

Deploy the admin panel. No backend or store release is required. Rollback is restoring the section and the fetch in `BillingPage.tsx`.

## Open Questions

None. The product answer is to hide the section and keep the inbox on the backend.
