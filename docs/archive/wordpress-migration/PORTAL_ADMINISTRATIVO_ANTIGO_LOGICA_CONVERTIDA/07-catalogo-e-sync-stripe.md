# Catálogo de planos e sync Stripe

## Origem WP

Tela nativa **Produtos → editar produto**:

1. Campos CMPB: país do plano e duração em dias (`_cmpb_plan_country`, `_cmpb_plan_days`).
2. Metabox **Stripe sync** + badges nas variações.
3. Guard de publicação (`StripeSyncPublicationGuard`).

REST WP: `POST /custom/v1/sync-stripe-products/{id}` (status/health existiam e **não** eram usados por esta UI). Rate limit 30 / 300s por produto.

## O que o backend já tem

```
GET /api/v1/products     // catálogo da loja, rate limit 120/300s por IP+UA, sem JWT
```

Persistência: `wp_posts` + `wp_postmeta` (migração `1700000000002`). Pricing da loja também usa `src/core/plan-catalog-pricing.js`.

**Não há** rotas admin de produto, preço, publish ou sync. O SPA chama `/admin/catalog/*` e `/billing/catalog/sync*` — contrato ainda não implementado. Telas: `ProductsPage.tsx` (lista), `PricingPage.tsx` (lista). Copy promete “atalhos para criação/edição” — **não existem**.

## Regras a preservar

1. Produto-plano tem **país BR|US** e **duração em dias > 0**. Sem isso a API de plano da loja rejeita (422 `product_country_not_configured` / `product_days_not_configured`). No WP a UI **não** validava no save — a explosão era na API. Na conversão, validar no PATCH admin **e** manter a 422 da loja.
2. BR → BRL. US → USD. Não misturar (`is_currency_allowed_for_country`).
3. Composição do plano viaja no checkout como snapshot; admin **mostra**, não edita o snapshot de um pedido.
4. Cada variação comercializável precisa de Price Stripe por moeda exigida. Sem mapping completo o produto **não publica**.
5. Publicar tenta sync automático; se faltar price → volta para rascunho (`active=false`) e lista gaps (`variationId + currencies`).
6. Sync: um Product Stripe por variação, nome `{produto} - {variação}`. Price novo se fingerprint `sha256(preco|moeda|intervalo)` mudou. Intervalo default `month`.
7. Variação sem preço: skip. Não gera Price.
8. Runtime das chaves = **env** (`STRIPE_SECRET_KEY`), não formulário admin.
9. Status por variação (fonte da verdade = `status()`, não o badge WP): `not_synced` / `price_mismatch` / `synced`. `requires_sync` se algum ≠ `synced` OU variação sem `_stripe_product_id`.

Não copiar o badge de variação que sempre mostrava “Não vinculado” (`$mapping['status'] ?? 'not_synced'` sem o campo `status`).

Não copiar o link Stripe da variação sempre em modo live. Usar test/live pela secret (`sk_test_` → `/test/products/{id}`), como a lista de assinantes.

Guard **não** se aplica a produto simples nem a republicar já publicado. No Node: só transição `active: false → true`.

## UI alvo

- `/catalog/products` — lista (já existe; ligar em API real).
- `/catalog/products/:id` — **criar**: país, dias, variações, mapping Stripe (product id, price id, mapa por moeda, fingerprint), botão sync, ativo/rascunho, notice de gaps.
- `/catalog/pricing` — lista de preços por mercado/moeda (read). Edição de preço no detalhe do produto.

Filtros lista: `search` (slug/nome pt/en), `market`, `page`, `perPage` (default 20).

Botão sync: estados “Sincronizando…”, sucesso com created/updated, “nenhuma criação necessária”, erro “variações sem preço”.

## Rotas backend

### Reutilizar com cuidado

`GET /api/v1/products` é público e no shape da **loja** (só ativos comercializáveis, rate limit agressivo). O admin pode consultá-lo para debug, mas a UI operacional deve usar rotas admin (paginação, inativos, metas Stripe).

### Criar

```
GET    /api/v1/admin/catalog/products
GET    /api/v1/admin/catalog/products/:productId
PATCH  /api/v1/admin/catalog/products/:productId
GET    /api/v1/admin/catalog/pricing

POST   /api/v1/admin/catalog/sync
POST   /api/v1/admin/catalog/sync/:productId
GET    /api/v1/admin/catalog/sync/health
GET    /api/v1/admin/catalog/sync/status
```

O SPA hoje usa prefixo `/billing/catalog/sync*`. **Unificar** em `/admin/catalog/sync*` **e** manter alias `/billing/catalog/sync*` apontando para o mesmo handler, para não quebrar o `BillingPage` enquanto a UI migra.

Permissions: `catalog.read` / `catalog.write` / `catalog.sync`.

#### PATCH produto

```json
{
  "planCountry": "BR",
  "planDays": 28,
  "active": false
}
```

`planCountry` normalizado para `BR`|`US` ou vazio. `planDays = max(0, int)`; 0 → vazio.

`active: true` dispara o **publish guard**: sync + gaps; se incompleto → 422 com lista `variationId + currencies` e o produto permanece inativo.

#### Sync

- Geral: body `{ "market": "BR", "currency": "BRL" }` (escopo do job).
- Por produto: sem body.
- Resposta (alinhar SPA + WP): `{ syncJobId, status, created_variants?, updated_variants?, synced_variants? }`.
- Rate limit por produto: 30 / 300s (paridade WP).

Health:

```ts
{
  market: string
  currency: string
  totalExpected: number
  totalMapped: number
  gaps: string[]
}
```

Status do job — **um único shape** (hoje Dashboard e Billing do SPA esperam dois):

```ts
{
  syncJobId: string
  status: string
  scope: string
  market?: string
  currency?: string
  productId?: string
  summary?: { scope: string; market?: string; currency?: string; productId?: string }
  createdAt: string
  updatedAt: string
}
```

Dashboard hoje força health `market=BR&currency=BRL`. Billing deixa escolher. Manter os dois; o default BR/BRL no dashboard é aceitável se o KPI deixar explícito o mercado.

#### Pricing lista

Query `market`, `currency`, `page`, `perPage`. Deixar claro se `regularPrice` é major units (o SPA **não** divide por 100 nesta tela; em pedidos divide `priceCents / 100`).

## Relação com BillingPage

Health + botões de sync no `/billing` podem permanecer como atalho, chamando as **mesmas** rotas de catálogo. Não duplicar jobs.

## O que não copiar

- Badge mentiroso na variação.
- Link Stripe da variação sempre em modo live.
- UI de chaves Stripe no produto.
- Dual write option admin vs env.
- Criar pedido/assinatura a partir do catálogo.
- Validação só na API da loja sem feedback no save admin (melhorar: validar no PATCH).
