# Produto WooCommerce — customizacoes PawBowl

## Nome da funcionalidade

Configuracao de plano alimentar + sincronizacao Stripe no produto variavel.

Tela nativa: **Produtos → editar produto**.

Componentes:

1. Campos CMPB: pais do plano e duracao em dias (`CMPB_Product_Config`)
2. Metabox **Stripe sync** + badges nas variacoes (`ProductAdminUi`)
3. Guard de publicacao (`StripeSyncPublicationGuard`)

## Objetivo

1. Marcar em qual mercado (BR/US) o produto-plano vale e quantos dias o plano cobre — usado pelo motor de meal plan.
2. Garantir que cada variacao tenha Product/Price na Stripe antes de o catalogo ir a producao.

Atores: Colaborador e Admin com caps de produto (`edit_products` / `publish_products`). Sync REST exige `manage_woocommerce` ou `manage_options`.

## Pre-condicoes

- Tipo de produto **variavel** para o fluxo Stripe (o guard ignora nao-variavel).
- Campos CMPB aparecem na aba General de qualquer produto Woo (nao ha check de tipo no render). **[INFERENCIA]** na pratica os planos sao variable products.

---

## 1) Pais e duracao do plano (CMPB)

### Fluxo

Campos na aba **General**:

- Meal plan country: `'' | BR | US`
- Plan duration (days): number min 1

Ao salvar produto (`woocommerce_admin_process_product_object`):

- country normalizado para BR/US ou `''`
- days = `max(0, int)`; se 0, grava string vazia

Nao ha notice de validacao na UI se pais/dias vazios. A validacao explode **na API de meal plan** (`get_plan_config` → 422 `product_country_not_configured` / `product_days_not_configured`).

### Regras

**[REGRA CONFIRMADA]** Mapa pais → moeda:

- BR → BRL
- US → USD

**[REGRA CONFIRMADA]** `is_currency_allowed_for_country` exige match exato.

Classificacao: regra de negocio do catalogo. **Preservar.**

### Persistencia

Product meta:

- `_cmpb_plan_country`
- `_cmpb_plan_days`

### CRUD

Create/update via save do produto Woo. Delete = apagar produto. Sem ativar/desativar proprio.

---

## 2) Metabox Stripe sync

### Fluxo de consulta

```
Abre produto
  → ProductAdminUi::render_meta_box
  → exige edit_post
  → syncService->status() lista todas as variacoes de todos os produtos variaveis published/private
  → filtra as do product_id atual
  → requires_sync se algum status != 'synced' OU alguma variacao sem _stripe_product_id
```

Status por variacao (no servico `status()`, usado pela metabox):

| Condicao | Status |
|---|---|
| sem `_stripe_price_id` | `not_synced` |
| fingerprint preco/moeda/intervalo diferente | `price_mismatch` |
| senao | `synced` |

Se `requires`: botao **Sincronizar com Stripe** + mensagem vermelha (preco faltando vs precisa sincronizar).  
Se ok: "Produto vinculado ao Stripe (ou pronto)."

Lista por variacao: nome, product id Stripe, botao copiar, link dashboard, price id, price map JSON.

### Acao Sincronizar

JS `stripe-product-admin.js`:

```
POST {REST}/custom/v1/sync-stripe-products/{productId}
Header X-WP-Nonce (wp_rest)
body {}
```

Estados de UI:

- Botao "Sincronizando..." (disabled)
- created+updated > 0 → "Sincronizado com sucesso." + reload 900ms
- synced > 0 e nada criado/atualizado → "Sincronização completada (nenhuma criação/atualização necessária)."
- sucesso mas nenhum mapping → erro visual "Verifique se as variações têm preço definido."
- falha HTTP/JSON → "Erro ao sincronizar. Verifique logs."

Rate limit REST: 30 tentativas / 300s por produto (`sync_product_{id}`).

### O que o sync faz (negocio)

**[REGRA CONFIRMADA]** Para cada variacao com preco > 0:

1. Garante Stripe Product nome `{produto} - {variacao}` + metadata woo ids.
2. Para cada moeda coletada da variacao, cria/atualiza Price se o fingerprint `sha256(price|currency|interval)` mudou.
3. Intervalo default `month` se meta de billing interval ausente.
4. Persiste `_stripe_product_id`, `_stripe_price_id`, `_stripe_price_ids_by_currency`, fingerprints.

