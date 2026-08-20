# Inventário de rotas do backend para o portal

Base: `/api/v1` (exceto `POST /shipping/v1/calculate`, `GET /shipping/v1/settings` e `POST /stripe/v1/webhook`). Header admin: `Authorization: Bearer`. Toda rota `/admin/*` exige papel operacional + permission da ação.

Auditado contra `src/app.js` em **19 de agosto de 2026**.

Legenda: **existe** = registrado em `src/app.js` hoje. **adaptar** = existe mas o contrato/payload não serve ao admin. **criar** = não registrado.

## Auth

| Método | Path | Estado | Portal |
|---|---|---|---|
| POST | `/auth/token` | existe (`{ username, password }` → `{ token, user_email, … }`) | Login — SPA hoje chama `/auth/login` e espera `accessToken` |
| GET | `/auth/me` | existe (shape loja, sem roles) | adaptar **ou** criar `/admin/me` (recomendado) |
| POST | `/auth/login` | **não existe** | não criar; adaptar o SPA |
| POST | `/auth/logout` | existe (cookie loja + origin) | não usar; logout local |
| POST | `/auth/refresh` | existe | não usar no portal |
| POST | `/auth/register` + OTP | existe | não usar no portal |

## Nutrição e raças

| Método | Path | Estado | Portal |
|---|---|---|---|
| GET | `/breeds` | existe (`lang`, `search`, `limit` teto 500, default limit 10) | select de raças; passar `limit=500` |
| GET/POST | `/onboarding/recommendation` | existe (loja; com JWT persiste no user) | **não** usar |
| POST | `/admin/nutrition/simulate` | **criar** | simulador |

## Frete

| Método | Path | Estado | Portal |
|---|---|---|---|
| POST | `/shipping/v1/calculate` | existe (público) | encapsular no teste admin |
| GET | `/shipping/v1/settings` | existe (resumo público) | não basta para o form |
| POST | `/onboarding/shipping` | existe (JWT cliente) | não usar |
| GET/PUT | `/admin/shipping/settings` | **criar** | form BR/US |
| POST | `/admin/shipping/test` | **criar** | sandbox CEP |

## Onboarding 360 / checkout operacional

| Método | Path | Estado | Portal |
|---|---|---|---|
| GET | `/admin/onboarding/sessions*` | assumido pelo SPA; **não existe** | substituir por checkouts |
| GET | `/admin/onboarding/checkouts` | **criar** | lista 360 |
| GET | `/admin/onboarding/checkouts/:userId` | **criar** | detalhe 360 + “pedido” |
| GET | `/admin/onboarding/checkouts.csv` | **criar** | export |
| GET | `/admin/onboarding/metrics` | **criar** | dashboard + lista |
| \* | `/onboarding/pets*`, plan, zipcode, payment, checkout | existem (loja) | **não** usar no admin |

## Catálogo

| Método | Path | Estado | Portal |
|---|---|---|---|
| GET | `/products` | existe (loja, público, 120/300s) | não é a lista admin |
| GET | `/admin/catalog/products` | **criar** | lista |
| GET/PATCH | `/admin/catalog/products/:productId` | **criar** | detalhe / país / dias / publish |
| GET | `/admin/catalog/pricing` | **criar** | lista preços |
| POST | `/admin/catalog/sync` | **criar** | sync mercado |
| POST | `/admin/catalog/sync/:productId` | **criar** | sync um produto |
| GET | `/admin/catalog/sync/health` | **criar** | dashboard + billing |
| GET | `/admin/catalog/sync/status` | **criar** | job atual |

Alias obrigatório enquanto o SPA atual viver: `/billing/catalog/sync*` → mesmos handlers.

## Billing / ledger

| Método | Path | Estado | Portal |
|---|---|---|---|
| GET | `/subscriptions` | existe (`listMine`) | não listar todos |
| GET | `/subscriptions/:id/detail` | existe (owner) | não |
| POST | `/subscriptions/:id/actions` | existe (cliente) | **não** no admin |
| POST | `/subscriptions/:id/edit/*` | existe (cliente) | não |
| POST | `/stripe/v1/webhook` | existe | ingestão; não é UI |
| GET | `/admin/billing/subscriptions` | **criar** | grid |
| GET | `/admin/billing/subscriptions/:id` | **criar** | detalhe |
| GET | `/admin/billing/metrics` | **criar** | KPIs |
| POST | `/admin/billing/subscriptions/reconcile` | **criar** | sync agora |
| POST | `/admin/billing/subscriptions/backfill-links` | **criar** | vincular user |
| POST | `/admin/billing/subscriptions/:id/sync-invoices` | **criar** | faturas |
| GET | `/admin/billing/invoices/:id/pdf` | **criar** | redirect Stripe |
| GET | `/admin/billing/subscriptions/:id/shipping.csv` | **criar** | CSV frete (quando houver tabela) |
| GET | `/admin/billing/webhooks` | **criar** | tabela do BillingPage |

