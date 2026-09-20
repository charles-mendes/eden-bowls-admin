# Proposal

## Why

O painel trata Brasil e Estados Unidos como um único conjunto de registros. Operador e readonly com as mesmas permissões de hoje listam, filtram e abrem clientes, onboarding, billing e produção dos dois mercados; o dashboard e os cupons ainda assumem um país fixo. Com operação nos dois países, a UI vaza o mercado errado mesmo quando a API passar a recortar.

## What Changes

- A sessão (`GET /api/v1/admin/me`) passa a carregar `markets` e permissões `market.br` / `market.us`. Admin vê os dois; demais staff, um.
- Convite, edição de acesso e atribuição de papéis exigem o campo **Mercado** (`BR` ou `US`) quando o papel não é `admin`. Locks de último admin, self e allowlist permanecem.
- Pickers de mercado/conta/país (catálogo, billing, produção, cupons, feedbacks, privacy, frete, nutrição) ficam travados ao mercado da sessão. Filtro “todos” só para admin. Cupons deixam de defaultar `us`.
- Dashboard deixa o recorte BR/BRL hardcoded e usa o mercado da sessão (admin escolhe qual ver).
- Billing e produção mostram identidade do **snapshot do ledger**. Links **Cliente** e **Onboarding 360** só quando `customerProfileInScope`; senão texto sem link.
- Card de conflitos perfil vs Stripe, só para admin.
- **BREAKING** para staff já atribuído: a UI deixa de oferecer o outro mercado. Com a flag de backend ligada, sessão sem mercado recebe `403 market_required` nas listas.

## Capabilities

### New Capabilities

- `operations/admin-market-scope`: isolamento visual e de formulário por mercado no painel — sessão, convite/papéis, pickers, dashboard, card de conflitos e links Cliente/360.

### Modified Capabilities

- `operations/production-queue`: coluna Cliente usa snapshot do ledger (não `displayName` do WordPress); filtro de conta segue o mercado da sessão; link Onboarding 360 só se o perfil do `userId` estiver no mercado do staff.

## Impact

- **Admin (este repo):** `AuthContext` / fixtures / mocks; `UsersPage` e `RolesPage`; pickers em dashboard, catálogo, billing, produção, cupons, feedbacks, privacy, frete e nutrição; `SubscriptionDetailPage` e fila de produção; card de conflitos; Vitest `--related`; Playwright só specs tocadas (`admin-users`, `admin-billing`, `admin-production`, `admin-catalog`, `admin-feedbacks`, `admin-readonly` se a UI de mutação/filtro mudar).
- **Backend (`eden-bowls-backend`, change irmã `admin-market-scoping`):** contrato de `/admin/me`, `market` no convite/papéis, `customerProfileInScope`, 403 `market_forbidden` / `market_required`, e `GET /api/v1/admin/markets/conflicts` para o card. Sem esse contrato a UI não fecha o isolamento.
- **Visual:** mesmos `PageFrame`, `Section`, `Dialog`, `FiltersBar`, `MetricCard`, badges e `div.alert` do painel. Sem paleta, fonte ou copy da loja.
- **Fora de escopo:** loja `eden-bowls`; implementação SQL/JWT/migração neste repo; operador com os dois mercados; UI de auditoria; busca global.