Variacao sem preco: skip.

### Bug/limitacao da badge na variacao **[REGRA CONFIRMADA]**

`render_variation_status` chama `get_variation_mapping()`, que **nao devolve `status`**. O codigo faz `$mapping['status'] ?? 'not_synced'`, entao o icone/texto de status na linha da variacao tende a ficar sempre "Não vinculado", mesmo com IDs Stripe visiveis abaixo.

Ha ainda `(int) $variation_data['variation_post_id'] ?? 0` (precedencia PHP), que provavelmente nao e o parent product id.

**Nao tratar o badge da variacao como fonte de verdade.** A metabox lateral e o `status()` sao a leitura correta.

Link "Abrir Stripe" da variacao usa `https://dashboard.stripe.com/products/{id}` **sem** `/test`. A lista de assinantes escolhe test/live pela secret. **[REGRA CONFIRMADA]** inconsistencia de interface.

---

## 3) Guard de publicacao

**[REGRA CONFIRMADA]** Ao transitar produto **variavel** de qualquer status → `publish` (exceto se ja era publish):

1. Se filtro `pawbowl_stripe_publish_guard_enabled` for false, nao faz nada (default true).
2. Tenta `sync_product` automaticamente.
3. Recalcula gaps (`get_product_sync_gaps`).
4. Se ainda ha variacoes sem prices Stripe nas moedas exigidas: **forca o produto de volta para `draft`** e mostra notice de erro no admin (transient 120s por user).

```
Usuario clica Publicar
  → WP grava publish
  → guard tenta sync
  → se mapping incompleto: post_status=draft + notice
```

Classificacao: regra de negocio de catalogo. **Preservar:** nao vender/publicar plano sem price Stripe.

Nao se aplica a produto simples. Nao se aplica a republicar ja publicado.

## Campos Stripe (metas de variacao)

- `_stripe_product_id`
- `_stripe_price_id`
- `_stripe_price_ids_by_currency` (mapa)
- `_stripe_price_fingerprint` / `_stripe_price_fingerprints_by_currency`
- `_stripe_synced_at` (via mapping)

## APIs / Endpoints

| Metodo | Rota | Permissao | Uso na UI |
|---|---|---|---|
| POST | `/wp-json/custom/v1/sync-stripe-products/{product_id}` | manage_woocommerce ou manage_options | botao metabox |
| POST | `/wp-json/custom/v1/sync-stripe-products` | idem | nao usado por esta UI |
| GET | `/wp-json/custom/v1/sync-stripe-products/status` | idem | nao usado por esta UI |
| GET | `/wp-json/custom/v1/sync-stripe-products/health` | idem | nao usado por esta UI |

Payload de sucesso esperado pelo JS: `{ success, data: { created_variants, updated_variants, synced_variants } }`.

Nonce: cookie WP + `X-WP-Nonce` `wp_rest`.

## Permissoes

- Ver metabox: `edit_post`
- Clicar sync: REST shop manager
- Guard notice: `edit_products`

CSRF: nonce REST.

## Dependencias

- WooCommerce produtos variaveis
- Stripe SDK + `STRIPE_SECRET_KEY` de **runtime** (env), nao as chaves da UI admin nao menuada
- Price Based on Country pode alimentar o mapa de precos por moeda **[INFERENCIA]** (`collect_variation_prices_by_currency`)

## Tratamento de erros

- Permissao metabox: "Permissão negada."
- Produto nao salvo / sem WC_Product: "Salve o produto..."
- Sem filhos: "Nenhuma variação encontrada."
- Publish revertido: notice listando variation id + moedas faltantes.

## Observacoes para migracao

- Catalogo: produto plano tem `market` (BR/US), `duration_days`, variacoes (sabor/peso/preco por moeda) e `stripe_price_id` por moeda.
- Publicar catalogo exige sync completo — regra a preservar.
- Admin de produto na nova stack: formulario proprio, nao a tela Woo.
- Nao copiar o bug do badge de variacao.
- Intervalo de billing default mensal se nao configurado.
