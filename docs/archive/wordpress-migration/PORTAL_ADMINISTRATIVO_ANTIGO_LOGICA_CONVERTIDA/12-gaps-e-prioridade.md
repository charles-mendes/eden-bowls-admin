# Gaps e prioridade de implementação

Distância entre (1) wp-admin real, (2) SPA `eden-bowls-admin` atual, (3) `eden-bowls-backend` atual. Código conferido em **19 de agosto de 2026**.

## O SPA já tem tela, mas o contrato é o modelo WP/sessão

| Tela SPA | Arquivo | Problema | Alvo da conversão |
|---|---|---|---|
| Login | `LoginPage.tsx` | `POST /auth/login` + `accessToken`; backend é `/auth/token` + `token` + `{ username, password }` | Adaptar client; `GET /admin/me` com roles |
| Dashboard | `DashboardPage.tsx` | `totalSessions` / `expiringIn24h` | Métricas de checkouts + health de catálogo |
| Onboarding | `OnboardingPage.tsx`, `OnboardingSessionPage.tsx` | sessões, answers, recommendationRuns, expiresAt | `user_id` + `onboarding_user_state` + pets + N subs |
| Produtos / preços | `ProductsPage.tsx`, `PricingPage.tsx` | GET admin inexistente; sem edição | Lista real + detalhe país/dias/sync |
| Billing | `BillingPage.tsx` | sync/webhooks/subs admin inexistentes | Ledger + health; cupons e detalhe faltam na UI |
| Regras de negócio | `BusinessRulesPage.tsx` | genérico `valueJson` — **não existia no WP** | Não é paridade; decompor em Frete e Cupons |
| Usuários | `UsersPage.tsx` | lista skip/take, sem detalhe, sem busca | Lista `page`/`perPage` + instruções de entrega |
| Pedidos | `OrdersPage.tsx`, `OrderDetailPage.tsx` | máquina de status inventada | Read-only checkout; sem PATCH no MVP |

`RequireAuth` não valida papel. `nutritionist` não existe no tipo `AdminRole` nem no menu.

## Telas WP que o SPA ainda não tem

| WP | Portal a criar | Prioridade | Por que |
|---|---|---|---|
| Simulador nutricional | `/nutrition/simulate` | **P0** | Único uso do nutricionista; motor já existe |
| Frete | `/config/shipping` | **P0** | Checkout BR/US já depende do JSON/env |
| Cupons 1ª compra | `/billing/coupons` | **P0** | Mapa incompleto **bloqueia checkout** elegível |
| Detalhe de assinante | `/billing/subscriptions/:id` | **P0** | Lista Billing não abre a sub |
| Detalhe de produto + sync | `/catalog/products/:id` | **P0** | Guard de publish; sem isso o catálogo vai a produção sem Price |
| Detalhe de cliente + instruções | `/users/:id` | P1 | Mesmo campo do app |
| CSV 360 / CSV frete / PDF invoice | ações nas telas acima | P1 | Operação diária |
| Observabilidade webhook (código sem menu WP) | backlog | P2 | Não era tela operacional |

## Backend: o que já dá para ligar vs o que falta HTTP

**Ligar (service existe, falta rota admin ou ajuste de auth):**

- Motor nutricional + `GET /breeds`
- `ShippingService.calculate` / load de settings (write ainda não)
- `StripeCouponService` mapa/health/save (create Stripe ainda não)
- Ledger `stripe_subscriptions` (lista/detalhe básicos: status, período, snapshots, N por user)
- `onboarding_user_state` + `onboarding_pets` (360 read)
- `wp_users` (lista)
- Inbox `stripe_webhook_events` (read pobre: id, type, processed_at)
- `GET /products` (só referência; não substitui admin)
- `POST /auth/token` (login, com remap no client)
- `/profile*` do **próprio** user (não serve para terceiros)

**Falta implementar de verdade (além da rota):**

- Papéis no usuário + middleware `requireAdminPermission` + `GET /admin/me`
- Persistência write de shipping settings
- `createFirstPurchaseCoupon` (Stripe SDK create)
- Sync catálogo → Stripe Products/Prices + publish guard
- Job de reconciliação admin + sync invoices + PDF URL
- Colunas de MRR (`plan_amount` etc.) e tabelas de invoice/shipping
- Parametrizar `ProfileService.updateDelivery(userId, …)`
- CORS da origin do admin (5174)

## Ordem sugerida

1. **Auth admin** — `/admin/me`, middleware de permission, SPA login no `/auth/token`, incluir `nutritionist` no menu. Sem isso o resto é UI morta.
2. **Simulador** — P0 UX do nutricionista; reusa core; não persiste.
3. **Cupons** — P0 de negócio (mapa incompleto derruba checkout). Service ~80% pronto; falta create + HTTP.
4. **Frete settings + teste** — checkout BR/US já depende do JSON/env.
5. **360 checkouts read-only** — operação diária; reorientar Dashboard, sessões e pedidos para `user_id`. Listar N assinaturas.
6. **Ledger lista/detalhe** — sem pause/cancel. KPI de MRR só depois do schema.
7. **Catálogo + sync + guard** — para não publicar plano sem price.
8. **Clientes + delivery instructions** — depende de parametrizar `ProfileService`.
9. **Reconcile / invoices / CSV / PDF**.
10. **Backlog** webhook replay, business-rules genérico, fulfillment status.

## Decisões de produto explícitas (não inferir)

1. Isolar dados por mercado (BR vs US)? **Hoje não.** Só filtro opcional.
2. `readonly` vs `nutritionist`? São papéis diferentes; não fundir.
3. PATCH de status de pedido? **Não** na paridade WP. Só se logística pedir.
4. NEM do gato no simulador? Usar default do motor (**3800**), não o 3600 do wp-admin.
5. UI de chaves Stripe? **Não.** Env/runtime.
6. Expor pause/cancel no admin? **Não**, permanece na API do cliente.
7. Um checkout = uma assinatura? **Não.** Ledger é N por `user_id`.
8. Alias `/auth/login` no backend? **Não** necessário; adaptar o SPA.

## Relação com as outras pastas

| Pasta | Quando atualizar |
|---|---|
| `docs/` | engenharia reversa WP — só se o legado mudar |
| `docs-new/PORTAL_ADMINISTRATIVO_ATUAL/` | o **código do SPA hoje**; atualizar quando o front convergir |
| Esta pasta | o **alvo convertido**; atualizar o que ainda falta |
| `docs-new/AJUSTES_QUE_CLAUDE_LEVANTOU/ROADMAP_PAINEL_ADMINISTRATIVO.md` | visão única de telas; deriva desta pasta |

Correção em relação a docs mais antigas do backend: `/api/v1/profile*` **já está registrado** no `app.js`. O bloqueio da tela de cliente não é mais “profile 404”; é “service sem `userId` alvo”.
