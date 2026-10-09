# Roadmap de telas — Painel Administrativo Eden Bowl

Documento consolidado a partir de três fontes:

1. `PORTAL_ADMINISTRATIVO_ATUAL` — o que o SPA React (`eden-bowls-admin`) faz **hoje**.
2. `PORTAL_ADMINISTRATIVO_ANTIGO_LOGICA_CONVERTIDA` — auditoria interna já existente, convertendo a lógica do wp-admin antigo (PawBowl) para o modelo Node atual.
3. Documentação da lógica atual do back-end (`eden-bowls-backend`) — usada aqui para confirmar o que realmente está implementado, o que é stub e o que não existe.

Objetivo: dar ao time uma visão única de **quais telas faltam**, **quais existem mas estão com contrato quebrado**, e **em que ordem atacar**.

---

## 1. Diagnóstico geral

O SPA atual é, na prática, um **blueprint de contrato** — não uma paridade funcional com o wp-admin antigo. Ele foi construído assumindo rotas `/admin/*` e `/billing/catalog/sync*` que **não estão registradas** no backend (`src/app.js`), e modela dados como se ainda existisse sessão de onboarding (`sessionPets`, `expiresAt`) e pedidos com máquina de status própria — nenhum dos dois existe no banco Node atual.

O modelo real do backend é:

```
Identidade  → JWT (user_id), não session_id
Onboarding  → onboarding_user_state + onboarding_pets (por user_id)
Checkout    → onboarding_user_state.checkout_reference
Assinatura  → ledger stripe_subscriptions (alimentado por webhook)
Catálogo    → wp_posts / wp_postmeta (produto-plano com país + dias)
```

Qualquer tela nova (ou correção de tela existente) precisa ser desenhada em cima **desse** modelo, não do modelo WordPress/sessão que o SPA atual pressupõe.

---

## 2. Telas que faltam por completo

Não existem no SPA hoje. Ordenadas por prioridade conforme a auditoria interna (`12-gaps-e-prioridade.md`).

| # | Tela | Rota React | Prioridade | Por que importa |
|---|---|---|---|---|
| 1 | Simulador nutricional | `/nutrition/simulate` | **P0** | Único uso do papel *nutricionista*. Motor de cálculo já existe no core (`nutrition-recommendation.js`), só falta expor via rota admin dedicada, sem persistir nada. |
| 2 | Configuração de frete | `/config/shipping` | **P0** | Hoje só existe a tela genérica `business-rules`, que **não é isso**. Precisa de abas BR (regra por km + CD + piso/teto) e US (taxa fixa), mais um sandbox de teste de CEP. |
| 3 | Cupons de 1ª compra | `/billing/coupons` | **P0** | Mapa incompleto (slots 1/3/6 meses) **bloqueia checkout** de cliente elegível. É o gap com maior impacto direto em receita. |
| 4 | Detalhe de assinante | `/billing/subscriptions/:id` | **P0** | A tela `/billing` atual só lista; falta abrir uma assinatura, ver período, cupom aplicado, faturas e disparar sync. |
| 5 | Detalhe de produto + sync Stripe | `/catalog/products/:id` | **P0** | Não existe criação/edição real hoje, apesar do copy da tela prometer "atalhos para criação/edição". Falta país, dias, variações, mapeamento de preço por moeda e o guard que impede publicar plano sem price mapeado. |
| 6 | Detalhe de cliente + instruções de entrega | `/users/:id` | P1 | Lista existe, mas não dá para abrir um cliente, ver endereço ou editar a instrução de entrega (mesmo campo que o app do cliente usa). |
| 7 | Exportação CSV (360, frete) e link de PDF de fatura | ações dentro das telas acima | P1 | Não são telas novas, mas ações que faltam nas telas de onboarding/ledger. |
| 8 | Observabilidade de webhook Stripe (retry, payload) | backlog | P2 | Nem existia como menu no wp-admin antigo — não é paridade, é módulo novo se o produto pedir. |

---

## 3. Telas que existem, mas com contrato quebrado

O SPA já tem a rota e a UI, mas chama endpoints que não existem no backend, ou modela dados de um sistema que não existe mais. Não é "criar do zero" — é **reescrever o contrato**.

