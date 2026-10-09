# Tasks

## 1. Backend – permissão e regra de conflitos compartilhada

- [x] 1.1 Adicionar `system.health.read` só em `ROLE_PERMISSIONS.admin` (`src/core/admin-roles.js`); verificar com `npx jest tests/admin-roles.test.js` que admin tem a permissão e operator/readonly/nutritionist não.
- [x] 1.2 Criar `src/infrastructure/repositories/market-conflicts.repository.js` com o SQL da regra (pares distintos cliente+conta), `count()` e `list({ offset, perPage })` com e-mail de `wp_users` e nomes de tabela configuráveis; fazer `backfill-admin-markets.js` usar o `count` do módulo; verificar com `npx jest tests/backfill-admin-markets.test.js` ajustado para a contagem distinta.
- [x] 1.3 Teste de integração MySQL `tests/integration/market-conflicts.integration.test.js` (tabelas `it_*`): sem conflito → 0; `BR` com 2 assinaturas `us` → 1 linha e, após `applyBackfill`, perfil segue `BR` e as 2 assinaturas seguem `us`; perfil sem mercado → ignorado; paginação respeita `perPage`; `countMarketConflicts` do script devolve o mesmo total da listagem. Verificar com `RUN_DB_INTEGRATION_TESTS=true npx jest tests/integration/market-conflicts`.

## 2. Backend – rotas de saúde

- [x] 2.1 Criar `src/core/webhook-health.js` (função pura de status, `STALE_AFTER_HOURS = 72`, `OVERDUE_AFTER_MINUTES = 60`); teste unitário com os cenários do spec (`ok`, silêncio > 72 h, falha < 24 h, falha > 24 h, pendência > 1 h, `no_events`).
- [x] 2.2 Adicionar `healthByAccount({ since24h, overdueBefore })` em `StripeWebhookEventsRepository` (tabela ausente → vazio).
- [x] 2.3 Criar `AdminSystemHealthService` (`marketConflicts`, `webhookHealth`) e ligá-lo no wiring de `src/index.js`/config com os repositórios reais; verificar com `node -e` que `createApp` com dependências reais registra as duas rotas.
- [x] 2.4 Registrar `GET /api/v1/admin/markets/conflicts` (`parsePageQuery` + `paginatedEnvelope`) e `GET /api/v1/admin/billing/webhooks/health` com `requirePermission('system.health.read', { market: 'query' })`; teste de rota `tests/admin-system-health.routes.test.js`: 401 sem token, 403 operator e readonly, 200 admin.
- [x] 2.5 Teste de integração ponta a ponta `tests/integration/admin-system-health.integration.test.js`: `supertest` + `createApp` + serviço/repositórios reais sobre MySQL (`it_*`), identidade real resolvida via `wp_usermeta` de papéis. Cobrir: conflitos admin 200 com/sem conflito, operator 403, sem token 401; webhook health admin 200 com eventos `br` falhos < 24 h (`attention`), `us` recente (`ok`) e conta vazia (`no_events`), operator 403. Verificar com `RUN_DB_INTEGRATION_TESTS=true npx jest tests/integration/admin-system-health`.
- [x] 2.6 Documentar as duas rotas em `eden-bowls-admin/docs-new/PORTAL_ADMINISTRATIVO_ATUAL/CONTRATO_API.md` (formato, papéis, limites 72 h / 1 h).

## 3. Contrato de rotas (prevenção)

