# Mapa de conversão: wp-admin → portal Node

## Menu legado vs portal alvo

| WP (menu real) | Portal React alvo | Arquivo SPA hoje | Estado no SPA | Backend |
|---|---|---|---|---|
| Login WP | `/login` | `LoginPage.tsx` | Existe; chama `POST /auth/login` | Adaptar para `POST /auth/token` + papéis |
| Dashboard nativo WP | `/dashboard` | `DashboardPage.tsx` | Existe; métricas de **sessão** + sync | Recriar KPIs no modelo `user_id` (não sessão WP) |
| Eden Bowl Nutrition | `/nutrition/simulate` | **não existe** | — | Reusar motor + `POST /admin/nutrition/simulate` |
| Onboarding 360 | `/onboarding/sessions` e `/:id` | `OnboardingPage.tsx`, `OnboardingSessionPage.tsx` | Existe; contrato de **sessão** | **Reorientar** para checkout/`user_id` (ver 04) |
| Frete | `/config/shipping` | **não existe** (há `BusinessRulesPage`) | — | Ler/gravar settings; teste reusa `ShippingService.calculate` |
| Produto Woo (país/dias/sync) | `/catalog/products` + `/catalog/products/:id` | `ProductsPage.tsx` (só lista) | Sem edição/sync | `GET /products` é catálogo da loja; admin precisa de CRUD + sync |
| Preços (não era tela WP própria) | `/catalog/pricing` | `PricingPage.tsx` | Só lista | Derivar de `variantPrices` / postmeta; mutação junto do produto |
| Pedido Woo (metabox) | `/orders` e `/:orderId` **ou** detalhe 360 | `OrdersPage.tsx`, `OrderDetailPage.tsx` | Lista + `PATCH` status | **Não há tabela de orders Node.** Ver 06 |
| Stripe → Assinantes | `/billing` + `/billing/subscriptions/:id` | `BillingPage.tsx` (parcial) | Health/sync/webhooks/subs resumidos | Ledger `stripe_subscriptions`; rotas cliente **não** listam todos |
| Stripe → Cupons | `/billing/coupons` | **não existe** | — | `StripeCouponService` existe; **sem rota HTTP** |
| Perfil WP → Delivery Instructions | `/users` e `/users/:id` | `UsersPage.tsx` (só lista) | `skip`/`take`, sem detalhe | `ProfileService` é do próprio JWT; admin precisa de get/patch por `userId` |
| (código sem menu) Dashboard/webhooks/logs Stripe | backlog `/billing/ops` | Billing já lista webhooks no contrato assumido | — | `POST /stripe/v1/webhook` alimenta; listagem admin ainda não existe |

Menu SPA atual (`src/lib/menu.ts`): Dashboard, Onboarding, Produtos, Preços, Billing, Regras de negócio, Usuários, Pedidos. **Não há** Simulador, Frete, Cupons, detalhe de produto, detalhe de assinante, detalhe de cliente. Papel `nutritionist` **não existe** no tipo `AdminRole`.

## O que o operador fazia no WP e o que o SPA já cobre

O SPA atual (`PORTAL_ADMINISTRATIVO_ATUAL`) é um **blueprint de contrato**, não paridade com o wp-admin:

- Chama `/admin/*` e `/billing/catalog/sync*` que **não estão** em `src/app.js`.
- Assume sessão de onboarding (`sessionPets`, `expiresAt`, `answers`, `recommendationRuns`) — modelo WP, não o Node.
- Inventou máquina de status de pedido (`new → confirmed → preparing…`) que **não existia** nas telas custom PawBowl (o WP usava status nativo Woo, e as customizações eram só leitura).
- Tem `readonly` no menu; o WP tinha **nutricionista**.
- Não tem simulador, frete, cupons nem instruções de entrega.
- `RequireAuth` só exige JWT. Papéis filtram o **menu**, não a rota.

A conversão abaixo é a especificação **alvo**. O SPA deve convergir para ela; o backend deve expor as rotas da coluna “criar/adaptar”.

## Atores