| Tela | Rota | Problema | Correção necessária |
|---|---|---|---|
| Login | `/login` | `POST /auth/login` não existe; o backend expõe `POST /api/v1/auth/token` | Adaptar o client para `/auth/token`, ou criar um alias fino no backend |
| Dashboard | `/dashboard` | KPIs de "sessão" (`totalSessions`, `expiringIn24h`) — não existe TTL de sessão no Node | Trocar para métricas de checkout: `totalCheckouts`, `linkedToStripe`, `stripeActive`, `withSimplified` |
| Onboarding | `/onboarding/sessions` e `/:id` | Espera `sessionPets`, `answers`, `recommendationRuns` — tabelas que não existem | Reorientar para `user_id` + `onboarding_user_state` + pets + ledger (ver seção 4) |
| Produtos / Preços | `/catalog/products`, `/catalog/pricing` | `GET /admin/catalog/*` não está registrado; zero edição | Criar as rotas admin reais; mover edição para o detalhe do produto (item 5 da seção 2) |
| Billing | `/billing` | `sync`, `webhooks`, `subscriptions` via `/admin/billing/*` não existem no backend | Criar as rotas; considerar alias `/billing/catalog/sync*` → mesmo handler de `/admin/catalog/sync*`, para não quebrar a tela |
| **Regras de negócio** | `/config/business-rules` | Essa tela **não existia no wp-admin**. É um `valueJson` genérico inventado | Não é paridade — decompor em telas próprias: Frete (item 2) e Cupons (item 3). Manter `business-rules` só se o produto tiver outras políticas de verdade (ex.: `price-zone-policy`) |
| Usuários | `/users` | Pagina com `skip`/`take` — todo o resto do admin usa `page`/`perPage` | Padronizar em `page`/`perPage`; adicionar busca por e-mail (existia no WP, falta no SPA) |
| Pedidos | `/orders`, `/:orderId` | Inventa uma máquina de status (`new → confirmed → preparing → shipped → delivered`) com `PATCH` de status — **não existe tabela `orders`** no backend, e essa máquina nunca existiu nem no wp-admin (que usava status nativo do Woo, só leitura) | Virar alias **read-only** da lista de checkouts (item "Onboarding 360"); só implementar mutação de status se a operação de logística pedir explicitamente — não é requisito de paridade |

---

## 4. Mudança de modelo mais crítica: "sessão" → "checkout por usuário"

Vale destacar porque afeta três telas ao mesmo tempo (Dashboard, Onboarding, Pedidos): o SPA atual foi desenhado em cima do modelo WordPress (`hsr_onboarding_sessions`, com `session_id` e `expiresAt`). Esse modelo **não existe** no Node.

A unidade operacional correta é:

```
CheckoutOnboarding = um user_id que tem checkout_reference
                      (+ linha no ledger stripe_subscriptions, se houver)
```

Um mesmo usuário pode ter **mais de uma assinatura Stripe** — o modelo de negócio é uma assinatura por pet, não uma por checkout (confirmado por um bug reportado no back-end: a segunda tentativa de assinatura para um segundo pet falhou porque o fluxo ainda assume 1:1). Isso precisa ser levado em conta no desenho da tela de detalhe do onboarding/ledger: ela deve listar **N assinaturas por usuário**, não assumir uma só.

---

## 5. Rotas de API que faltam no backend, por domínio

Consolidado do inventário de rotas (`11-inventario-rotas-backend.md`) cruzado com o estado real confirmado no segundo zip. "Criar" = não registrado em `src/app.js` hoje.

### Autenticação / papéis
- `GET /api/v1/admin/me` — shape com `roles` + `permissions` (recomendado manter `/auth/me` da loja intacto)
- Middleware `requireAdminPermission(permission)` — 401 sem usuário, 403 sem papel operacional, 403 sem a permission da ação

### Nutrição
- `POST /api/v1/admin/nutrition/simulate` — reusa `NutritionRecommendationService`, sem persistir

### Frete
- `GET/PUT /api/v1/admin/shipping/settings` — form completo (o público `GET /shipping/v1/settings` é resumido demais)
- `POST /api/v1/admin/shipping/test` — sandbox de CEP sem o rate limit da rota pública

### Onboarding 360
- `GET /api/v1/admin/onboarding/checkouts`
- `GET /api/v1/admin/onboarding/checkouts/:userId`
- `GET /api/v1/admin/onboarding/checkouts.csv`
- `GET /api/v1/admin/onboarding/metrics`

### Catálogo
- `GET /api/v1/admin/catalog/products`
- `GET/PATCH /api/v1/admin/catalog/products/:productId`
- `GET /api/v1/admin/catalog/pricing`
- `POST /api/v1/admin/catalog/sync` (geral) e `/:productId` (unitário)
- `GET /api/v1/admin/catalog/sync/health` e `/status`

### Billing / ledger
- `GET /api/v1/admin/billing/subscriptions` e `/:id`
- `GET /api/v1/admin/billing/metrics`
- `POST /api/v1/admin/billing/subscriptions/reconcile`
- `POST /api/v1/admin/billing/subscriptions/backfill-links`
- `POST /api/v1/admin/billing/subscriptions/:id/sync-invoices`
- `GET /api/v1/admin/billing/invoices/:id/pdf` (redirect 302 para a URL da Stripe)
- `GET /api/v1/admin/billing/webhooks`

