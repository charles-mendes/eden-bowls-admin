# Lógica do wp-admin convertida para o portal Node

Conversão funcional das telas PawBowl do WordPress (`docs/`) para o SPA `eden-bowls-admin` e para o backend `eden-bowls-backend`.

Não copia WordPress, WooCommerce, nonces, options nem capabilities. Preserva regras de negócio confirmadas no código legado e as encaixa no modelo Node atual: **JWT + `user_id`**, ledger `stripe_subscriptions`, `onboarding_user_state` + `onboarding_pets`, catálogo em `wp_posts` / `wp_postmeta`.

Auditado contra o código em **19 de agosto de 2026**.

## Como ler

Cada tela antiga vira:

1. **Equivalente no portal** — rota React existente ou a criar.
2. **Motor no backend** — service/core que já existe.
3. **Rota HTTP** — reutilizar, adaptar ou criar em `/api/v1/admin/*`.
4. **O que não copiar** — bugs, WP-only, backlog.

Fontes:

| Pasta | Papel |
|---|---|
| `docs/` | engenharia reversa do wp-admin (WordPress) |
| `docs-new/PORTAL_ADMINISTRATIVO_ATUAL/` | o que o SPA faz **hoje** |
| `eden-bowls-backend/src/` + `docs-new/` | rotas e persistência Node |

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| [01-mapa-conversao.md](./01-mapa-conversao.md) | Menu WP → telas do portal → rotas |
| [02-identidade-permissoes-e-auth.md](./02-identidade-permissoes-e-auth.md) | Papéis, login, `/auth/me` vs `/admin/me` |
| [03-simulador-nutricional.md](./03-simulador-nutricional.md) | Eden Bowl Nutrition |
| [04-onboarding-360.md](./04-onboarding-360.md) | Consulta operacional de checkout |
| [05-frete.md](./05-frete.md) | Config BR/US + teste de CEP |
| [06-pedidos-e-checkout.md](./06-pedidos-e-checkout.md) | Snapshot onboarding + meal plan + Stripe |
| [07-catalogo-e-sync-stripe.md](./07-catalogo-e-sync-stripe.md) | País, dias, variações, publish guard |
| [08-assinantes-ledger.md](./08-assinantes-ledger.md) | Lista/detalhe/KPI do ledger |
| [09-cupons-primeira-compra.md](./09-cupons-primeira-compra.md) | Mapa 1/3/6 meses |
| [10-clientes-e-instrucoes.md](./10-clientes-e-instrucoes.md) | Usuários + delivery instructions |
| [11-inventario-rotas-backend.md](./11-inventario-rotas-backend.md) | Inventário: existe / adaptar / criar |
| [12-gaps-e-prioridade.md](./12-gaps-e-prioridade.md) | Distância SPA atual × WP × backend |

## Princípios da conversão

1. **Painel e loja são apps distintos.** O redirect “admin-only” do WP não se copia. A loja (`eden-bowls`) e o portal (`eden-bowls-admin`) compartilham o mesmo JWT emitido por `POST /api/v1/auth/token`, mas só papéis operacionais entram no portal.
2. **Toda mutação revalida papel no servidor.** O menu do SPA não autoriza.
3. **Não inventar isolamento BR/US.** Os dois colaboradores WP tinham as mesmas caps. Mercado é filtro opcional (`market=BR|US`).
4. **Não pausar/cancelar assinatura pelo admin.** Isso continua na API do cliente (`POST /api/v1/subscriptions/:id/actions`).
5. **Onboarding 360 deixa de ser “pedido Woo + session_id”.** No Node a chave é `user_id` + `checkout_reference` + ledger Stripe. Um usuário pode ter **N assinaturas**.
6. **Reusar motores já portados.** Nutrição, frete, cupom e recommendation não devem ser reescritos na UI.
7. **Rotas da loja não servem para operar terceiros.** `/profile*`, `/onboarding/*` e `/subscriptions` leem `request.currentUser.id`. JWT de admin nessas rotas opera a **conta do admin**, não a do cliente.

## Estado atual (resumo)

O SPA é um **blueprint de contrato**. Quase toda tela chama `/admin/*` ou `/billing/catalog/sync*` que **não está registrada** em `src/app.js`. O backend já tem os motores (nutrição, frete, cupom, ledger, checkout state, perfil). O gap é rota HTTP admin + autorização +, em alguns casos, schema extra (MRR, invoices).

`/api/v1/profile*` **já está registrado** no `app.js`. O que falta para o portal de clientes é parametrizar o `ProfileService` por `userId` alvo.

## MVP do portal (paridade com o que o operador usa hoje no WP)

1. Login com papéis `admin` / `operator` / `nutritionist`.
2. Simulador nutricional (sem persistência).
3. Consulta Onboarding 360 (lista, detalhe, CSV).
4. Configuração de frete BR/US + teste de CEP.
5. Catálogo de planos (país, dias, variações, sync Stripe, bloqueio de publish incompleto).
6. Detalhe operacional de checkout (ex-metabox de pedido Woo).
7. Ledger de assinantes (KPI, lista, detalhe, faturas, sync) — sem pause/cancel.
8. Mapeamento/provisionamento de cupons de 1ª compra.
9. Edição de instruções de entrega no cliente.

Fora do MVP: observabilidade de webhook (código WP sem menu), diagnóstico Stripe, UI de chaves, CRUD genérico `business-rules`, máquina de status de pedido.
