# Painel administrativo Eden Bowls

Documentação da **lógica atual** do SPA em `eden-bowls-admin`. O código vive em `src/`. Esta pasta descreve o que o painel faz hoje, não um desenho futuro.

| Documento | Conteúdo |
|---|---|
| [ARQUITETURA.md](./ARQUITETURA.md) | Stack, bootstrap, autenticação, rotas, menu, client HTTP |
| [TELAS.md](./TELAS.md) | Comportamento de cada página (filtros, dados, mutações) |
| [CONTRATO_API.md](./CONTRATO_API.md) | Endpoints, query params e bodies que o front chama |

## O que este painel é

SPA React + TypeScript + Vite para operação interna: onboarding, catálogo, billing Stripe, regras de negócio, usuários e pedidos.

Rodando localmente:

- Vite em `0.0.0.0:5174`
- Proxy de `/api` → `http://127.0.0.1:3000`
- Base da API: `VITE_ADMIN_API_BASE_URL` ou, se ausente, `/api/v1`

## O que este painel não é

- Não há testes (Vitest/Playwright) neste repositório.
- Não há criação/edição de produto ou preço na UI, apesar do copy das telas mencionar “atalhos para criação/edição”.
- `RequireAuth` só exige JWT. Papéis (`admin` / `operator` / `readonly`) filtram o **menu**, não as rotas.
- A maior parte das rotas `/admin/*` e `/billing/catalog/sync*` **não está registrada** no `eden-bowls-backend` atual (`src/app.js`). O painel já assume esse contrato no cliente.

## Mapa rápido das telas

| Rota | Página | Leitura | Mutação |
|---|---|---|---|
| `/login` | Login | — | `POST /auth/login` |
| `/dashboard` | Dashboard | métricas de onboarding + health/status de sync | — |
| `/onboarding/sessions` | Onboarding | lista + métricas | — |
| `/onboarding/sessions/:id` | Sessão 360 | detalhe da sessão | — |
| `/catalog/products` | Produtos | lista paginada | — |
| `/catalog/pricing` | Preços | lista paginada | — |
| `/billing` | Billing | health, status, webhooks, assinaturas | sync de catálogo (geral e por produto) |
| `/config/business-rules` | Regras | lista paginada | `PUT` de `valueJson` + `effectiveTo` |
| `/users` | Usuários | lista `skip`/`take` | — |
| `/orders` | Pedidos | lista paginada | `PATCH` de status |
| `/orders/:orderId` | Detalhe do pedido | detalhe + histórico | — |
| `*` | 404 | — | — |

`/` redireciona para `/dashboard`.
