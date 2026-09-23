# Proposal

## Why

A página Assinantes (`/billing`) termina numa tabela “Webhooks Stripe” que só lista o inbox local (`event_id`, tipo, estado, data). Quase toda linha está `processed`, sem falha, payload, cliente ou ação. O QA perguntou se essa tela faz sentido; a resposta confirmada é que não faz sentido mostrá-la ao operador.

## What Changes

- Remover a seção Webhooks Stripe de `/billing`, junto com o estado e o fetch de `GET /admin/billing/webhooks`.
- Manter KPIs, sync de catálogo e a tabela de assinaturas.
- Atualizar a descrição da tela em `docs-new/PORTAL_ADMINISTRATIVO_ATUAL/TELAS.md` para não continuar descrevendo essa seção.
- Não alterar a loja (`eden-bowls`) nem o backend (`eden-bowls-backend`). A rota admin e a tabela `stripe_webhook_events` permanecem.

## Capabilities

### New Capabilities

- `operations/billing-subscribers`: A página Assinantes não exibe o inbox local de webhooks Stripe. Catálogo, métricas e assinaturas continuam na mesma tela.

### Modified Capabilities

- Nenhuma. `operations/admin-market-scope`, `operations/billing-coupons` e `operations/subscription-detail` não exigem essa tabela.

## Impact

- **Painel (`eden-bowls-admin`)**: `src/pages/BillingPage.tsx` e `docs-new/PORTAL_ADMINISTRATIVO_ATUAL/TELAS.md`. `Pager` e `Section` continuam nas outras seções. Testes de `BillingPage` e o e2e de billing não assertam a tabela. Os stubs de `/admin/billing/webhooks` podem ficar.
- **Loja (`eden-bowls`)**: sem impacto. Não há referência a `admin/billing/webhooks` nem à seção Webhooks Stripe.
- **Backend (`eden-bowls-backend`)**: sem impacto de código. `GET /api/v1/admin/billing/webhooks` e a ingestão `POST /stripe/v1/webhook` continuam. A UI simplesmente deixa de chamar a listagem.