- [x] 3.1 Backend: `src/scripts/api-routes-manifest.js` + script `routes:manifest` gerando `docs/api-routes.json`; teste `tests/api-routes-manifest.test.js` falha e nomeia a rota quando o arquivo commitado diverge. Verificar rodando o teste antes e depois de gerar.
- [x] 3.2 Backend: `docs/api-routes-removed.json` (vazio) + `tests/api-routes-removal.test.js` comparando com `origin/main` (skip explicado sem base); `fetch-depth: 0` no job `unit` do CI; verificar removendo uma rota localmente com `API_ROUTES_BASE_REF=HEAD` → falha nomeando a rota; registrar no removed → passa.
- [x] 3.3 Painel: `scripts/sync-backend-routes.mjs` + script `contract:sync` que copia o manifesto para `contracts/backend-routes.json` e imprime rotas adicionadas/removidas; rodar e conferir que as duas rotas novas aparecem.
- [x] 3.4 Painel: `src/test/apiContract.test.ts` com varredura estática (fontes + condições dos mocks Vitest/Playwright) e comparação com o manifesto; `installAdminFetchMock` lança erro em rota fora do manifesto. Verificar que o teste **falha** contra o manifesto sem a rota de conflitos e **passa** com o manifesto atualizado; remover stubs de rotas inexistentes que aparecerem.
- [x] 3.5 Adicionar ao template de PR do backend (ou `AGENTS.md` do backend) o lembrete "rota nova/removida → `npm run routes:manifest` e `npm run contract:sync` no painel".

## 4. Painel – Saúde do sistema

- [x] 4.1 Atualizar `src/test/fixtures.ts`, `src/test/mockAdminFetch.ts` e `e2e/helpers/mockAdminApi.ts` para o envelope paginado real de conflitos e para o formato de `webhooks/health`.
- [x] 4.2 `SystemHealth.tsx`: remover os 4 cards e o fetch de `/admin/onboarding/metrics`; adicionar o bloco Webhooks Stripe (BR/EUA, badge, último evento, falhas 24 h, `div.alert` em erro); conflitos com linhas + `Pager`; manter Preços Stripe intacto.
- [x] 4.3 `DashboardPage.test.tsx`: admin vê webhooks (`attention`/`ok`/`no_events`), conflitos com linhas e paginação, ausência dos 4 cards e de `/onboarding/metrics`; operator não chama `webhooks/health` nem `markets/conflicts`; erro do endpoint mostra alerta. Verificar com `npx vitest run --related src/components/SystemHealth.tsx src/pages/DashboardPage.tsx`.
- [x] 4.4 Playwright: ajustar `e2e/specs/admin-login.spec.ts` (asserts de conflitos) e cobrir a seção expandida para admin; verificar com `npx playwright test e2e/specs/admin-login.spec.ts --workers=4`.
- [x] 4.5 Atualizar `docs-new/PORTAL_ADMINISTRATIVO_ATUAL/TELAS.md` (seção Saúde do sistema).

## 5. Backend + painel – última sincronização persistida

- [x] 5.1 Migration `1700000000032-create-catalog-sync-runs` + `CatalogSyncRunsRepository` (`insert` com prune de 50 por mercado, `latestByMarket`); teste de integração MySQL: grava, sobrevive a nova conexão, 51ª execução BR remove a mais antiga só de BR, `latestByMarket(['US'])` ignora BR.
- [x] 5.2 `AdminCatalogService.sync()` grava uma execução por país processado e grava `failed` + mensagem ao falhar, relançando o erro; `status(marketQuery)` devolve topo + `byMarket` no escopo; wiring do repositório; teste unitário (sucesso, falha, operator US não vê BR, admin vê os dois, vazio → `{ status: null, byMarket: {} }`) e teste de rota do status.
- [x] 5.3 Painel: linha "Última sincronização" por mercado em `SystemHealth` (resultado, hora, erro), mocks atualizados com `byMarket`; verificar com `npx vitest run --related src/components/SystemHealth.tsx src/components/CatalogPricesSection.tsx`.
- [x] 5.4 Documentar `catalog_sync_runs`, retenção de 50 por mercado e o novo formato de `/catalog/sync/status` em `CONTRATO_API.md`.

## 6. Verificação final

- [x] 6.1 Backend: `npx jest --findRelatedTests` nos arquivos alterados, depois `npm test` e `npm run test:integration` (MySQL 3310).
- [x] 6.2 Painel: `npx vitest run --changed`, `npm run lint`, `npm run build`, depois `npm test` e os specs Playwright tocados com `--workers=4`.
- [x] 6.3 Arquivar o spec atualizado de `operations/admin-market-scope` e conferir `openspec validate admin-system-health --strict`.
