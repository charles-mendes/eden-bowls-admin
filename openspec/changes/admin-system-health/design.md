# Design

## Context

O que o código faz hoje (motivação em proposal.md):

- **Papéis**: o middleware `requirePermission(permission, { market })` em `admin.routes.js` só confere permissões. Hoje nenhuma permissão é exclusiva de admin para leitura; as únicas exclusivas são `users.roles.write` e `users.access.write`.
- **Conflitos**: `collectBackfillStats` em `src/scripts/backfill-admin-markets.js` conta com `COUNT(*)` sobre `stripe_subscriptions` + `wp_usermeta` (meta `PROFILE_MARKET_META_KEY`). Um cliente com duas assinaturas na conta errada conta duas vezes. O resultado não traz linhas.
- **Webhooks**: `stripe_webhook_events` já registra `stripe_account`, `type`, `created_at` (recebimento), `processed_at`, `failed_at` (falha terminal após `WEBHOOK_MAX_ATTEMPTS` ou idade máxima), `attempts` e `last_error`. O `listEvents` existente já filtra por conta.
- **Sync do catálogo**: `AdminCatalogService.lastSync` é um campo em memória. Só é gravado quando o sync termina sem erro, some no restart, é único por processo (não por mercado) e `status()` o devolve para qualquer mercado.
- **Testes**: os testes de rota usam `supertest` + `createApp` com serviços falsos (`tests/*.routes.test.js`). Os testes de MySQL ficam em `tests/integration/` com `RUN_DB_INTEGRATION_TESTS=true` na porta 3310 e criam tabelas `it_<sufixo>_*` com `CREATE TABLE … LIKE`. O container `eden-bowls-backend-db-1` está rodando localmente.
- **CI do painel**: o spec `delivery/continuous-integration` proíbe segredo, backend e API real no CI.

## Goals / Non-Goals

**Goals:**
- As duas rotas novas são testadas de ponta a ponta: HTTP real → middleware → serviço → repositório → MySQL real.
- Uma única fonte da regra de conflito.
- Uma rota que falte no backend quebra um teste do painel, sem depender de rede.

**Non-Goals:**
- Corrigir conflitos (mover cliente de mercado). A tela só lista.
- Reprocessar webhooks pelo painel, ou mostrar `last_error`/payload.
- Alterar a loja ou `GET /admin/billing/webhooks` (a lista continua como está).
- Validar formato de corpo/resposta no contrato. O contrato cobre só método + caminho.

## Decisions

### D1. Permissão nova `system.health.read`, só para admin
Ela entra em `ROLE_PERMISSIONS.admin`. As duas rotas usam `requirePermission('system.health.read', { market: 'none' })`, e `market: 'none'` porque o admin enxerga os dois mercados.
*Alternativa*: checar `identity.roles.includes('admin')` dentro do handler. Foi descartada porque espalha regra de papel fora do mapa de permissões e foge do padrão das outras rotas.

### D2. Módulo `src/infrastructure/repositories/market-conflicts.repository.js`
O módulo exporta o SQL base da regra (um `FROM … WHERE` com `SELECT DISTINCT sub.user_id, LOWER(TRIM(sub.stripe_account))`) e uma classe com `count()` e `list({ offset, perPage })`, que faz join em `wp_users` para o e-mail. A ordem é por `user_email, stripe_account`. Os nomes de tabela são configuráveis, como nos outros repositórios, para os testes `it_*`.
O script de backfill passa a chamar `countMarketConflicts(query)` desse módulo. **A contagem do script muda de "assinaturas" para "pares cliente+conta distintos"**, de acordo com o spec. É a única mudança de saída do script, e ela fica registrada no CHANGELOG/commit.
*Alternativa*: manter o script em `COUNT(*)` e fazer a rota em `DISTINCT`. Foi descartada porque o pedido é uma regra só, e dois números diferentes para o "mesmo" conflito confundem.

### D3. `AdminSystemHealthService`
Um serviço novo (`src/services/admin-system-health.service.js`) com `marketConflicts(pagination)` e `webhookHealth(now)`. Ele é injetado em `dependencies.adminSystemHealthService`, e a rota responde 503 quando o serviço não existe, como as demais. O agregado de webhooks vira um método novo `healthByAccount({ since24h, overdueBefore })` em `StripeWebhookEventsRepository`: um `GROUP BY stripe_account` com `MAX(created_at)`, `SUM(failed_at >= ?)` e `SUM(processed_at IS NULL AND failed_at IS NULL AND created_at < ?)`, mais uma leitura do tipo do evento mais recente por conta. Tabela ausente → contas `no_events`, seguindo o tratamento atual de `listEvents`.
O status (`ok`/`attention`/`no_events`) é calculado por uma função pura em `src/core/webhook-health.js`, com `STALE_AFTER_HOURS = 72` e `OVERDUE_AFTER_MINUTES = 60`.