| WP | Portal / JWT | Escopo |
|---|---|---|
| `administrator` | `admin` | Tudo do operador + sync catálogo, cupons, reconciliação, config de frete |
| `eden_bowls_colaborador_*` | `operator` | Nutrição, 360, frete (leitura+write), catálogo, pedidos/checkout, ledger, cupons, clientes |
| `nutricionista` | `nutritionist` | Só simulador |
| — | `readonly` | GET only (inventado no SPA; o WP não tinha). Manter se o produto quiser |
| — | `customer` | **Não entra no portal.** JWT de loja não autoriza `/admin/*` |

Não criar dois operadores BR/US. Filtro de mercado nas listagens é query opcional (`market=BR|US`), não papel.

O papel `readonly` do SPA atual **não** é equivalente ao nutricionista. São papéis diferentes; não fundir.

## Fluxo de entrada

```
Portal /login
  → POST /api/v1/auth/token   { username, password }
  → GET  /api/v1/admin/me     { userId, email, roles, permissions }
  → se roles ∩ {admin, operator, nutritionist, readonly} vazio → 403 no portal
  → nutritionist → só /nutrition/simulate
  → demais → /dashboard
```

Não redirecionar a loja para o admin. CORS do backend precisa incluir a origin do Vite (`http://localhost:5174` e o host de deploy do admin).

Logout: apagar `eden-bowls-admin-token` no `localStorage`. **Não** chamar `POST /auth/logout` (essa rota exige cookie refresh + origin da loja).

## Persistência WP → Node

| WP | Node (hoje) |
|---|---|
| `hsr_shipping_settings` (option) | `data/shipping-settings.json` + env `SHIPPING_*` (`loadShippingSettings`) |
| `pawbowl_stripe_first_purchase_promos` | tabela `stripe_first_purchase_promos` + `StripeCouponService` |
| `wp_hsr_stripe_subscriptions` | `stripe_subscriptions` (ledger Node, chave `user_id`; 1 user → N subs) |
| `wp_hsr_onboarding_sessions` | **não existe.** Estado em `onboarding_user_state` (PK `user_id`) + `onboarding_pets` |
| Order meta `_hsr_*` | `onboarding_user_state.checkout_reference` + snapshots no ledger (`pets_snapshot`, `plan_selection`, `shipping`, `address`) |
| Product meta `_cmpb_*` / `_stripe_*` | `wp_postmeta` do catálogo (já usado por `GET /products`) |
| User meta `_eden_delivery_instructions` | `onboarding_user_state.address.delivery_instructions` (mesmo campo do app; `ProfileService.updateDelivery`) |
| `wp_hsr_breeds` | entidade `breed` + `GET /api/v1/breeds?lang=pt\|en&limit=500` |
| `wp_users` | mesma tabela; `AuthService` autentica contra ela |
| Roles WP / capabilities | **não existem no Node.** Planejar usermeta ou tabela `admin_users` |

## Menu alvo do SPA (depois da conversão)

| Item | href | Papéis |
|---|---|---|
| Dashboard | `/dashboard` | admin, operator, readonly |
| Simulador nutricional | `/nutrition/simulate` | admin, operator, nutritionist |
| Onboarding 360 | `/onboarding/sessions` | admin, operator, readonly |
| Frete | `/config/shipping` | admin, operator |
| Produtos | `/catalog/products` | admin, operator, readonly |
| Preços | `/catalog/pricing` | admin, operator, readonly |
| Assinantes | `/billing` | admin, operator, readonly |
| Cupons 1ª compra | `/billing/coupons` | admin, operator |
| Clientes | `/users` | admin, operator, readonly |
| Checkouts / pedidos | `/orders` (alias da lista 360) | admin, operator |

`nutritionist` só vê o simulador. `readonly` vê listagens, sem mutação. Remover ou decompor **Regras de negócio** (`/config/business-rules`) — não existia no WP; frete e cupom têm telas próprias.

## Guardrails WP que viram “não criar tela”

| WP | Intenção a preservar | Como no Node |
|---|---|---|
| Frontend WP bloqueado (`pawbowl-admin-only-mode`) | Headless | Não copiar; loja e admin são apps separados |
| Aba Payments Woo oculta | Cobrança = Stripe | Não criar tela de gateway |
| Flexible Subscriptions escondido para não-admin | Operação vive no ledger PawBowl | Não criar UI do CPT `fsb_subscription` |
| Roles nativos escondidos (shop_manager, author…) | Lista de papéis curta | Só `admin` / `operator` / `nutritionist` / `readonly` no seletor, se houver |
