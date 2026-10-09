# Stripe Cupons (1a compra)

## Nome da funcionalidade

Stripe → Cupons.

Slug: `pawbowl-stripe-coupons`.  
Codigo: `class-stripe-coupons-page.php` + `class-stripe-coupon-service.php`.

## Objetivo

A Stripe e a **fonte de verdade** das regras de desconto. Esta tela e um proxy operacional para:

1. Mapear Promotion Codes (`promo_...`) nos prazos de 1, 3 e 6 meses.
2. Criar na Stripe um Coupon `duration=once` + Promotion Code com `first_time_transaction=true`.
3. Listar promotion codes recentes.

Problema de negocio: o checkout de 1a compra aplica o promo automaticamente conforme o prazo escolhido; se o mapa estiver incompleto, **clientes elegiveis tem o checkout bloqueado**.

Atores: `access_pawbowl_stripe`.

## Pre-condicoes

- Stripe SDK + secret de runtime.
- Usuario autorizado.

## Fluxo principal

GET renderiza:

1. Notice informativa da regra de 1a compra (ver abaixo).
2. Se mapa incompleto: notice **error** listando slots faltando (`1m`, `3m`, `6m`) e aviso de checkout bloqueado.
3. Se contador de misconfig > 0: notice **warning** com o numero de falhas de checkout por promo nao mapeado.
4. Card mapeamento (form admin-post).
5. Card criar cupom (form admin-post).
6. Tabela dos 25 promotion codes mais recentes na Stripe.

Redirects apos POST: `coupon_notice=created|mapped` ou `coupon_error={mensagem}`.

## Regras de negocio (preservar)

### Percentual por prazo **[REGRA CONFIRMADA]**

| Termo (meses) | percent_off |
|---|---|
| 1 | 10 |
| 3 | 25 |
| 6 | 40 |

O percentual **nao e editavel** na UI. `create_first_purchase_coupon` recusa se `percent_off` != esperado.

### Duration e primeira fatura **[REGRA CONFIRMADA]**

- Coupon Stripe: `duration = once`
- Promotion Code: `restrictions.first_time_transaction = true`
- Metadata: `pawbowl_purpose=first_purchase`, `pawbowl_term_months`

Notice da tela (texto de produto):

> Desconto de 1ª compra aplica-se somente à primeira fatura mensal. Nos planos de 3 e 6 meses, os meses seguintes cobram o preço cheio. O percentual maior (25%/40%) é benefício de compromisso, não desconto sobre o valor total do contrato.

Classificacao: regra de negocio. **Preservar este enunciado** — o 25%/40% nao e um desconto sobre o contrato inteiro; e o desconto da primeira fatura, maior porque o cliente se comprometeu com 3/6 meses.

### Mapa incompleto bloqueia checkout **[REGRA CONFIRMADA]**

`mapping_health()`: slots 1, 3, 6 devem ter `promo_` gravado.  
Checkout (fora desta tela) incrementa `pawbowl_stripe_first_purchase_promo_misconfig_count` quando falha por mapa.

### Persistencia do mapa **[REGRA CONFIRMADA]**

Option `pawbowl_stripe_first_purchase_promos`: `{ "1": "promo_...", "3": "...", "6": "..." }`.  
IDs que nao comecam com `promo_` sao descartados no save.

### Max redemptions

0 = ilimitado **na Stripe**. A elegibilidade de 1a compra continua sendo decidida no backend WP/PawBowl. **[REGRA CONFIRMADA]** texto da UI.

## Validações

Criar:

- term_months ∈ {1,3,6}
- code obrigatorio (HTML `required` + backend; vazio → `invalid_promotion_code`)
- name opcional; default `First purchase {n}m ({p}%)`
- max_redemptions >= 0; so enviado a Stripe se > 0

Mapear: cada slot sanitizado; so persiste `promo_...`.

CSRF: nonces `pawbowl_stripe_coupons_create` / `pawbowl_stripe_coupons_map` via `admin-post.php`. Sem cap ou nonce: die "Não autorizado."

## Campos — mapeamento

| Slot | Label UI | Valor |
|---|---|---|
| 1 | 1 mês(es) — 10% | promo_... |
| 3 | 3 mês(es) — 25% | promo_... |
| 6 | 6 mês(es) — 40% | promo_... |

## Campos — criar

| Campo | Obrigatorio | Default |
|---|---|---|
| term_months | sim | primeiro option (1) |
| name | nao | gerado |
| code | sim | placeholder FIRST_1M |
| max_redemptions | nao | 0 |
| assign_first_purchase_slot | nao | checkbox **marcado** |

Se assign marcado, apos criar na Stripe grava o `promo_` no slot do prazo.

## Lista de promotion codes

Colunas: Código, Promo ID, Cupom, Desconto (%), Duration, Ativo, Slot (1m/3m/6m se o id esta no mapa), link Stripe.

Erro de API: mostra `get_error_message()` no lugar da tabela.

## CRUD

- Create: Coupon + Promotion Code na Stripe (+ opcional write no option).
- Read: mapa local + list Stripe.
- Update mapa: overwrite slots.
- Delete: **nao existe** nesta tela (desativar e no Dashboard Stripe).

## APIs

Nao REST. `admin-post.php?action=pawbowl_stripe_create_first_purchase_coupon` e `..._save_first_purchase_map`.

Servico chama Stripe `coupons.create` e `promotionCodes.create` / `promotionCodes.list`.

## Banco de dados

- `pawbowl_stripe_first_purchase_promos` (option)
- `pawbowl_stripe_first_purchase_promo_misconfig_count` (option, so leitura nesta tela)

Fonte de verdade do desconto: objetos Stripe.

## Integracoes

Stripe Coupons + Promotion Codes. Dashboard URLs vindas do servico (`dashboard_url` no item).

## Permissoes

`access_pawbowl_stripe`. Logged in.

## Dependencias

- `pawbowl-stripe-billing`
- Stripe runtime
- Checkout HSR que consome o mapa (ver `09-stripe-coupons-first-purchase.md` no backend)

## Tratamento de erros

Query `coupon_error` apos redirect. Falhas Stripe viram WP_Error (term invalido, percent divergente, SDK, create failed).

## Observacoes para migracao

- Nao reimplementar motor de cupom no app se a Stripe continuar como source of truth.
- Admin precisa: CRUD do **mapeamento prazo → promotion_code_id** + atalho de provisionamento com percentuais travados.
- Health check do mapa deve ser visivel (bloqueio de checkout e regra critica).
- Contador de misconfig e metrica operacional a preservar ou substituir por alerta.
