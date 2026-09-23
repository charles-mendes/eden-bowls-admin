# Tasks

`eden-bowls` and `eden-bowls-backend` have no tasks. The store does not reference the admin webhook list, and the backend route plus `stripe_webhook_events` stay as they are.

## 1. Painel

- [x] 1.1 Remove the Webhooks Stripe section, the `WebhookItem` type, the `webhooks` and `webhookPage` state, and the `GET /admin/billing/webhooks` fetch from `src/pages/BillingPage.tsx`. Keep catalog sync, metrics, and the subscriptions table, including `Pager` and `Section`. Verify the file no longer contains `Webhooks Stripe` or `/admin/billing/webhooks`.
- [x] 1.2 In `src/pages/BillingPage.test.tsx`, assert that the loaded page does not show Webhooks Stripe and does not request `/api/v1/admin/billing/webhooks`. Verify with `npx vitest run --related src/pages/BillingPage.tsx`.
- [x] 1.3 Update `docs-new/PORTAL_ADMINISTRATIVO_ATUAL/TELAS.md` so the `/billing` description no longer lists the webhook table or `webhookPage`. Leave `CONTRATO_API.md` unchanged. Verify the billing section of `TELAS.md` has no webhook-inbox sentences.
