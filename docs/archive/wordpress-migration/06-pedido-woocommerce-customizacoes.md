# Pedido WooCommerce — customizacoes PawBowl

## Nome da funcionalidade

Painel operacional dentro da tela nativa de pedido WooCommerce.

Nao e um menu novo. Aparece em **WooCommerce → Pedidos → editar pedido**.

Componentes:

1. Metabox **Onboarding Summary** (`OrderOnboardingMetabox`)
2. Linhas extras nos totais: Desconto Stripe e Pago na Stripe
3. Resumo do plano alimentar no item (`CMPB_Admin_Order_Display` + coluna Meal Plan do `CMPB_Cart_Handler`)

## Objetivo

Permitir que operacao, ao abrir um pedido, veja o snapshot de onboarding, o estado Stripe gravado no pedido, o desconto de 1a compra e a composicao do meal plan — sem ir ao banco/JSON cru.

Atores: quem pode editar pedidos (`edit_shop_orders` / `manage_woocommerce`). A metabox de onboarding so e registrada se o usuario atual tem `manage_woocommerce` ou `manage_options`.

## Pre-condicoes

- Pedido existe no Woo (CPT `shop_order` ou HPOS).
- Para o bloco onboarding: meta `_hsr_onboarding_session_id` nao vazio.
- Para o meal plan: order item meta `_cmpb_meal_plan_summary`.

## 1) Metabox Onboarding Summary

### Fluxo

1. Usuario abre o pedido.
2. Se nao conseguir resolver `WC_Order`: "Unable to load order data."
3. Se session id vazio: "No onboarding data found for this order." (empty state seguro — **[REGRA CONFIRMADA]** nao quebra pedidos comuns).
4. Caso contrario renderiza secoes.

Somente leitura. Nenhuma acao POST.

### Secoes e origem dos dados

| Secao | Dados |
|---|---|
| Session and Customer | `_hsr_onboarding_session_id`; nome+email billing; status Woo |
| Pets | JSON `_hsr_onboarding_pets`: name, type, breed, age, weight |
| Recurrence | JSON `_hsr_onboarding_recurrence` como tabela chave/valor |
| Products in Order | line items Woo (nome × qty + total) |
| Stripe Subscription State | `_hsr_stripe_subscription_id/status/current_period_end/last_webhook_event/last_webhook_at` |
| Stripe Discount / Cupom | promotion code, coupon id, %, valor, duration, amount paid, eligibility reason |
| Plan Selection (details) | JSON `_hsr_onboarding_plan_selection` |
| Zipcode/Address Snapshot | JSON `_hsr_onboarding_zipcode` |
| Checkout Payload | JSON `_hsr_checkout_payload` |

JSON invalido: objeto `{_raw, _warning: invalid_json}`. **[REGRA CONFIRMADA]**

### Regras de desconto na metabox

```
promoId = _hsr_stripe_promotion_code_id
percent = _hsr_stripe_discount_percent; se <= 0, fallback _hsr_discount_applied_percent
amount = _hsr_stripe_discount_amount
hasDiscount = promoId != '' OR percent > 0 OR amount > 0
status visual = hasDiscount ? "Aplicado" : "Não aplicável / inelegível"
reason = _hsr_discount_eligibility.reason (JSON)
```

**[REGRA CONFIRMADA]** "Nao aplicavel" e so ausencia de metas de desconto, nao uma recaixa da regra de elegibilidade em tempo real.

Link "Abrir na Stripe" do coupon:

- Se `STRIPE_SECRET_KEY` env comeca com `sk_test_` → `https://dashboard.stripe.com/test/coupons/{id}`
- Senao → `https://dashboard.stripe.com/coupons/{id}`

Classificacao: Integracao / regra de interface.

Periodo Stripe: unix > 0 formatado `Y-m-d H:i:s UTC`; senao `-`.

Cliente sem nome e email: label "Guest".

Pet sem nome: "Unnamed pet".

## 2) Totais do pedido (desconto e pago)

Hooks:

- `woocommerce_admin_order_totals_after_discount` → linha "Desconto Stripe (X%)" ou "Desconto Stripe" com valor negativo, se amount>0 ou percent>0.
- `woocommerce_admin_order_totals_after_tax` → linha "Pago na Stripe" se `_hsr_stripe_amount_paid` > 0.

**[REGRA CONFIRMADA]** Nao recalcula totais Woo; so **exibe** metas. O total nativo do pedido Woo pode divergir do valor Stripe.

Classificacao: regra de interface + persistencia. Preservar a visao "o que a Stripe cobrou vs o que o pedido Woo mostra".

## 3) Meal plan no item

### Coluna "Meal Plan"

Hooks `woocommerce_admin_order_item_headers` / `_values`: coluna extra com `nl2br` do summary, ou `–`.

### Bloco "Resumo do plano alimentar"

Apos item meta, se `_cmpb_meal_plan_summary` existe:

- Linhas que comecam com `total:` (case insensitive) vao para o rodape em negrito.
- Demais linhas viram lista.

Metas internas **escondidas** da UI nativa de item meta (`woocommerce_hidden_order_itemmeta`):

- `_cmpb_meal_plan_payload`
- `_cmpb_meal_plan_summary`
- `_cmpb_meal_plan_total`
- `_cmpb_meal_plan_currency`
- `_cmpb_cart_item_key`

**[REGRA CONFIRMADA]** regra de interface: o operador ve o resumo formatado, nao o JSON.

O summary e gravado na criacao do item (checkout/cart), formato:

```
{start}-{end} {flavor} {weight} ({days} dias): {currency} {subtotal}
...
total: {currency} {total}
```

Nao ha edicao do plano pelo admin.

## CRUD

Nenhum. Consulta apenas.

## APIs

Nenhuma chamada HTTP disparada por estas UIs. Links externos para Stripe Dashboard.

## Banco de dados

Order meta HSR (alem das listadas acima):

- `_hsr_stripe_coupon_id`
- `_hsr_stripe_discount_percent`
- `_hsr_stripe_discount_amount`
- `_hsr_stripe_discount_duration`
- `_hsr_stripe_amount_paid`
- `_hsr_discount_applied_percent`
- `_hsr_discount_eligibility` (JSON)

Order item meta CMPB listados acima.

## Permissoes

Metabox onboarding: so registra se `manage_woocommerce` ou `manage_options`.  
Meal plan: qualquer tela de pedido Woo que dispare os hooks (tipicamente quem edita pedidos).

## Dependencias

- WooCommerce admin order UI (legado CPT ou HPOS — o codigo resolve `WC_Order` a partir de post ou order object).
- Checkout HSR e CMPB terem gravado as metas.

## Tratamento de erros

Empty states textuais. Sem notices de sucesso (nao ha mutacao).

## Observacoes para migracao

- Tela de detalhe de Pedido na nova stack deve agregar: snapshot onboarding + line items + ledger Stripe (desconto, pago, sub status) + composicao do plano.
- Nao permitir editar o snapshot pelo admin ate existir fluxo de correcao (hoje nao existe).
- Manter empty state para pedidos que nao vieram do onboarding.
