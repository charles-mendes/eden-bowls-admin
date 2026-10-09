# Onboarding 360

## Nome da funcionalidade

Onboarding 360.

Menu: **Eden Bowl Nutrition → Onboarding 360** (`admin.php?page=hsr-onboarding-360`).

Codigo: `headless-secure-registration/src/class-onboarding360-admin-page.php`

## Objetivo

Dar visao operacional **somente leitura** dos pedidos originados do checkout de onboarding, ligando cliente, pets, recomendacao simplificada, recorrencia, produtos e estado Stripe persistido no pedido.

Problema de negocio: suporte/operacao precisa achar um pedido de onboarding por cliente, sessao ou assinatura Stripe sem abrir pedido a pedido.

Atores: Colaborador e Administrador (`manage_woocommerce` ou `manage_options`). Nutricionista **nao** ve esta tela.

## Pre-condicoes

- Pedido WooCommerce com meta `_hsr_onboarding_session_id` (gravado no checkout por `CheckoutService`).
- WooCommerce ativo.

A tela **nao cria nem altera** pedido, sessao ou Stripe.

## Fluxo principal

1. Usuario abre Onboarding 360.
2. Sistema lista pedidos com `_hsr_onboarding_session_id EXISTS`, mais recentes primeiro, 20 por pagina.
3. Cards resumem totais da **pagina atual** (exceto "Pedidos encontrados", que e o total filtrado).
4. Usuario pode filtrar, paginar, abrir detalhe ou exportar CSV.

## Fluxos alternativos

### Detalhe

GET com `detail_order_id={id}` renderiza pagina de detalhe. Se o pedido nao existe: notice de erro + botao voltar (preserva filtros).

### Export CSV

GET com `export=csv` + nonce `hsr_onboarding360_export`.

- Revalida permissao e nonce; senão die "Solicitacao de exportacao invalida."
- Usa scan limitado a `MAX_FILTER_SCAN = 500` linhas.
- Download `onboarding-360-export-YYYYMMDD-HHMMSS.csv`.
- **Nao inclui** coluna de recomendacao simplificada.

### Filtros "profundos"

Se qualquer um destes estiver preenchido, a listagem **abandona paginacao SQL** e faz scan das ate 500 ordens mais recentes (ainda respeitando data/status SQL), filtra em PHP e pagina o resultado em memoria:

- customer (nome/email contains)
- frequency (weekly|biweekly|monthly)
- query (order id, session id, stripe sub id, customer)
- stripe_status
- stripe_link (linked|unlinked)

**[REGRA CONFIRMADA]** pedidos mais antigos que o 500o do recorte simplesmente nao aparecem nesses filtros.

### Empty state

"Nenhum pedido de onboarding encontrado para os filtros selecionados."

## Acoes disponiveis

| Acao | Efeito |
|---|---|
| Filtrar | GET, recarrega lista |
| Limpar | volta para a pagina sem query args |
| Exportar CSV | download, mesma pagina nao muda |
| Ver detalhes | GET detalhe |
| Pedido | abre edicao WooCommerce em nova aba |
| Clique no cliente (se e-mail bate com WP user) | abre `user-edit.php` |

Nao ha criar/editar/excluir/ativar.

## Regras de negocio

### O que e um "pedido de onboarding"

**[REGRA CONFIRMADA]** `shop_order` com meta key `_hsr_onboarding_session_id` existente (mesmo valor vazio passaria no EXISTS; na pratica o checkout grava o id).

### Recorrencia exibida

Lida de `_hsr_onboarding_recurrence` JSON, campo `frequency`. Valores de filtro: `weekly`, `biweekly`, `monthly`.

**[REGRA CONFIRMADA]** Nao e o intervalo vivo da Stripe. E o snapshot do onboarding.

### Vinculo Stripe

- linked: `_hsr_stripe_subscription_id` nao vazio
- unlinked: vazio
- status Stripe: igualdade exata com `_hsr_stripe_subscription_status`

Valores de filtro de status Stripe: `active`, `trialing`, `past_due`, `canceled`, `incomplete`, `incomplete_expired`, `unpaid`, `paused`.

### Recomendacao simplificada

Para cada linha, o admin chama `OnboardingService::get_recommendation($sessionId)` e pega `recommendation['simplified']`.

```
session_id do pedido
  → OnboardingService::get_recommendation
  → se WP_Error: celula "Sem dados simplificados"
  → senao exibe por pet: daily / monthly / packs (strings ja formatadas)
```

