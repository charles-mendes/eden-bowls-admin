# Tasks

## 1. Backend – permissão e regra de conflitos compartilhada

- [ ] 1.1 Adicionar `system.health.read` só em `ROLE_PERMISSIONS.admin` (`src/core/admin-roles.js`); verificar com `npx jest tests/admin-roles.test.js` que admin tem a permissão e operator/readonly/nutritionist não.
- [ ] 1.2 Criar `src/infrastructure/repositories/market-conflicts.repository.js` com o SQL da regra (pares distintos cliente+conta), `count()` e `list({ offset, perPage })` com e-mail de `wp_users` e nomes de tabela configuráveis; fazer `backfill-admin-markets.js` usar o `count` do módulo; verificar com `npx jest tests/backfill-admin-markets.test.js` ajustado para a contagem distinta.
- [ ] 1.3 Teste de integração MySQL `tests/integration/market-conflicts.integration.test.js` (tabelas `it_*`): sem conflito → 0; `BR` com 2 assinaturas `us` → 1 linha; perfil sem mercado → ignorado; paginação respeita `perPage`; `countMarketConflicts` do script devolve o mesmo total da listagem. Verificar com `RUN_DB_INTEGRATION_TESTS=true npx jest tests/integration/market-conflicts`.

## 2. Backend – rotas de saúde

- [ ] 2.1 Criar `src/core/webhook-health.js` (função pura de status, `STALE_AFTER_HOURS = 72`, `OVERDUE_AFTER_MINUTES = 60`); teste unitário com os cenários do spec (`ok`, silêncio > 72 h, falha < 24 h, falha > 24 h, pendência > 1 h, `no_events`).
- [ ] 2.2 Adicionar `healthByAccount({ since24h, overdueBefore })` em `StripeWebhookEventsRepository` (tabela ausente → vazio).
- [ ] 2.3 Criar `AdminSystemHealthService` (`marketConflicts`, `webhookHealth`) e ligá-lo no wiring de `src/index.js`/config com os repositórios reais; verificar com `node -e` que `createApp` com dependências reais registra as duas rotas.
- [ ] 2.4 Registrar `GET /api/v1/admin/markets/conflicts` (`parsePageQuery` + `paginatedEnvelope`) e `GET /api/v1/admin/billing/webhooks/health` com `requirePermission('system.health.read', { market: 'none' })`; teste de rota `tests/admin-system-health.routes.test.js`: 401 sem token, 403 operator e readonly, 200 admin.
- [ ] 2.5 Teste de integração ponta a ponta `tests/integration/admin-system-health.integration.test.js`: `supertest` + `createApp` + serviço/repositórios reais sobre MySQL (`it_*`), identidade real resolvida via `wp_usermeta` de papéis. Cobrir: conflitos admin 200 com/sem conflito, operator 403, sem token 401; webhook health admin 200 com eventos `br` falhos < 24 h (`attention`), `us` recente (`ok`) e conta vazia (`no_events`), operator 403. Verificar com `RUN_DB_INTEGRATION_TESTS=true npx jest tests/integration/admin-system-health`.
- [ ] 2.6 Documentar as duas rotas em `eden-bowls-admin/docs-new/PORTAL_ADMINISTRATIVO_ATUAL/CONTRATO_API.md` (formato, papéis, limites 72 h / 1 h).

## 3. Contrato de rotas (prevenção)

- [ ] 3.1 Backend: `src/scripts/api-routes-manifest.js` + script `routes:manifest` gerando `docs/api-routes.json`; teste `tests/api-routes-manifest.test.js` falha e nomeia a rota quando o arquivo commitado diverge. Verificar rodando o teste antes e depois de gerar.
- [ ] 3.2 Painel: `scripts/sync-backend-routes.mjs` + script `contract:sync` que copia o manifesto para `contracts/backend-routes.json` e imprime rotas adicionadas/removidas; rodar e conferir que as duas rotas novas aparecem.
- [ ] 3.3 Painel: `src/test/apiContract.test.ts` com varredura estática (fontes + condições dos mocks Vitest/Playwright) e comparação com o manifesto; `installAdminFetchMock` lança erro em rota fora do manifesto. Verificar que o teste **falha** contra o manifesto sem a rota de conflitos e **passa** com o manifesto atualizado; remover stubs de rotas inexistentes que aparecerem.
- [ ] 3.4 Adicionar ao template de PR do backend (ou `AGENTS.md` do backend) o lembrete "rota nova/removida → `npm run routes:manifest` e `npm run contract:sync` no painel".

## 4. Painel – Saúde do sistema

- [ ] 4.1 Atualizar `src/test/fixtures.ts`, `src/test/mockAdminFetch.ts` e `e2e/helpers/mockAdminApi.ts` para o envelope paginado real de conflitos e para o formato de `webhooks/health`.
- [ ] 4.2 `SystemHealth.tsx`: remover os 4 cards e o fetch de `/admin/onboarding/metrics`; adicionar o bloco Webhooks Stripe (BR/EUA, badge, último evento, falhas 24 h, `div.alert` em erro); conflitos com linhas + `Pager`; manter Preços Stripe intacto.
- [ ] 4.3 `DashboardPage.test.tsx`: admin vê webhooks (`attention`/`ok`/`no_events`), conflitos com linhas e paginação, ausência dos 4 cards e de `/onboarding/metrics`; operator não chama `webhooks/health` nem `markets/conflicts`; erro do endpoint mostra alerta. Verificar com `npx vitest run --related src/components/SystemHealth.tsx src/pages/DashboardPage.tsx`.
- [ ] 4.4 Playwright: ajustar `e2e/specs/admin-login.spec.ts` (asserts de conflitos) e cobrir a seção expandida para admin; verificar com `npx playwright test e2e/specs/admin-login.spec.ts --workers=4`.
- [ ] 4.5 Atualizar `docs-new/PORTAL_ADMINISTRATIVO_ATUAL/TELAS.md` (seção Saúde do sistema).

## 5. Última sincronização — AGUARDA DECISÃO (não executar sem ok)

- [ ] 5.1 Opção A (persistir): migration `catalog_sync_runs`, repositório, `sync()` grava sucesso e falha, `status()` por mercado; teste de integração da migration/repositório e unitário do serviço; painel mostra data, resultado e erro. Verificar com os testes citados e `npx vitest run --related src/components/SystemHealth.tsx`.
- [ ] 5.2 Opção B (remover): retirar a linha "Última sincronização" e o fetch de `/catalog/sync/status` da seção; verificar com o teste do Dashboard.

## 6. Verificação final

- [ ] 6.1 Backend: `npx jest --findRelatedTests` nos arquivos alterados, depois `npm test` e `npm run test:integration` (MySQL 3310).
- [ ] 6.2 Painel: `npx vitest run --changed`, `npm run lint`, `npm run build`, depois `npm test` e os specs Playwright tocados com `--workers=4`.
- [ ] 6.3 Arquivar o spec atualizado de `operations/admin-market-scope` e conferir `openspec validate admin-system-health --strict`.