## Cupons 1ª compra

| Método | Path | Estado | Portal |
|---|---|---|---|
| — | `StripeCouponService` | existe (sem HTTP admin; sem `create` Stripe) | ligar rotas + método de criação |
| GET | `/onboarding/discount/eligibility` | existe (cliente) | não |
| GET | `/admin/stripe/first-purchase-promos` | **criar** | health + mapa |
| PUT | `/admin/stripe/first-purchase-promos` | **criar** | salvar slots |
| POST | `/admin/stripe/first-purchase-coupons` | **criar** | provisionar Stripe |
| GET | `/admin/stripe/promotion-codes` | **criar** | tabela recentes |

## Clientes

| Método | Path | Estado | Portal |
|---|---|---|---|
| GET/PUT/PATCH/DELETE | `/profile*` | **existe** (próprio JWT) — `registerProfileRoutes` no `app.js` | não operar terceiros |
| GET | `/admin/users` | **criar** | lista (`page`/`perPage`, `q`) |
| GET | `/admin/users/:userId` | **criar** | detalhe |
| PATCH | `/admin/users/:userId/delivery-instructions` | **criar** | textarea; reusa `ProfileService` parametrizado |

## Pedidos / status / regras genéricas (SPA atual)

| Método | Path | Estado | Decisão |
|---|---|---|---|
| GET | `/admin/orders` | não existe | **não criar no MVP** — alias da lista de checkouts |
| GET | `/admin/orders/:id` | não existe | alias do detalhe 360 |
| PATCH | `/admin/orders/:id/status` | não existe | só se produto pedir fulfillment |
| GET/PUT | `/admin/config/business-rules*` | não existe | não é tela WP; frete/cupom têm configs próprias |

## Middleware admin (criar)

`requireAdminPermission('onboarding.read')` depois do bearer:

1. Sem `currentUser` → 401.
2. Roles só `customer` ou vazias → 403.
3. Permission ausente → 403.
4. Conta bloqueada (`assertCriticalOperationAllowed`) → 403.
5. Envelope: `{ success: false, message }` para o `apiRequest` do SPA (`errorBody.message`). Erros de auth da loja usam `{ code, message, data }` — o client ainda lê `message`.

CORS: incluir origin do Vite (`5174`) e a origin de deploy do admin em `dependencies.corsOrigins`.

## Serviços Node a reusar (não duplicar)

| Domínio | Módulo |
|---|---|
| Nutrição | `core/nutrition-recommendation.js`, `simplified-consumption.js` |
| Raças | `BreedsService` |
| Frete | `ShippingService`, `core/shipping-fee.js`, `loadShippingSettings` |
| Cupom | `StripeCouponService`, `core/first-purchase-discount.js` |
| Ledger | `subscription-ledger.repository.js`, entidade `StripeSubscription` |
| Checkout state | `onboarding_user_state`, `onboarding_pets` |
| Perfil/endereço | `ProfileService.updateDelivery` (parametrizar `userId`) |
| Catálogo loja | `ProductsService` / repositories (estender para admin: inativos, metas Stripe) |
| Webhook | `StripeWebhookService` (só ingestão; já registrado) |
| Auth | `AuthService.authenticate` / `getCurrentUser` (estender roles à parte) |

## O que o portal **não** precisa expor

Rotas da loja: geo context, autocomplete, sales tax quote, payment methods, payment-intent ack, plan preview/snapshot/selection, register/OTP, avatar, delete account, subscription edit.

Guardrail WP “esconder Payments Woo”: no Node simplesmente **não criar** tela de gateway. Cobrança = Stripe env + webhook.

## Contagem

| Estado | Qtd aproximada |
|---|---|
| Existe e o portal reusa (auth token, breeds) | 2 |
| Existe mas **não** usar (loja: onboarding, profile, subscriptions do dono) | ~25 |
| Adaptar (auth/me) | 1 |
| **Criar** (`/admin/*` + aliases de sync) | ~30 |

O ponto importante: **os motores existem**. O gap é quase todo em rota HTTP admin + autorização, não em regra de negócio nova. Exceções que pedem código além da rota: papéis no usuário, save de shipping, `createFirstPurchaseCoupon`, sync catálogo + publish guard, reconcile/invoices/PDF, colunas de MRR, `ProfileService` com `userId` alvo.
