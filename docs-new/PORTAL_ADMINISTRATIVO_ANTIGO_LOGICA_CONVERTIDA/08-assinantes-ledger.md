# Assinantes (ledger Stripe)

## Origem WP

Menu **Stripe → Assinantes** (`pawbowl-stripe-subscriptions`). Alias oculto `pawbowl-stripe-dashboard` renderiza a **mesma** lista (não o dashboard ops).

Listagem SQL local. Ações: abrir Stripe, detalhe, PDF invoice, CSV frete, reconciliação, backfill user↔customer, sync invoices. **Não** pausa/cancela/troca plano.

Default da lista: `status=active` se a query não vier. Limpar filtros **volta para active**.

## O que o backend já tem

Ledger `stripe_subscriptions` (`src/infrastructure/entities/stripe-subscription.entity.js`):

| Coluna | Uso no portal |
|---|---|
| `user_id` | vínculo cliente (1 user → **N** rows) |
| `customer_email` | busca / display |
| `stripe_subscription_id` | `sub_…` unique |
| `stripe_customer_id` | `cus_…` |
| `status` | status Stripe |
| `plan_label` | rótulo |
| `stripe_price_id` | price |
| `current_period_start/end` | renovação |
| `cancel_at_period_end` | “cancelando” |
| `payment_method_last4/brand` | detalhe |
| `pets_snapshot`, `plan_selection`, `shipping`, `address` | JSON do checkout |
| `subscription_term_months` | 1/3/6 |
| `edit_payment_pending`, `edit_pending` | fluxo do **cliente**, não do admin |

**Não tem hoje:** `plan_amount`, `plan_currency`, `plan_interval`, `canceled_at`, tabelas de invoice / shipping items.

Webhook: `POST /stripe/v1/webhook` → `StripeWebhookService` (alimenta o ledger). Inbox `stripe_webhook_events` (`event_id`, `type`, `processed_at`, `payload_summary`). Sem tentativas/state ricos do WP (attempts, correlation, replay).

Rotas **do cliente** (JWT dono) — **não** usar no admin:

| Método | Path |
|---|---|
| GET | `/api/v1/subscriptions` (`listMine`) |
| GET | `/api/v1/subscriptions/:id/detail` (ownership) |
| POST | `/api/v1/subscriptions/:id/actions` |
| POST | `.../edit/preview` e `.../edit/commit` |

O SPA `/billing` (`BillingPage.tsx`) lista `GET /admin/billing/subscriptions` e webhooks — **rotas ausentes**. Não há tela de detalhe.

## Regras a preservar

1. Grid lê **ledger local**, não a API Stripe linha a linha.
2. Status persistidos: `active`, `trialing`, `past_due`, `unpaid`, `canceled`, `incomplete`, `incomplete_expired`, `paused`.
3. “Cancelando” = `cancel_at_period_end` **e** status ∈ {active, trialing, past_due}. Filtro e KPI usam a **mesma** predição (o WP divergia: o filtro `status=canceling` era igualdade SQL e zerava a lista — **corrigir**).
4. KPI “Ativas” = `active` + `trialing`.
5. MRR estimado: mensalizar `plan_amount` de active+trialing (year/12, week×4.34524, day×30.4375, month composto `amount/interval_count`). Não descontar quem está cancelando no fim do período. Zero-decimal sem /100. Soma por moeda.
6. Renovação 7d: `current_period_end` ∈ (agora, agora+7d) e status active|trialing|past_due.
7. Canceladas 30d: status canceled e timestamp nos últimos 30 dias.
8. Default da lista: `status=active`. Limpar filtros volta para active.
9. PDF invoice: redirect 302 para URL Stripe (`in_…`), não proxy de arquivo.
10. Operador **não** dispara `pause|cancel|change_plan` por esta UI.
11. Backfill preenche `user_id` por email/`cus_`; **não cria** usuário.
12. Deep links Stripe: `sk_test_` → `https://dashboard.stripe.com/test/...`, senão live.
13. Badge: success `active|trialing`; warning `past_due|unpaid`; error `canceled|incomplete_expired`; secondary o resto.

KPIs (paridade WP): Total respeita filtro de **status** (não search). Ativas / Cancelando / Em atraso / Canceladas 30d / MRR / Renovação 7d / Faturas 30d **ignoram** o filtro da grid.

Busca LIKE: `sub_`, `cus_`, email, nome, `userId`. O placeholder WP mencionava fatura mas **não buscava** — na conversão, ou busca invoice de verdade (quando houver tabela) ou tira a palavra.

