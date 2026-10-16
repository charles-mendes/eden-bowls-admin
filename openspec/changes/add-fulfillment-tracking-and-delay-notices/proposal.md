# Proposal

## Why

Hoje a fila de Produção termina em `ready`. Depois disso o operador não vê, na fila, se o ciclo tem etiqueta, se está a caminho ou se foi entregue. Um ciclo `ready` ainda sai da fila assim que a data de preparo passa (`overdue` exige `production_status <> 'ready'`). A UPS é consultada a cada 30 minutos (job `ups_tracking`), mas a resposta só fica em `raw_response`: nenhum código grava `delivered`. No Brasil não existe registro algum da entrega, que hoje é feita por Uber combinado fora do sistema. Quando um ciclo atrasa, o cliente não recebe aviso pelo sistema, e nada registra quem mudou o quê no ciclo além de `admin_audit_events`, que não aparece no painel. O produto é perecível: um pacote parado ou uma entrega falha sem dono vira prejuízo e reclamação.

## What Changes

- **Histórico do ciclo**: nova tabela append-only `cycle_events`, gravada na mesma transação de cada mudança do ciclo (status, bloqueio, reabertura, nota, aviso de atraso, mudança de envio, e-mail enviado ou com falha). O painel mostra a timeline num painel lateral "Histórico" aberto pelo menu da linha. Não existe tela de detalhe do ciclo hoje.
- **Aviso de atraso**: ação "Avisar atraso" no menu da linha (`production.write`). Tem motivo de lista fechada, nova data futura obrigatória, texto livre opcional (≤ 500), prévia do e-mail e confirmação. Para reavisar, o operador precisa confirmar de novo: sem `confirmResend` a API devolve 409 com o aviso anterior. O atraso é uma condição paralela ao status, guardada em colunas desnormalizadas no ciclo (`delay_expected_date`, `delay_notified_at`, `delay_notice_count`). A fonte de verdade são os eventos. Novo template `production_delayed` (en-US e pt-BR). Se o e-mail falhar, o aviso continua valendo e o evento `email_failed` é registrado.
- **Status de envio na fila**: novo `fulfillmentStatus` derivado na query da fila: `none`, `awaiting_pickup`, `in_transit`, `delivered` ou `exception`. Vem do envio UPS ativo da fatura paga do ciclo ou da entrega local mais recente. Não é armazenado no ciclo. O job `ups_tracking` passa a interpretar a resposta da UPS e grava `delivered`, além de um `carrier_status` de trânsito e do último evento.
- **E-mails de entrega**: `delivered` (EUA e BR, com dicas de armazenamento, no máximo uma vez por ciclo) e `out_for_delivery` (BR). `exception` gera só um alerta interno para operações, sem e-mail ao cliente. O e-mail `shipped` não muda, só passa a aparecer na timeline.
- **Entrega local BR com marcação manual**: nova tabela `local_deliveries` (provider `uber_manual`), com status `requested | out_for_delivery | delivered | failed | cancelled` e transições fechadas. Um reenvio depois de `failed` ou `cancelled` cria um novo registro. Os status foram pensados para servir à futura integração com o Uber Direct.
- **UX da fila**: nova coluna "Envio" (transportadora, rastreio clicável, último evento). A ação principal em `ready` passa a ser "Gerar etiqueta" (EUA, pelo fluxo UPS existente) ou "Registrar envio" (BR). Entram os filtros "Pronto sem etiqueta", "Em trânsito" e "Com exceção", as métricas "Prontos aguardando envio" e "Exceções de entrega" e os selos "Atrasado", "Cliente avisado · nova data DD/MM" e de urgência quando a nova data venceu.
- Um ciclo `ready` vencido continua na fila enquanto o envio não for `delivered`, dentro do mesmo limite de `windowDays` que já vale para atrasados.

## Out of scope

- Detecção automática de exceção pela UPS (códigos `X` do tracking). O evento é guardado como "último evento", mas não muda `fulfillmentStatus`.
- Integração com o Uber Direct (API, webhooks, cotação). `external_id` fica reservado.
- E-mail "em preparo" ao cliente.
- Mudanças no conteúdo ou no momento do e-mail `shipped`.
- Reembolso ou reenvio automático em caso de exceção.