**[REGRA CONFIRMADA]** Ha cache in-request por session_id e cache de JSON decodificado.

**[INFERENCIA]** Se a sessao ja expirou/sumiu da tabela `hsr_onboarding_sessions`, a celula fica vazia mesmo com pedido valido.

Deduplicacao visual: pets com mesmo nome+daily+monthly+packs sao omitidos.

### Cards de resumo

**[REGRA CONFIRMADA]** "Vinculados ao Stripe", "Ativos no Stripe" e "Com simplificado" sao contados **apenas nas linhas da pagina atual**, nao no universo filtrado. "Pedidos encontrados" usa o total da query/scan.

Classificacao: regra de interface (potencialmente enganosa). Nao copiar o card "ativos" como KPI global sem recalcular.

## Validacoes

- `per_page` limitado a 20, 50 ou 100; default 20; teto 100.
- Datas `from`/`to` montam `date_created` Woo no formato `from...to` (ou aberto de um lado).
- Status de pedido: valor sem prefixo `wc-` (o select normaliza `wc-processing` → `processing`).
- Export exige nonce.

## Campos da lista

| Coluna | Origem |
|---|---|
| Pedido | order id |
| Data | date_created i18n `Y-m-d H:i` |
| Cliente | billing name + email |
| Recomendacao simplificada | sessao onboarding |
| Assinatura Stripe | `_hsr_stripe_subscription_id` ou "Nao vinculado" |
| Status Stripe | meta ou "Desconhecido" |
| Total | `wc_price` |
| Status | label Woo |
| Sessao | `_hsr_onboarding_session_id` |
| Acoes | detalhe + pedido |

## Campos do detalhe

Secao Resumo: cliente, pedido (link), data, status, total, sessao.  
Secao Stripe: sub id, status, fim de periodo (unix UTC), ultimo evento, ultimo webhook em.  
Tabela simplificada: pet, daily, monthly, packs.  
Produtos: line items nome × qty.  
Bloco tecnico recolhido: JSON simplified, pets, recurrence, package, menu.

Nao mostra checkout payload nem zipcode nesta pagina (isso esta no metabox do pedido).

## APIs / Endpoints

Nenhum REST. Tudo GET admin. CSV via mesmo GET.

Leitura interna: `wc_get_orders` + `OnboardingService::get_recommendation`.

## Banco de dados

Pedidos (`wp_posts` / HPOS) + order meta:

- `_hsr_onboarding_session_id`
- `_hsr_onboarding_pets`
- `_hsr_onboarding_recurrence`
- `_hsr_onboarding_package_selection`
- `_hsr_onboarding_menu_selection`
- `_hsr_stripe_subscription_id`
- `_hsr_stripe_subscription_status`
- `_hsr_stripe_current_period_end`
- `_hsr_stripe_last_webhook_event`
- `_hsr_stripe_last_webhook_at`

Sessao (para simplified): `wp_hsr_onboarding_sessions`, `wp_hsr_onboarding_pets`.

JSON invalido vira `{_warning: invalid_json, _raw}`.

## Integracoes

Indireta: estado Stripe e o **ultimo valor gravado no pedido** por webhook/API, nao uma consulta live a Stripe nesta tela.

## Permissoes

`manage_woocommerce` ou `manage_options`. Nonce so no export.

## Dependencias

- WooCommerce
- HSR onboarding persistido
- Menu pai `hsr-nutrition-simulator` (se o pai nao existir, o submenu some — regra WP)

## Tratamento de erros

| Situacao | Comportamento |
|---|---|
| Sem permissao | wp_die |
| Pedido detalhe inexistente | notice + voltar |
| Export sem nonce | wp_die |
| Sessao sem recomendacao | texto "Sem dados simplificados" |
| JSON quebrado | objeto warning no detalhe tecnico |

Sem spinner; submit HTML.

## Estados

- Lista vazia
- Lista paginada
- Lista em modo scan (filtros profundos, teto 500)
- Detalhe
- CSV download

## Observacoes para migracao

- Esta e uma **consulta operacional** sobre o agregado Checkout + Snapshot onboarding + Stripe runtime no pedido.
- Na nova stack: view/read model `OnboardingOrder` com filtros server-side de verdade (sem teto 500 silencioso, ou teto explicito na UI).
- KPI cards devem ser agregados no conjunto filtrado, nao na pagina.
- Nao precisa de acoes de escrita ate o produto pedir (hoje e 100% read-only).
- Recorrencia da lista ≠ billing interval Stripe; rotular isso na UI nova.
