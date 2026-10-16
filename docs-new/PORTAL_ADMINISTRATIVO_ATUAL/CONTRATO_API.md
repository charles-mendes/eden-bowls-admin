# Contrato de API que o painel consome

Todas as URLs abaixo são relativas à base `/api/v1` (ou `VITE_ADMIN_API_BASE_URL`). Header comum nas rotas autenticadas: `Authorization: Bearer <accessToken>`.

Este documento descreve o **contrato assumido pelo front**. No backend atual (`eden-bowls-backend/src/app.js`) existem `GET /auth/me` e autenticação via `POST /auth/token`. Não há registro das rotas `/admin/*` nem `/billing/catalog/sync*`.

## Autenticação

### `POST /auth/login`

Body:

```json
{ "email": "admin@edenbowls.com", "password": "••••••••" }
```

Resposta esperada:

```ts
{ accessToken: string; user?: AdminUser }
```

Se `user` não vier, o front chama `/auth/me`.

Backend hoje: `POST /api/v1/auth/token` (não usado por este painel).

### `GET /auth/me`

Resposta esperada pelo admin:

```ts
{
  userId: string
  email: string
  roles: Array<'admin' | 'operator' | 'readonly' | 'customer'>
  permissions: string[]
}
```

O `GET /auth/me` do backend de loja devolve outro formato (perfil WP-like). O painel não adapta esse payload: ele atribui a resposta direto a `AdminUser`.

## Onboarding

### `GET /admin/onboarding/metrics`

Usado no dashboard e na listagem de sessões.

```ts
{
  totalSessions: number
  byStatus: Record<string, number>
  expiringIn24h: number
  generatedAt: string
}
```

### `GET /admin/onboarding/sessions`

Query: `page`, `perPage`, `status?`.

```ts
{
  total: number
  page: number
  perPage: number
  totalPages: number
  items: Array<{
    id: string
    status: string
    linkedUser?: { id: string; email: string } | null
    locale: string
    country: string
    state?: string | null
    expiresAt: string
    updatedAt: string
    _count?: { sessionPets: number; answers: number; recommendationRuns: number }
  }>
}
```

### `GET /admin/onboarding/sessions/:id`

```ts
{
  id: string
  status: string
  locale: string
  country: string
  expiresAt: string
  createdAt: string
  updatedAt: string
  linkedUser: { id: string; email: string; status: string } | null
  sessionPets: Array<{
    id: string
    sortOrder: number
    pet: {
      id: string
      name: string
      species: string
      weightKg: number | null
      activityLevel: string | null
      nutritionGoal: string | null
    }
  }>
  answers: Array<{ id: string; questionKey: string; answerJson: unknown; updatedAt: string }>
  recommendationRuns: Array<{
    id: string
    status: string
    createdAt: string
    petResults: unknown[]
    planSnapshots: unknown[]
  }>
  checkoutOrders: Array<{
    id: string
    createdAt: string
    orders: unknown[]
    subscriptions: unknown[]
  }>
}
```

## Catálogo

### `GET /admin/catalog/products`

Query: `search?`, `market?`, `page`, `perPage`.

```ts
{
  total: number
  page: number
  perPage: number
  items: Array<{
    id: string
    slug: string
    namePt: string
    nameEn: string
    active: boolean
    category: { namePt: string; nameEn: string }
    marketConfigs: Array<{ marketCountry: string; currency: string; active: boolean }>
    variants: Array<{ id: string; sku: string; variantPrices: Array<{ id: string }> }>
    createdAt: string
  }>
}
```

### `GET /admin/catalog/pricing`

Query: `market?`, `currency?`, `page`, `perPage`.

```ts
{
  total: number
  page: number
  perPage: number
  items: Array<{
    id: string
    variantId: string
    currency: string
    regularPrice: number
    salePrice: number | null
    saleFrom: string | null
    saleTo: string | null
    source: string
    createdAt: string
    product: { slug: string; namePt: string; nameEn: string }
  }>
}
```

