# Pedidos / checkout operacional

## Origem WP

Não era menu PawBowl. Customizações **somente leitura** na tela nativa Woo (**WooCommerce → Pedidos → editar pedido**):

1. Metabox **Onboarding Summary** (`OrderOnboardingMetabox`) — só registra se `manage_woocommerce` ou `manage_options`.
2. Linhas extras nos totais: “Desconto Stripe” e “Pago na Stripe”.
3. Resumo do plano alimentar no item (`_cmpb_meal_plan_summary`) + coluna Meal Plan.

Operador **não** mudava status por API PawBowl; usava o fluxo Woo nativo.

Empty state seguro: pedido sem `_hsr_onboarding_session_id` → “No onboarding data found for this order.” Não quebra pedidos comuns.

## Modelo Node

Não há `shop_order` / HPOS. O “pedido” operacional é:

```
onboarding_user_state.checkout_reference
  + stripe_subscriptions[] (ledger, 1 user → N subs)
  + snapshots (pets, plan_selection, shipping, address)
```

A tela `/orders` do SPA atual (`OrdersPage.tsx`) assume orders com status `new → confirmed → preparing → shipped → delivered` e `PATCH /admin/orders/:id/status`. Isso **não vem do wp-admin custom** e **não tem tabela** no backend.

## Conversão

Duas camadas:

### A) Paridade WP (obrigatória no MVP)

Detalhe read-only do checkout de onboarding — na prática o mesmo payload do [04-onboarding-360.md](./04-onboarding-360.md) detalhe, com ênfase nos blocos da metabox:

| Bloco WP | Fonte Node |
|---|---|
| Session and Customer | `userId` + email + `activation_status` (não há session_id) |
| Pets | `onboarding_pets` / ledger `pets_snapshot` |
| Recurrence | `onboarding_user_state.recurrence` |
| Products in Order | `plan_selection.catalog_pricing.line_items` |
| Stripe Subscription State | ledger: id, status, period end, `cancel_at_period_end` (**lista N**) |
| Stripe Discount / Cupom | `checkout_reference`: `stripe_promotion_code_id`, percent, amount, duration, `stripe_amount_paid`, `discount_eligibility.reason` |
| Plan Selection | `plan_selection` JSON |
| Zipcode/Address | `address` JSON |
| Checkout Payload | `checkout_reference` JSON |
| Meal plan summary | snapshot de períodos/sabor/peso se existir; senão omitir (o WP escondia o payload cru `_cmpb_meal_plan_payload`) |

Regras de desconto (paridade metabox):

```
hasDiscount = promoId != '' OR percent > 0 OR amount > 0
status visual = hasDiscount ? "Aplicado" : "Não aplicável / inelegível"
reason = discount_eligibility.reason
```

“Não aplicável” é ausência de metas persistidas, **não** recálculo live de elegibilidade.

Outras regras:

- JSON inválido → `{ _raw, _warning: "invalid_json" }`, não 500.
- Sem onboarding → empty “No onboarding data”, não erro.
- “Pago na Stripe” / “Desconto Stripe” = **exibição do persistido**, sem recalcular total.
- Link cupom: secret `sk_test_` → `https://dashboard.stripe.com/test/coupons/{id}`, senão live.
- Pet sem nome → “Unnamed pet”.
- Cliente sem nome e email → “Guest”.
- Período Stripe: unix/datetime formatado UTC; senão `-`.
- Não editar snapshot pelo admin.

Rotas (podem ser o mesmo detalhe 360):

```
GET /api/v1/admin/onboarding/checkouts/:userId
```

Se quiser URL “pedido”:

```
GET /api/v1/admin/checkouts/:userId
```

Enquanto o agregado for “um checkout_reference por user”, `userId` basta. Não inventar `orderId` Woo.

### B) Fulfillment de status (opcional, produto — **fora do MVP**)

O SPA já tem UI de transições. **Só implementar se operação pedir logística.** Não é paridade WP.

Se for feito:

- Nova entidade `fulfillment_orders` (ou status no ledger) com histórico.
- Máquina explícita; `cancelled` e `delivered` terminais.
- `PATCH` com `toStatus` + `reason` opcional.
- Permission `checkout.status.write`.
- **Não** inventar isso como se o WP já fizesse via plugin PawBowl.

Até lá: `/orders` no SPA vira **alias da lista 360** (checkouts), sem botão “Mudar status”. `/orders/:orderId` aponta para o detalhe por `userId`.

## Rotas da loja que **não** usar

| Rota | Motivo |
|---|---|
| `POST /onboarding/subscription/checkout` | cria cobrança do cliente |
| `GET /api/v1/subscriptions` | só as do JWT (`listMine`) |
| `POST /subscriptions/:id/actions` | pause/cancel do **cliente** |
| `POST /subscriptions/:id/edit/*` | troca de plano do cliente |

## Relação com o SPA atual

| Contrato SPA | Destino |
|---|---|
| `GET /admin/orders` | mapear para lista de checkouts (`GET /admin/onboarding/checkouts`) |
| `GET /admin/orders/:orderId` | detalhe checkout; `priceCents/100` só se a API mandar cents — o catálogo da loja usa major units em vários lugares |
| `PATCH /admin/orders/:orderId/status` | **não criar** no MVP da conversão |
| Select de status `new → confirmed → …` | remover da UI |

## O que não copiar

- Status Woo (`processing`, `wc-`).
- Recalcular totais Woo vs Stripe.
- Editar line item / meal plan.
- Mostrar JSON cru de `_cmpb_meal_plan_payload`.
- Coluna “Sessão” / `session_id`.
- Injetar Pedidos como top-level separado do 360 se for o mesmo dado — no WP era nativo Woo; no Node é a mesma consulta.