### Cupons de 1ª compra
- `GET /api/v1/admin/stripe/first-purchase-promos` — mapa + health
- `PUT /api/v1/admin/stripe/first-purchase-promos` — salvar slots
- `POST /api/v1/admin/stripe/first-purchase-coupons` — criar na Stripe (o `StripeCouponService` hoje só mapeia/lê; falta o método de criação)
- `GET /api/v1/admin/stripe/promotion-codes`

### Clientes
- `GET /api/v1/admin/users` e `/:userId` (padronizar `page`/`perPage`)
- `PATCH /api/v1/admin/users/:userId/delivery-instructions` — reusa `ProfileService`, mas **parametrizado por `userId` alvo** (hoje o service só opera no `currentUser.id`)

> Achado do cruzamento com o segundo zip: todas as rotas `/api/v1/profile*` (personal, delivery, email, senha, avatar, delete) ainda retornam **404** no backend atual — o `ProfileService` existe, mas não está exposto nem parametrizável por usuário-alvo. Isso é pré-requisito direto da tela de detalhe do cliente.

---

## 6. Serviços do backend que já existem e podem ser reaproveitados (não reescrever)

| Domínio | Módulo |
|---|---|
| Nutrição | `core/nutrition-recommendation.js`, `simplified-consumption.js` |
| Raças | `BreedsService` (`GET /api/v1/breeds`) |
| Frete | `ShippingService`, `core/shipping-fee.js`, `loadShippingSettings` |
| Cupom | `StripeCouponService`, `core/first-purchase-discount.js` |
| Ledger | `subscription-ledger.repository.js` |
| Checkout state | `onboarding_user_state`, `onboarding_pets` |
| Webhook | `StripeWebhookService` (já alimenta o ledger via `POST /stripe/v1/webhook`, que **já existe**) |
| Catálogo loja | repositories de produto (precisam ser estendidos para admin: paginação, inativos, metas Stripe) |

O ponto importante: **os motores existem**. O gap é quase todo em **rota HTTP admin + autorização**, não em regra de negócio nova.

---

## 7. Decisões de produto já tomadas (não reabrir sem necessidade)

Direto da auditoria interna — evita retrabalho e discussão duplicada:

1. **Sem isolamento BR/US por papel.** Mercado é filtro opcional na listagem, não define quem acessa o quê.
2. **`readonly` e `nutritionist` são papéis diferentes**, não devem ser fundidos.
3. **Sem PATCH de status de pedido no MVP.** Não existia paridade no wp-admin; só entra se a logística pedir de verdade.
4. **NEM do simulador usa o default do motor** (3800 gato / 3600 cão) — não replicar o bug do wp-admin antigo, que forçava 3600 também para gato.
5. **Sem UI de chaves Stripe no admin.** Continua em variável de ambiente / runtime.
6. **Sem pausar/cancelar assinatura pelo admin.** Isso permanece na API do próprio cliente (`/api/v1/subscriptions/:id/actions`).

---

## 8. Ordem de implementação sugerida

1. **Auth admin** (`/admin/me` + middleware de permission + SPA apontando para `/auth/token`) — sem isso, qualquer tela nova é UI morta.
2. **Simulador nutricional** — reusa motor pronto, maior retorno por esforço.
3. **Cupons de 1ª compra** — maior risco de negócio (mapa incompleto bloqueia checkout).
4. **Frete** (settings + teste) — checkout BR/US já depende disso hoje via JSON/env.
5. **Onboarding 360 read-only** — reorientar Dashboard e a listagem de "sessões" para o modelo checkout/`user_id`.
6. **Ledger de assinantes** (lista + detalhe, sem pause/cancel).
7. **Catálogo + sync + guard de publish.**
8. **Clientes + instruções de entrega** — depende de parametrizar `ProfileService`.
9. **Reconciliação / faturas / CSV / PDF.**
10. **Backlog:** replay de webhook, generalização de `business-rules` (se surgir outra política de verdade), fulfillment de pedido.

---

## 9. Resumo executivo (para quem só vai ler esta seção)

- O painel atual **parece pronto, mas é um blueprint**: quase toda tela chama uma rota que não existe no backend.
- Faltam **6 telas inteiras**: Simulador nutricional, Frete, Cupons de 1ª compra, Detalhe de assinante, Detalhe de produto e Detalhe de cliente.
- **3 são bloqueio de receita/operação real** (Cupons, Frete, Detalhe de produto/sync) — priorizar aí.
- A tela "Regras de negócio" é um artefato inventado, sem equivalente no sistema antigo — decompor em Frete e Cupons.
- A tela "Pedidos" assume uma tabela e uma máquina de status que **não existem** — deve virar leitura da lista de checkout, não CRUD de status.
- O maior risco técnico escondido não está na UI: é o **`ProfileService` não aceitar `userId` alvo** e as rotas `/profile*` ainda devolverem 404 — isso trava a tela de cliente antes mesmo dela existir.