`regularPrice` / `salePrice` entram em `formatCurrency` **sem** dividir por 100. Já `priceCents` de pedidos é dividido por 100. O painel trata as duas famílias como unidades diferentes.

## Billing / Stripe

Prefixos mistos: health/sync usam `/billing/...`; listagens usam `/admin/billing/...`.

### `GET /billing/catalog/sync/health`

Query: `market`, `currency`. Dashboard força `BR` + `BRL`. Billing usa os inputs da tela.

```ts
{
  market: string
  currency: string
  totalExpected: number
  totalMapped: number
  gaps: string[]
}
```

### `GET /billing/catalog/sync/status` (também `/admin/catalog/sync/status`)

Permissão `catalog.read`, filtrada pelo escopo de mercado: operator vê só os próprios mercados (`?market=` de fora → 403 `market_forbidden`), admin vê BR e US. A chamada é **opcional** na UI: falha → sem status, sem alerta.

Cada sync de catálogo grava uma linha por mercado em `catalog_sync_runs`, inclusive quando falha (`status: 'failed'` + `error`, até 500 caracteres). Retenção: as 50 execuções mais recentes por mercado; gravar a 51ª apaga a mais antiga do mesmo mercado.

```ts
type SyncRun = {
  syncJobId: string            // `sync_<id>`
  status: 'completed' | 'completed_with_skips' | 'failed'
  scope: 'market' | 'product'
  market: 'BR' | 'US'
  currency?: string
  productId?: string
  summary: { created: number; updated: number; skipped: Array<{ variationId: string; reason: string }> } | null
  error: string | null
  createdAt: string            // início
  updatedAt: string            // fim
}

// Topo = execução mais recente no escopo (formato que CatalogPricesSection lê); byMarket = a mais recente de cada mercado.
type SyncStatus = (SyncRun & { byMarket: Partial<Record<'BR' | 'US', SyncRun>> })
  | { status: null; byMarket: {} }
```

### `POST /billing/catalog/sync`

Body: `{ market, currency }`.

Resposta: `{ syncJobId: string; status: string }`.

### `POST /billing/catalog/sync/:productId`

Sem body. Mesma resposta `{ syncJobId, status }`.

### `GET /admin/billing/webhooks`

Query: `page`, `perPage`, `state?`.

Item:

```ts
{
  id: string
  eventId: string
  eventType: string
  state: string
  attempts: number
  correlationId: string | null
  createdAt: string
  processedAt: string | null
}
```

Envelope: `{ total, page, perPage, items }`.

### `GET /admin/billing/webhooks/health`

Só admin (permissão `system.health.read`). Sem token → 401; operator, readonly e nutritionist → 403. Sempre devolve as duas contas, sem filtro de mercado.

```ts
{
  generatedAt: string
  staleAfterHours: 72
  accounts: Array<{
    account: 'br' | 'us'
    status: 'ok' | 'attention' | 'no_events'
    lastEventAt: string | null   // created_at do evento mais novo (recebimento)
    lastEventType: string | null
    failedLast24h: number        // failed_at nas últimas 24 h
    pendingOverdue: number       // recebido há mais de 1 h, nem processado nem falho
  }>
}
```

Status: `no_events` sem nenhum evento; `attention` com `failedLast24h > 0`, `pendingOverdue > 0` ou o último evento com mais de 72 h; `ok` no resto. Eventos processados são apagados após 90 dias, então uma conta parada há mais tempo que isso volta a `no_events`.

### `GET /admin/markets/conflicts`

Só admin (`system.health.read`), mesmo 401/403 da rota acima, sem filtro de mercado. Query: `page` (1), `perPage` (20, máx. 100).