## UI alvo

- `/billing` — KPIs + tabela (o SPA já tem um recorte: health de catálogo + webhooks + subs).
- `/billing/subscriptions/:id` — **criar** detalhe.

Ações por linha: Ver no Stripe, Ver detalhes.

Toolbar: status, busca, filtrar, limpar (volta active), “Vincular ao usuário”, “Sincronizar agora”.

Detalhe: header (cliente, plano, badge, renovação, cancelamento agendado, price id), deep links (assinatura + customer), faturas locais, frete auditado (quando houver tabela), “Sincronizar invoices desta assinatura”, “Vincular este cliente”.

`perPage` 10–50, default 20.

Sem as telas WP não menuadas (dashboard ops, settings de chave, toggles, logs, diagnóstico) no MVP. Webhooks na tela Billing podem listar `stripe_webhook_events` (read-only). Replay é P2.

## Rotas backend

### Não reutilizar as rotas do cliente para listar todos

Um JWT admin em `GET /subscriptions` só veria as assinaturas **da conta admin**.

### Criar

```
GET  /api/v1/admin/billing/subscriptions
GET  /api/v1/admin/billing/subscriptions/:subscriptionId
POST /api/v1/admin/billing/subscriptions/reconcile
POST /api/v1/admin/billing/subscriptions/backfill-links
POST /api/v1/admin/billing/subscriptions/:subscriptionId/sync-invoices
GET  /api/v1/admin/billing/invoices/:invoiceId/pdf
GET  /api/v1/admin/billing/subscriptions/:subscriptionId/shipping.csv

GET  /api/v1/admin/billing/metrics
GET  /api/v1/admin/billing/webhooks
```

Permissions: `billing.subscribers.read` / `billing.subscribers.sync`. PDF e CSV: `read`. Reconcile/backfill/sync-invoices: `sync`.

`:subscriptionId` aceita id interno **ou** `sub_…`.

Lista query: `page`, `perPage`, `status` (`active` default; valor especial `canceling` = predição do KPI), `market`, `q`.

Item:

```ts
{
  id: string
  providerSubscriptionId: string
  stripeCustomerId: string
  status: string
  cancelAtPeriodEnd: boolean
  autoRenew: boolean                  // !cancelAtPeriodEnd
  nextBillingAt: string | null
  planLabel: string | null
  stripePriceId: string | null
  termMonths: number | null
  user: { id: string; email: string }
  term: { marketCountry: string; months: number } | null
  createdAt: string
  updatedAt: string
}
```

Detalhe acrescenta snapshots (`pets`, `planSelection`, `shipping`, `address`), payment method, invoices (quando existirem).

Reconcile: job (fila ou sync no request, como o “run now” WP). Trigger `manual_admin_run_now`.

Backfill: body opcional `{ subscriptionId, limit }` (WP: limit 500 global, 1 no detalhe).

Sync invoices: Stripe API, até 20 invoices, upsert ledger. Exige id `sub_…`.

PDF: invoice id deve começar com `in_`. 302 para URL Stripe.

Webhooks lista: a partir de `stripe_webhook_events`. Envelope `{ total, page, perPage, items }`. O SPA espera `eventId`, `eventType`, `state`, `attempts`, `correlationId`, `processedAt`. Mapear o que existe (`event_id`, `type`, `processed_at`) e devolver `state: "processed"`, `attempts: 1`, `correlationId: null` até o schema rico existir — **não** inventar replay no MVP.

## Extensões de schema sugeridas

Para paridade de KPI/faturas:

- `plan_amount`, `plan_currency`, `plan_interval`, `plan_interval_count` em `stripe_subscriptions`
- `canceled_at`
- tabelas `stripe_invoices` e `stripe_invoice_shipping_items` (ou JSON no evento)

Sem isso, a tela mostra status/período/cliente/snapshots (já no ledger) e omite MRR/faturas/CSV de frete com empty explícito — não inventar números.

Webhook ingestão **já existe**; não reimplementar. Só falta leitura admin.

## O que não copiar

- Filtro `status=canceling` por igualdade SQL no campo `status`.
- Consulta Stripe na listagem.
- Expor actions de cliente no admin.
- CPT Flexible Subscriptions.
- Telas não menuadas (dashboard ops, settings de chave, toggles, logs) como se fossem MVP.
- UI de chaves Stripe (option AES com `AUTH_KEY`). Runtime = env.
- Placeholder “busca por fatura” que não busca.
