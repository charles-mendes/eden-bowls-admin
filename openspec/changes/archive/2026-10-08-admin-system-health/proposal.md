# Proposal

## Why

A seção **Saúde do sistema** do Dashboard (só para admin) mostra "Route not found" em **Conflitos de mercado**. O painel chama `GET /api/v1/admin/markets/conflicts`, mas o backend nunca criou essa rota. A contagem existe só no `--dry-run` de `src/scripts/backfill-admin-markets.js`. Os mocks do Vitest e do Playwright simulam a rota, então nenhum teste pegou a falta. A seção também não diz nada sobre o webhook Stripe, que é o que o admin quer validar. Ela ainda mostra quatro métricas de funil de checkout que não indicam saúde nenhuma.

## What Changes

- **Backend**: cria `GET /api/v1/admin/markets/conflicts`, só para admin. A rota é paginada e devolve as linhas (`userId`, `email`, `profileMarket`, `stripeAccount`) e o `total`. A query sai do script de backfill para um módulo compartilhado, e script e rota passam a usar a mesma lógica.
- **Backend**: cria `GET /api/v1/admin/billing/webhooks/health`, só para admin. Para cada conta Stripe (`br`, `us`) devolve o último evento recebido (horário e tipo), as falhas nas últimas 24h e um status derivado: `ok`, `attention` ou `no_events`.
- **Backend**: cria a permissão `system.health.read`, dada só ao papel `admin`. Operator e readonly recebem 403.
- **Painel**: a seção Saúde do sistema perde os 4 cards de checkout (Checkouts, Vinculados Stripe, Stripe ativos, Com simplificado). Ganha um indicador de webhook por conta BR/US. O card de conflitos passa a usar a rota real e mostra as linhas, com paginação. Preços Stripe no catálogo e a restrição `hasRole('admin')` continuam como estão.
- **Painel**: os mocks do Vitest e do Playwright passam a usar o formato real dessas respostas.
- **Prevenção**: o backend gera um manifesto versionado das rotas `/api/v1`. O painel guarda uma cópia desse manifesto, e um teste do Vitest falha se o painel chamar, ou um mock simular, uma rota que não está no manifesto.
- **Backend**: o resultado de cada sync de catálogo, com sucesso ou com falha (incluindo a mensagem de erro), passa a ser gravado em `catalog_sync_runs`, com uma linha por mercado. A retenção é de 50 execuções por mercado. `GET /admin/catalog/sync/status` passa a ler do banco, filtrado pelo escopo de mercado: operator vê o próprio mercado e admin vê os dois. A seção mostra a última execução por mercado.
- **Backend**: um teste de remoção falha quando uma rota some de `docs/api-routes.json` em relação a `origin/main` sem estar registrada em `docs/api-routes-removed.json`.
- **Contagem de conflitos**: só a contagem muda (pares cliente + conta). O modo apply do backfill não muda. Ele nunca corrigiu conflitos: preenche apenas mercado vazio e não toca em `stripe_subscriptions`.

## Capabilities

### New Capabilities

- `operations/system-health`: o que a seção Saúde do sistema do Dashboard mostra, a quem mostra, e o contrato de `GET /admin/billing/webhooks/health`, incluindo as regras do status `ok` / `attention` / `no_events`.
- `delivery/api-route-contract`: toda rota `/api/v1` que o painel chama, ou que os mocks simulam, precisa existir no manifesto de rotas do backend.

### Modified Capabilities

- `operations/catalog-products`: o status da última sincronização passa a ser persistido, filtrado por mercado e registra falhas.
- `operations/admin-market-scope`: o requisito "Admin conflict card lists profile vs Stripe mismatches" passa a definir o contrato da rota (permissão só de admin, 401/403, formato paginado, uma linha por par usuário + conta, e a mesma regra do script de backfill). Ele também passa a exigir que o card mostre as linhas, e não só a contagem.

## Impact

- **Backend (`eden-bowls-backend`)**: `src/core/admin-roles.js` (nova permissão); `src/api/routes/admin.routes.js` (duas rotas); um novo módulo de consultas para conflitos de mercado, usado por `src/scripts/backfill-admin-markets.js`; `stripe-webhook-events.repository.js` (agregado por conta); wiring em `src/index.js`/config; um script e um arquivo de manifesto de rotas; testes de integração com MySQL (`tests/integration/`, porta 3310) e testes de rota. Uma migration aditiva (`catalog_sync_runs`). Webhooks não precisam de migration, porque `stripe_webhook_events` já tem `created_at`, `failed_at` e `type`. O checkout do CI do backend passa a usar `fetch-depth: 0` para o teste de remoção de rotas.
- **Painel (`eden-bowls-admin`)**: `src/components/SystemHealth.tsx`, `src/pages/DashboardPage.tsx`, `DashboardPage.test.tsx`, `src/test/mockAdminFetch.ts`, `src/test/fixtures.ts`, `e2e/helpers/mockAdminApi.ts`, `e2e/specs/admin-login.spec.ts`, mais o manifesto de rotas e o teste de contrato. `docs-new/PORTAL_ADMINISTRATIVO_ATUAL/CONTRATO_API.md` e `TELAS.md` também mudam.
- **Loja (`eden-bowls`)**: sem impacto.
- **CI**: nenhum job novo e nenhum segredo. O teste de contrato roda dentro do Vitest que já existe.