Um item por par cliente + conta Stripe em que o mercado do perfil (`hsr_market_country`) é `BR`/`US`, a assinatura está em `br`/`us` e os dois não batem. Várias assinaturas do mesmo cliente na mesma conta contam uma vez. É a mesma regra do `--dry-run` de `src/scripts/backfill-admin-markets.js`.

```ts
{
  total: number
  page: number
  perPage: number
  totalPages: number
  items: Array<{ userId: string; email: string; profileMarket: 'BR' | 'US'; stripeAccount: 'br' | 'us' }>
}
```

Ordem: e-mail, depois conta.

### `GET /admin/billing/subscriptions`

Query: `page`, `perPage`, `status?`, `market?`.

Item:

```ts
{
  id: string
  providerSubscriptionId: string
  status: string
  autoRenew: boolean
  nextBillingAt: string | null
  createdAt: string
  user: { id: string; email: string }
  term: { marketCountry: string; months: number }
}
```

Envelope: `{ total, page, perPage, items }`.

## Regras de negócio

### `GET /admin/config/business-rules`

Query: `domain?`, `key?`, `marketCountry?`, `active?` (`true`/`false` boolean na query string), `page`, `perPage`.

```ts
{
  total: number
  page: number
  perPage: number
  totalPages: number
  items: Array<{
    id: string
    domain: string
    key: string
    marketCountry: string
    active: boolean
    effectiveFrom: string
    effectiveTo: string | null
    valueJson: unknown
    createdAt: string
    updatedAt: string
  }>
}
```

### `PUT /admin/config/business-rules/:id`

Body:

```json
{ "valueJson": {}, "effectiveTo": null }
```

`effectiveTo` é ISO-8601 ou `null`. O front faz `JSON.parse` do textarea antes de enviar.

## Usuários

### `GET /admin/users`

Query: `skip`, `take` (não `page`/`perPage`).

```ts
{
  total: number
  skip: number
  take: number
  items: Array<{
    id: string
    email: string
    status: string
    createdAt: string
    profile: { fullName: string | null; phone: string | null } | null
  }>
}
```

## Pedidos

Status conhecidos no cliente: `new`, `confirmed`, `preparing`, `shipped`, `delivered`, `cancelled`.

### `GET /admin/orders`

Query: `page`, `perPage`, `status?`.

Item da lista:

```ts
{
  id: string
  status: string
  createdAt: string
  updatedAt: string
  user?: { id: string; email: string }
  checkoutOrder?: {
    items?: Array<{
      quantity: number
      priceCents?: number
      currency?: string
      product?: { namePt: string; slug: string }
    }>
    shippingSelection?: { methodName?: string; priceCents?: number; currency?: string }
  } | null
}
```

Envelope: `{ total, page, perPage, items }`.

### `GET /admin/orders/:orderId`

Acrescenta variante no item (`sku`, `flavorKey`, `weightLabel`) e:

```ts
statusHistory?: Array<{
  id: string
  fromStatus: string | null
  toStatus: string
  reason: string | null
  createdAt: string
}>
```

Preços desta tela: `priceCents / 100` antes de `formatCurrency`.

### `PATCH /admin/orders/:orderId/status`

Body:

```json
{ "toStatus": "preparing", "reason": "texto opcional" }
```

`reason` é omitido quando vazio.

## Padrão de erro no cliente

`apiRequest` **não** lê envelope `{ success, error }`. Só usa:

```ts
errorBody?.message ?? response.statusText
```

Se o backend responder `{ success: false, message: "..." }`, o alerta mostra `message`. Se só existir `error.message` (padrão de várias rotas Node atuais), o alerta cai no `statusText` HTTP.

## Inventário de mutações

| Método | Path | Tela |
|---|---|---|
| POST | `/auth/login` | Login |
| POST | `/billing/catalog/sync` | Billing |
| POST | `/billing/catalog/sync/:productId` | Billing |
| PUT | `/admin/config/business-rules/:id` | Regras |
| PATCH | `/admin/orders/:orderId/status` | Pedidos |

Todo o restante é GET.