### D4. Limite de "atenção": 72 h sem evento, 1 h de pendência
O volume de webhooks vem de assinaturas: renovação, fatura, pagamento. Com poucos clientes podem passar um ou dois dias sem evento sem que nada esteja quebrado, e por isso 24 h geraria alarme falso. Com 72 h, um endpoint desligado aparece antes do próximo ciclo semanal de produção. A pendência de 1 h pega o worker parado: `next_attempt_at` começa em +30 s e o retry é curto. Os valores ficam fixos em constante, documentados no spec e devolvidos em `staleAfterHours`. Não há variável de ambiente nesta change.

### D5. Painel
`SystemHealth.tsx` remove o `fetch` de `/admin/onboarding/metrics` e os 4 `MetricCard`. Ele ganha um bloco "Webhooks Stripe" com uma linha por conta, com badge `badge-success`/`badge-warning`/`badge-info`, hora (`formatDate`), tipo e falhas 24 h. Os conflitos passam a usar o envelope paginado com o `Pager` existente. O tipo `MarketConflict` não muda. O componente continua usando `apiRequest`, sem biblioteca nova. A seção já é só de admin no `DashboardPage`. O `isAdmin` interno do componente continua como defesa, mas como a seção não aparece para outros papéis, os testes de operator montando `<SystemHealth />` direto passam a verificar o Dashboard.

### D6. Contrato de rotas
- **Backend**: `src/scripts/api-routes-manifest.js` percorre `createApp({}).router.stack` (testado: com dependências vazias, 159 rotas `/api/v1` são registradas) e escreve `docs/api-routes.json` ordenado (`[{ method, path }]`). O script roda com `npm run routes:manifest`. O teste `tests/api-routes-manifest.test.js` gera em memória e compara com o arquivo commitado.
- **Painel**: `contracts/backend-routes.json` (cópia) + `scripts/sync-backend-routes.mjs`, que lê `../eden-bowls-backend/docs/api-routes.json` e imprime o diff. O comando é `npm run contract:sync`. O teste `src/test/apiContract.test.ts` faz três coisas: (a) varre `src/**/*.ts(x)` em busca de literais e templates passados a `apiRequest`/`fetch(\`${getApiBaseUrl()}…\`)` e normaliza `${…}` para segmento de parâmetro; (b) varre as condições de caminho de `src/test/mockAdminFetch.ts` e `e2e/helpers/mockAdminApi.ts`; (c) checa cada item contra o manifesto, aceitando `:param` em qualquer segmento. Além disso, `installAdminFetchMock` passa a lançar erro quando recebe uma rota fora do manifesto, o que cobre os caminhos montados em tempo de execução (`requestPath`, `path`, `BASE`).
*Alternativa*: checkout do backend no CI. Foi descartada porque exige token entre repositórios privados e viola o requisito "sem segredo" do CI. *Risco aceito*: a cópia pode ficar defasada se alguém remover uma rota no backend sem rodar `contract:sync`. A mitigação está nas Tasks: o checklist do PR do backend lembra de sincronizar.

### D7. Última sincronização: custo de persistir (decisão sua)
Custo estimado para persistir:
- 1 migration `1700000000032-create-catalog-sync-runs` (`id`, `market`, `currency`, `scope`, `product_id`, `status` [`completed`|`completed_with_skips`|`failed`], `summary` JSON, `error` varchar(500), `started_at`, `finished_at`, com índice em (`market`, `finished_at`)).
- 1 repositório (`insert`, `latest({ market })`) e um ajuste em `AdminCatalogService.sync()` para gravar sucesso e também falha. Hoje uma falha não é gravada, e para isso entra um `try/catch` que grava e relança o erro. `status(query, actor)` passa a ler a última execução do mercado pedido, o que corrige o vazamento entre mercados descrito em Context.
- Testes: um de integração da migration + repositório e um unitário do serviço, para sucesso e para falha.
- Painel: mostrar data, resultado e erro. É 1 linha que já existe, com mock atualizado.

São ~150–200 linhas no backend e ~20 no painel, sem dependência nova. **A recomendação é persistir.** Esse grupo das Tasks só é executado com o seu "ok". Se a resposta for remover, o grupo alternativo apaga a linha "Última sincronização" e o `fetch` de `/catalog/sync/status` da seção. A rota continua, porque `/billing` também a usa.

## Risks / Trade-offs

- [Contagem do script muda de significado] → isso fica dito no spec e no commit. O script só é usado em dry-run manual.
- [Query de conflitos sem índice em `wp_usermeta.meta_key` + `stripe_subscriptions.user_id`] → a paginação limita as linhas. Se ficar lento, o índice entra numa change separada, porque esta não altera schema.
- [72 h pode ser pouco num período sem vendas] → nesse caso o painel mostra "Atenção" sem impedir nada, e o valor é uma constante fácil de ajustar.
- [Scanner estático do contrato pode deixar passar um caminho montado de forma incomum] → o mock do Vitest em tempo de execução cobre o que os testes exercitam.

## Migration Plan

Deploy: backend primeiro (rotas novas, permissão nova), depois o painel. Rollback: reverter o painel. As rotas novas do backend são só leitura e não precisam de rollback de dados. Sem migration, a menos que D7 seja aprovado. Nesse caso a migration é aditiva e o `down` derruba a tabela.
