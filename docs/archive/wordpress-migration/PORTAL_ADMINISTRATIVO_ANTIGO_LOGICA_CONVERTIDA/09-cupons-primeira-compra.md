# Cupons de 1ª compra

## Origem WP

**Stripe → Cupons** (`pawbowl-stripe-coupons`). Stripe é fonte de verdade. O app só mapeia prazo → `promo_...`. Criar Coupon `duration=once` + Promotion Code `first_time_transaction=true`.

Mapa incompleto **bloqueia checkout de cliente elegível**. Inelegível segue sem desconto.

## O que o backend já tem

- Percentuais: `src/core/first-purchase-discount.js` — `TERM_PERCENT_MAP` 1→10%, 3→25%, 6→40%. `expectedPercentForTerm`, `isPromoId` (`promo_` + length > 6).
- Persistência: tabela `stripe_first_purchase_promos` + métrica de misconfig.
- Service: `src/services/stripe-coupon.service.js` — `getMapping`, `mappingHealth`, `saveMapping`, `resolveFirstPurchasePromotionForCheckout`, `incrementMisconfigMetric`. Overlay env nos três slots.
- Checkout da loja já resolve `promo_` quando elegível (`503 first_purchase_promo_not_configured` se slot vazio).
- Eligibility: `GET /api/v1/onboarding/discount/eligibility` (JWT do **cliente**).
- Doc de contrato: `eden-bowls-backend/docs-new/coupons/STRIPE_COUPONS_FIRST_PURCHASE.md`.

**Não há rota HTTP admin.** Não há `createFirstPurchaseCoupon` no service (não chama Stripe `coupons.create` / `promotionCodes.create`).

O SPA **não tem** tela `/billing/coupons`.

## Regras a preservar

| Termo (meses) | percent_off |
|---|---|
| 1 | 10 |
| 3 | 25 |
| 6 | 40 |

- Percentual **não é editável**. Create recusa `percent_off` diferente do mapa.
- Coupon: `duration=once`. Promotion Code: `restrictions.first_time_transaction=true`. Metadata `pawbowl_purpose=first_purchase`, `pawbowl_term_months`.
- Enunciado de produto (copiar na UI):

> Desconto de 1ª compra aplica-se somente à primeira fatura mensal. Nos planos de 3 e 6 meses, os meses seguintes cobram o preço cheio. O percentual maior (25%/40%) é benefício de compromisso, não desconto sobre o valor total do contrato.

- Mapa incompleto **bloqueia checkout de cliente elegível**. Inelegível segue sem desconto.
- IDs persistidos só `promo_...` (`saveMapping` já descarta o resto).
- Max redemptions 0 na Stripe = ilimitado lá; elegibilidade 1ª compra continua no backend (`OnboardingDiscountEligibilityService`).
- Contador de misconfig visível (`mappingHealth().misconfig_count` — incrementado no checkout quando o slot falta).
- Edit de assinatura **nunca** reaplica o cupom (já no stub `edit_no_first_purchase_promo`).
- O cliente **não** envia código. O front da loja nunca escolhe `promo_id`.
- Sem delete na UI (desativar no Dashboard Stripe).

## UI alvo

Rota React: `/billing/coupons` (**criar**). Menu: admin + operator (`billing.coupons.write`).

1. Notice da regra de 1ª compra (texto acima).
2. Se mapa incompleto: error listando slots faltando (`1m` / `3m` / `6m`) + aviso de checkout bloqueado para elegíveis.
3. Se `misconfig_count > 0`: warning com o número.
4. Form mapear os três slots (labels “1 mês(es) — 10%” etc.).
5. Form criar: prazo ∈ {1,3,6}, `code` obrigatório, `name` opcional (default `First purchase {n}m ({p}%)`), `max_redemptions` ≥ 0 (só envia à Stripe se > 0), checkbox `assign_first_purchase_slot` **marcado** por default.
6. Tabela dos 25 promotion codes mais recentes na Stripe: code, promo id, coupon, %, duration, ativo, slot se está no mapa, URL dashboard (test/live pela secret).

Redirect/notice após POST: `created` | `mapped` | erro Stripe.

## Rotas backend — criar

Registrar em `src/app.js` (já desenhadas na doc de cupons do backend):

```
GET  /api/v1/admin/stripe/first-purchase-promos
PUT  /api/v1/admin/stripe/first-purchase-promos
POST /api/v1/admin/stripe/first-purchase-coupons
GET  /api/v1/admin/stripe/promotion-codes
```

Permission: `billing.coupons.write` (GET também exige papel Stripe; `readonly` pode ter só GET se o produto quiser).

### GET map + health

Reusa `StripeCouponService.mappingHealth()`:

```json
{
  "complete": false,
  "missing_terms": [6],
  "mapping": { "1": "promo_a", "3": "promo_b", "6": null },
  "misconfig_count": 4
}
```

### PUT map

```json
{ "1": "promo_...", "3": "promo_...", "6": "promo_..." }
```

Service já sanitiza. Resposta: o health atualizado.

### POST criar

```json
{
  "term_months": 1,
  "code": "FIRST_1M",
  "name": "First purchase 1m (10%)",
  "max_redemptions": 0,
  "assign_first_purchase_slot": true
}
```

Implementar `StripeCouponService.createFirstPurchaseCoupon`:

1. Recusa termo ∉ {1,3,6} e percent divergente.
2. `coupons.create` + `promotionCodes.create` na Stripe.
3. Se `assign_first_purchase_slot`: `saveMapping` naquele prazo.

Code vazio → 400 `invalid_promotion_code`.

### GET promotion-codes

Lista recente (WP: 25). Erro de API Stripe vira mensagem no lugar da tabela, não 500 opaco.

## Rotas da loja que não usar no portal

- `GET /onboarding/discount/eligibility` — identidade do cliente.
- Body de checkout **não** recebe cupom.

Env overlay (`envMapping` no service) continua como fallback de runtime. O portal grava a **tabela**. Se env estiver setado e divergir do mapa, mostrar aviso — não silenciar.

## O que não copiar

- Motor de cupom Woo.
- Percentual editável.
- Tela admin como source of truth do valor cobrado (a Stripe cobra).
- Env dos três slots **em vez** da UI, se a operação precisa provisionar.
- Delete de coupon pela UI.