## Capabilities

### New Capabilities

- `operations/cycle-timeline`: histórico append-only por ciclo de produção, quem gravou e como o painel mostra a timeline.
- `operations/delay-notices`: aviso de atraso ao cliente (validação, reaviso, e-mail `production_delayed`, efeitos na fila).
- `operations/fulfillment-tracking`: status de envio derivado, atualização de trânsito e entrega pela UPS, e-mail `delivered` e alerta interno de exceção.
- `operations/local-deliveries`: entrega local no BR com marcação manual, transições, reenvio e e-mail `out_for_delivery`.

### Modified Capabilities

- `operations/production-queue`: a regra de atrasados passa a manter ciclos `ready` não entregues, e a fila ganha `fulfillmentStatus`, filtro de envio, métricas de envio, coluna "Envio", ações por mercado e selos de atraso.

## Impact

- **API (`eden-bowls-backend`)**
  - Migrações novas em `src/infrastructure/migrations/` (próximo número: `1700000000033`): `cycle_events`, colunas de atraso em `subscription_production_cycles`, colunas de tracking em `ups_shipments`, `local_deliveries`.
  - `src/infrastructure/entities/subscription-production-cycle.entity.js`; `src/infrastructure/repositories/subscription-production.repository.js`; `src/infrastructure/repositories/subscription-ledger.repository.js` (`queueSourceSql`, `queueMembership`, `mapQueueRow`, `listQueueMetricRows`); `src/infrastructure/repositories/ups-shipment.repository.js`; repositórios novos `cycle-events.repository.js` e `local-deliveries.repository.js`.
  - `src/services/admin-production.service.js` (transação em `updateStatus`, aviso de atraso, timeline); `src/services/ups-shipment.service.js`; `src/services/background-jobs.service.js` (`runUpsTracking`); serviço novo de entregas locais; `src/config/production-services.js`.
  - `src/core/production-queue-presenter.js`; `src/api/validators/admin-production.validator.js`; validator novo de entregas locais; `src/api/routes/admin.routes.js`; `docs/api-routes.json` (via `npm run routes:manifest`).
  - `src/infrastructure/mailers/transactional-mailer.js` (`TEMPLATES`, `notifyShipped` ~l. 371, novos `notifyProductionDelayed`, `notifyDelivered`, `notifyOutForDelivery`, `notifyDeliveryException`); `src/core/email/transactional-emails.js`; `src/core/email/preview-fixtures.js`; `src/scripts/render-email-previews.js`.
  - Testes Jest em `tests/`: `admin-production.service.test.js`, `admin-production.routes.test.js`, `production-queue-presenter.test.js`, `background-jobs.ups.test.js`, `ups-shipment.service.test.js`, `transactional-mailer.test.js`, `email-templates.test.js`, `subscription-production.repository.test.js` e testes de migração novos.
- **Painel (`eden-bowls-admin`)**
  - `src/pages/ProductionQueuePage.tsx`, `src/lib/productionQueue.ts`, componentes novos em `src/components/` (diálogo de aviso de atraso, painel de histórico, diálogo de entrega local), reaproveitando `src/components/Dialog.tsx` e `src/components/RowMenu.tsx`.
  - `contracts/backend-routes.json`, `src/test/mockAdminFetch.ts`, `src/test/fixtures.ts`, `e2e/helpers/mockAdminApi.ts`.
  - Testes: `src/pages/ProductionQueuePage.test.tsx`, `e2e/specs/admin-production.spec.ts`, `e2e/specs/admin-readonly.spec.ts`.
- **Loja (`eden-bowls`)**: sem mudança.
- **Permissões**: nenhuma nova. Ler histórico e envio exige `production.read`. Avisar atraso exige `production.write`. Registrar e mover entrega local exige `shipping.write`, o mesmo do fluxo UPS. `readonly` vê tudo e não muta nada.
- **OpenSpec do backend**: `eden-bowls-backend/openspec/specs/transactional-emails` ganhará um delta próprio para os três e-mails novos (tarefa 5.3).
