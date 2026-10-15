# Design

## Context

Motivação em `proposal.md` (Why). Estado atual, verificado no código em 2026-10-14:

- **Ciclo**: tabela `subscription_production_cycles` (entidade `SubscriptionProductionCycle`), com `id INT UNSIGNED AUTO_INCREMENT`, `subscription_id INT UNSIGNED` (FK `stripe_subscriptions.id`, `ON DELETE CASCADE`), `period_end DATETIME`, `status VARCHAR(32)`, `note VARCHAR(255)`, `updated_by_user_id BIGINT UNSIGNED` e, desde a migração `1700000000025`, `paid_at`, `paid_invoice_id VARCHAR(64)`, `preparation_day DATE` e `delivery_date DATE`. A chave única é `(subscription_id, period_end)`. O ciclo não guarda mercado: o mercado vem de `stripe_subscriptions.stripe_account` (`us` ou `br`). `moveCycle` muda `period_end` e mantém o `id`.
- **Status de produção**: `PRODUCTION_STATUSES` em `src/api/validators/admin-production.validator.js` (`to_prepare`, `in_production`, `ready`, `blocked`). A matriz de transição é `ALLOWED_TRANSITIONS` em `src/services/admin-production.service.js`. Bloquear exige nota de 1 a 255 caracteres. A UI chama tanto `blocked → to_prepare` quanto `ready → in_production` de "Reabrir".
- **Fila**: `queueSourceSql()` em `src/infrastructure/repositories/subscription-ledger.repository.js` faz `UNION ALL` de ciclos não pagos (próxima renovação) e pagos (`paid_at IS NOT NULL`). `queueMembership()` monta filtros em SQL. As métricas buscam as linhas em SQL (`listQueueMetricRows`) e contam os buckets em JS (`bucketMetrics`). Um `overdue` exige `production_status <> 'ready'`.
- **UPS**: tabela `ups_shipments` (`id BIGINT UNSIGNED`, `subscription_id VARCHAR(191)`, `stripe_invoice_id VARCHAR(191)`, `status VARCHAR(32)`, `tracking_number`, `shipped_at`, `raw_response LONGTEXT`, coluna gerada `active_invoice_id` com único `uq_ups_shipments_active_invoice`). Não há FK para o ciclo: a ligação é `ups_shipments.stripe_invoice_id = subscription_production_cycles.paid_invoice_id`. Status escritos: `pending` (`insertPending`), `created` (`markCreated`), `unknown` (`markUnknown`) e `voided` (`markVoided`). O job `ups_tracking` (`runUpsTracking` em `src/services/background-jobs.service.js`, a cada 30 minutos, lote de 20) chama `upsClient.track()` e só grava `raw_response`.
- **E-mails**: `createTransactionalMailer` em `src/infrastructure/mailers/transactional-mailer.js`. Cada envio passa por `sendClaimed`, que reserva `(stripe_subscription_id, template, reference_id)` em `subscription_mail_claims` antes do SMTP. `notifyShipped` (~l. 371) é chamado por `UpsShipmentService.createForSubscription` logo depois da compra da etiqueta. O idioma vem de `localeFrom()` em `src/core/email/mail-context.js`: `pt-BR` se `stripe_account = 'br'` ou o país do endereço for `BR`, senão `en-US`. Os alertas internos usam `opsEmails` (como `notifyAdminNewSubscription`).
- **Auditoria**: `AdminAuditService.record` grava em `admin_audit_events` em modo best-effort, fora de transação.
- **BR**: não existe nada de Uber nem de entrega local. Só a cotação de frete por distância em `src/services/shipping.service.js`.
- **Painel**: `src/pages/ProductionQueuePage.tsx` com `RowMenu` (Cliente, Assinatura, Checkout, Reabrir, Bloquear), cards de prazo (Atrasados, Hoje, Amanhã, Próximos N dias), filtros pela URL (`prazo`, `status`, `busca`, `mercado`) e `canWrite = hasPermission('production.write')`. A etiqueta UPS hoje só se gera em `src/pages/SubscriptionDetailPage.tsx` (`shipping.write`).
- **Testes**: Jest no backend (`tests/*.test.js`, `npm run test:related`). Vitest e Playwright no painel (`src/**/*.test.tsx`, `e2e/specs/admin-production.spec.ts`).

### Divergências entre o pedido e o código

1. **Banco é MySQL, não Postgres.** Não existe `JSONB`. O payload usa `JSON`, como `admin_audit_events.metadata`.
2. **Nada grava `ups_shipments.status = 'delivered'` hoje.** O status existe só nos filtros (`listOpenForTracking`). O job precisa interpretar o tracking para que `delivered` exista.
3. **Não há fonte para `in_transit`.** No mapeamento pedido, `pending/created → awaiting_pickup` e nenhum status UPS leva a `in_transit`. Proposta: guardar um `carrier_status` lido do tracking (`in_transit`, `delivered`). `created` + `carrier_status = 'in_transit'` vira `in_transit`.
4. **"Envio mais recente não anulado"**: a UPS já garante no máximo um envio não anulado por fatura (`uq_ups_shipments_active_invoice`). A derivação faz `JOIN` por `active_invoice_id`, sem "mais recente".
5. **Idempotência de e-mail**: já existe `subscription_mail_claims`, com reserva atômica e reenvio pelo job `mail_resend`. Os eventos `email_sent` e `email_failed` registram o resultado para a timeline, mas a garantia de "uma vez por ciclo" continua sendo a reserva. Usar só eventos como trava abriria uma corrida entre dois envios simultâneos.
6. **Transação**: `updateStatus` hoje não usa transação. O upsert do ciclo, a chamada ao Stripe, `moveCycle` e a auditoria são passos separados. O evento entra na mesma transação do upsert. A chamada ao Stripe fica fora (ver Decisões).
7. **Métricas**: a filtragem acontece em SQL, mas a contagem por bucket acontece em JS a partir das linhas. As novas métricas seguem o mesmo padrão: `fulfillment_status` é calculado em SQL e contado junto com os buckets.
8. **Não existe tela de detalhe do ciclo.** A timeline abre num painel lateral na própria fila.
9. **Gerar etiqueta exige `shipping.write`, não `production.write`.** A rota é `POST /api/v1/admin/billing/subscriptions/:id/shipments`. A ação na fila respeita isso, e a entrega local BR usa a mesma permissão.
10. **`ready` vencido some da fila.** Sem mudar a regra de atrasados, "Em trânsito" e "Pronto sem etiqueta" sumiriam no dia seguinte ao preparo.
11. **Spec desatualizada**: `operations/production-queue` descreve 10 colunas e o texto "Nenhuma renovação nesta janela." A página tem 6 colunas (Cliente, Dia de preparo, Sabores, Preparo, Pagamento, Ação), cards de prazo clicáveis e o filtro `due`, que não está na spec. Esta mudança não corrige esse desvio. Os requisitos novos foram escritos como ADDED para não reescrever requisitos desatualizados. Só a regra de atrasados é MODIFIED.
12. **Ciclo cancelado ou pulado**: não existe estado "pulado" no ciclo. Os ciclos não pagos já são filtrados pelo status do ledger (`queueSourceSql`). Nada muda aqui.
13. **Idioma**: o código usa `en-US` (não `en`) e `pt-BR`.
14. **Rotas com `market: 'record'`** só verificam se a equipe tem mercado. Cada serviço novo precisa chamar `assertStripeAccountMarket` para o ledger do ciclo, como `updateStatus` já faz.

## Goals / Non-Goals

**Goals:**

- Todo efeito sobre um ciclo deixa um evento consultável, gravado na mesma transação da mudança.
- `fulfillmentStatus` é derivado numa única expressão SQL, usada por lista, filtro e métricas.
- Cada bloco de `tasks.md` pode ir para produção sozinho, com migração reversível.

**Non-Goals:**

- Substituir `admin_audit_events`. A auditoria continua existindo. `cycle_events` é o histórico do ciclo mostrado no painel.
- Backfill de eventos de ciclos antigos. A timeline começa no deploy do bloco 1.
- Corrigir o desvio da spec da fila descrito em Divergências, item 11.

## Decisions

### D1. `cycle_events` append-only, chaveado por `cycle_id`

A tabela recebe uma linha por fato. O código só faz `INSERT`, e o repositório não expõe `update` nem `delete`. `cycle_id` é FK para `subscription_production_cycles.id` com `ON DELETE CASCADE`, para não travar a remoção de assinatura feita por `src/scripts/retire-stripe-ledger.js`. Como `moveCycle` mantém o `id`, o histórico acompanha o ciclo quando a cobrança muda de data.

Tipos (`type`): `production_status_changed`, `blocked`, `reopened`, `note_updated`, `delay_notified`, `fulfillment_changed`, `email_sent`, `email_failed`. A validação dos tipos fica no código (constante `CYCLE_EVENT_TYPES`), como os status do ciclo.

Regras de emissão do PATCH de status:
- `→ blocked`: `blocked` `{ from, to, note }`.
- `blocked → to_prepare` e `ready → in_production` (ambos "Reabrir" na UI): `reopened` `{ from, to }`.
- Demais transições: `production_status_changed` `{ from, to }`.
- Se a nota gravada mudou numa transição que não é bloqueio: também `note_updated` `{ before, after }`.

Payload de e-mail: `{ template, locale, referenceId }`. Nunca o corpo, o assunto nem o destinatário.

O autor fica em `actor_type` (`admin` ou `system`), `actor_user_id` e `actor_email`. Jobs e webhooks gravam como `system`.

*Alternativas descartadas*: (a) usar `admin_audit_events`. Não tem chave de ciclo, é best-effort fora de transação e mistura ações de todo o painel. (b) Tabela de "estado anterior" (snapshot). Não registra e-mails nem envios.

### D2. Transação: o evento entra com a mudança, o Stripe fica fora

`AdminProductionService.updateStatus` passa a abrir `dataSource.transaction(manager => …)`, como em `admin-delivery-calendar.service.js`, só para upsert do ciclo, leitura do `id` e `INSERT` do evento. A chamada a `deliverySchedule.onProductionStatus` (Stripe) continua depois do commit. `moveCycle` não emite evento próprio, porque o `id` não muda. O `periodEnd` novo vai num evento `production_status_changed` só se a data mudar. *Alternativa descartada*: Stripe dentro da transação. Seguraria lock de linha durante uma chamada de rede de até 15 s.

Os repositórios ganham um parâmetro opcional `manager` (padrão: `this.dataSource`).

### D3. Atraso como condição paralela

Colunas novas no ciclo: `delay_expected_date DATE`, `delay_notified_at DATETIME`, `delay_notice_count INT UNSIGNED DEFAULT 0`. A fonte de verdade é a sequência de eventos `delay_notified`. As colunas existem para filtrar e mostrar sem ler eventos. `POST /api/v1/admin/production/cycles/:cycleId/delay-notices` atualiza as colunas e grava `delay_notified` na mesma transação. Depois do commit, envia `production_delayed` e grava `email_sent` ou `email_failed` (outra transação curta). Prévia: `POST …/delay-notices/preview`, sem efeito colateral.

Validação:
- `reason` precisa estar em `DELAY_REASONS` (lista inicial em Perguntas em aberto).
- `newDate` é `YYYY-MM-DD` e deve ser estritamente depois de hoje no fuso do mercado (`America/Sao_Paulo` no BR, `America/New_York` nos EUA, como `formatLetterDate`).
- `message` é aparado e tem no máximo 500 caracteres.
- O ciclo precisa estar pago (`409 production_awaiting_payment`) e não pode estar `delivered` (`409 cycle_already_delivered`).

Se `delay_notice_count > 0` e o corpo não trouxer `confirmResend: true`, a API devolve `409 delay_notice_exists` com `{ previous: { reason, newDate, notifiedAt, count } }`.

Reserva do e-mail: `referenceId = "<cycleId>:<delay_notice_count>"`. Cada aviso tem a própria reserva, e o reenvio não duplica o mesmo aviso.

*Alternativa descartada*: um status `delayed`. Misturaria com a produção (um ciclo pode estar `in_production` e atrasado) e quebraria a matriz de transição.

### D4. `fulfillmentStatus` derivado em SQL

A expressão entra no ramo pago de `queueSourceSql()`. O ramo não pago devolve `'none'` e `NULL` nas colunas de envio. Os dois ramos passam a devolver também `c.id AS cycle_id` e as colunas de atraso.

```sql
LEFT JOIN ups_shipments u
  ON u.active_invoice_id = c.paid_invoice_id
LEFT JOIN local_deliveries ld
  ON ld.id = (SELECT MAX(l2.id) FROM local_deliveries l2 WHERE l2.cycle_id = c.id)
...
CASE
  WHEN ld.id IS NOT NULL THEN CASE ld.status
    WHEN 'requested'        THEN 'awaiting_pickup'
    WHEN 'out_for_delivery' THEN 'in_transit'
    WHEN 'delivered'        THEN 'delivered'
    WHEN 'failed'           THEN 'exception'
    ELSE 'none'                       -- cancelled
  END
  WHEN u.id IS NOT NULL THEN CASE
    WHEN u.status = 'delivered'                                    THEN 'delivered'
    WHEN u.status = 'unknown'                                      THEN 'exception'
    WHEN u.status = 'created' AND u.carrier_status = 'in_transit'  THEN 'in_transit'
    WHEN u.status IN ('pending', 'created')                        THEN 'awaiting_pickup'
    ELSE 'none'
  END
  ELSE 'none'                         -- sem envio, ou só envios voided
END AS fulfillment_status
```

Mapeamento resumido:

| Origem | Status de origem | `fulfillmentStatus` |
| --- | --- | --- |
| UPS | `pending`, `created` | `awaiting_pickup` |
| UPS | `created` + `carrier_status = in_transit` | `in_transit` |
| UPS | `delivered` | `delivered` |
| UPS | `unknown` | `exception` |
| UPS | só `voided` | `none` ("Pronto sem etiqueta") |
| Local | `requested` | `awaiting_pickup` |
| Local | `out_for_delivery` | `in_transit` |
| Local | `delivered` | `delivered` |
| Local | `failed` | `exception` |
| Local | `cancelled` (mais recente) | `none` |

O filtro `fulfillment` em `queueMembership()` compara `q.fulfillment_status` (com `ready_unshipped` = `production_status = 'ready' AND fulfillment_status = 'none'`). As métricas `readyAwaitingShipment` (`ready` e `none` ou `awaiting_pickup`) e `deliveryExceptions` (`exception`) saem de `listQueueMetricRows`, que passa a selecionar `q.fulfillment_status`.

*Alternativa descartada*: coluna `fulfillment_status` no ciclo, atualizada por gatilho ou pelo código. Duplicaria o estado de `ups_shipments` e `local_deliveries` e poderia divergir.

### D5. Regra de atrasados mantém `ready` não entregue

Em `queueMembership()`, `q.production_status <> 'ready'` passa a ser `(q.production_status <> 'ready' OR q.fulfillment_status <> 'delivered')`. O piso `overdueFloor` (`windowDays` atrás) continua valendo, então o máximo de histórico na fila é 30 dias.

Faseamento: no bloco 3, a retenção vale só para `stripe_account = 'us'`, porque o BR ainda não teria como registrar envio. O bloco 4 remove essa condição.

### D6. Tracking UPS interpretado no job

Um módulo novo, `src/core/ups-tracking-status.js`, lê o `status.type` do evento mais recente (`trackResponse.shipment[0].package[0].activity[0]`, com fallback em `currentStatus`):
- `D` → `delivered`
- `I` e `P` → `in_transit`
- `M` → nada muda
- `X` e demais → só atualizam o "último evento"

`runUpsTracking` passa a chamar `repository.applyTracking(id, { carrierStatus, lastEventAt, lastEventDescription, delivered })`. A primeira vez que um envio vira `in_transit` ou `delivered` grava `fulfillment_changed` (`actor_type = system`). Ao virar `delivered`, o ciclo dispara `notifyDelivered`. `refreshTracking` (botão manual) usa o mesmo caminho.

Colunas novas em `ups_shipments`: `carrier_status VARCHAR(32)`, `last_event_at DATETIME`, `last_event_description VARCHAR(255)`, `delivered_at DATETIME`.

### D7. Entrega local BR

`local_deliveries` recebe uma linha por tentativa. Transições (código, com `409 invalid_local_delivery_transition` para as demais):

| de \ para | out_for_delivery | delivered | failed | cancelled |
| --- | --- | --- | --- | --- |
| requested | sim | não | sim | sim |
| out_for_delivery | não | sim | sim | não |

Há no máximo uma tentativa aberta (`requested` ou `out_for_delivery`) por ciclo, garantida por coluna gerada `open_cycle_id` com índice único (mesmo padrão da migração `1700000000030`). Criar uma tentativa exige ciclo pago, mercado `br`, `production_status = 'ready'` e nenhuma tentativa `delivered` (`409 local_delivery_exists`). Cada mudança grava `fulfillment_changed`. `out_for_delivery` dispara `notifyOutForDelivery`, `delivered` dispara `notifyDelivered`, e `failed` dispara o alerta interno.

Rotas:
- `POST /api/v1/admin/production/cycles/:cycleId/local-deliveries` `{ trackingUrl? }`
- `PATCH /api/v1/admin/local-deliveries/:id` `{ status, failureReason?, trackingUrl? }`

`failureReason` é obrigatório em `failed` (1 a 255). Permissão: `shipping.write`, com `market: 'record'`.

O Uber Direct, no futuro, troca `provider` e preenche `external_id`, com os mesmos status.

### D8. E-mails

Templates novos em `TEMPLATES`:
- `production_delayed`
- `delivered`, com reserva `referenceId = cycleId` (uma vez por ciclo, valendo para UPS e local)
- `out_for_delivery`, com reserva `referenceId = localDeliveryId`
- `admin_delivery_exception`, para `opsEmails`, com reserva `referenceId = "<origem>:<id>"`

Os builders ficam em `src/core/email/transactional-emails.js`, com o mesmo layout dos atuais, e os textos en-US e pt-BR são escolhidos por `localeFrom()`.

`notifyShipped` não muda. `UpsShipmentService.notifyShippedMail` grava `email_sent` ou `email_failed` no ciclo da fatura, se o ciclo existir. `createForSubscription`, `markUnknown` e `voidShipment` gravam `fulfillment_changed`.

Os e-mails não entram em `RESEND_TEMPLATES`. Uma falha vira `email_failed`, e o operador decide reavisar.

### D9. API da timeline e itens da fila

Timeline: `GET /api/v1/admin/production/cycles/:cycleId/events` (`production.read`, `market: 'record'`). Devolve `{ items: [{ id, type, actor: { type, email }, payload, createdAt }] }` em ordem decrescente, com no máximo 200 itens.

O item da fila ganha:
- `cycleId` (`null` em ciclo não pago sem linha)
- `paidInvoiceId`
- `deliveryDate`
- `fulfillment: { status, carrier ('UPS' | 'Uber'), trackingNumber, trackingUrl, lastEventAt, lastEventDescription, shipmentId, localDeliveryId, localStatus }`
- `delay: { expectedDate, notifiedAt, noticeCount, expired }`

`expired` é verdadeiro quando `expectedDate` é anterior a hoje no fuso da consulta e o envio não está `delivered`. `metrics` ganha `readyAwaitingShipment` e `deliveryExceptions`.

### D10. Painel

Em `ProductionQueuePage.tsx`:
- Coluna "Envio" entre "Pagamento" e "Ação".
- Em `ready`: "Gerar etiqueta" (US, `shipping.write`), que chama a rota existente com `invoice_id = paidInvoiceId`, ou "Registrar envio" (BR, `shipping.write`).
- `RowMenu` com "Avisar atraso" (`production.write`, ciclo pago e não entregue), "Histórico" (todos, se houver `cycleId`) e as ações de entrega local.
- Parâmetro de URL `envio` (`sem-etiqueta`, `em-transito`, `excecao`) mapeado para `fulfillment` na API, seguindo `prazo` e `status` em `src/lib/productionQueue.ts`.
- Dois cards novos de métrica.

Os diálogos usam `src/components/Dialog.tsx`, sem biblioteca de formulário.

## Migrações (SQL de referência)

As migrações seguem o padrão do repositório: classe com `name`, `up` e `down` idempotentes (`hasTable`/`hasColumn`) e SQL cru para colunas geradas.

```sql
-- 1700000000033-create-cycle-events
CREATE TABLE cycle_events (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  cycle_id      INT UNSIGNED    NOT NULL,
  type          VARCHAR(48)     NOT NULL,
  actor_type    VARCHAR(16)     NOT NULL,          -- 'admin' | 'system'
  actor_user_id BIGINT UNSIGNED NULL,
  actor_email   VARCHAR(191)    NULL,
  payload       JSON            NULL,
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_cycle_events_cycle_created (cycle_id, created_at, id),
  KEY idx_cycle_events_type_created (type, created_at),
  CONSTRAINT fk_cycle_events_cycle FOREIGN KEY (cycle_id)
    REFERENCES subscription_production_cycles (id) ON DELETE CASCADE
);
-- down: DROP TABLE cycle_events;

-- 1700000000034-add-production-cycle-delay
ALTER TABLE subscription_production_cycles
  ADD COLUMN delay_expected_date DATE         NULL,
  ADD COLUMN delay_notified_at   DATETIME     NULL,
  ADD COLUMN delay_notice_count  INT UNSIGNED NOT NULL DEFAULT 0;
-- down: DROP COLUMN das três, em ordem inversa.

-- 1700000000035-add-ups-shipments-tracking-state
ALTER TABLE ups_shipments
  ADD COLUMN carrier_status         VARCHAR(32)  NULL,   -- 'in_transit' | 'delivered'
  ADD COLUMN last_event_at          DATETIME     NULL,
  ADD COLUMN last_event_description VARCHAR(255) NULL,
  ADD COLUMN delivered_at           DATETIME     NULL;
-- down: DROP COLUMN das quatro. Antes, UPDATE ups_shipments SET status = 'created' WHERE status = 'delivered'
-- para que o código anterior (que não conhece 'delivered' fora de filtros) continue consultando esses envios.

-- 1700000000036-create-local-deliveries
CREATE TABLE local_deliveries (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  cycle_id            INT UNSIGNED    NOT NULL,
  provider            VARCHAR(32)     NOT NULL DEFAULT 'uber_manual',
  status              VARCHAR(32)     NOT NULL DEFAULT 'requested',
  tracking_url        VARCHAR(512)    NULL,
  failure_reason      VARCHAR(255)    NULL,
  external_id         VARCHAR(191)    NULL,              -- reservado para Uber Direct
  created_by_user_id  BIGINT UNSIGNED NULL,
  requested_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  out_for_delivery_at DATETIME        NULL,
  delivered_at        DATETIME        NULL,
  failed_at           DATETIME        NULL,
  cancelled_at        DATETIME        NULL,
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  open_cycle_id       INT UNSIGNED
    GENERATED ALWAYS AS (CASE WHEN status IN ('requested', 'out_for_delivery') THEN cycle_id ELSE NULL END) STORED,
  UNIQUE KEY uq_local_deliveries_open_cycle (open_cycle_id),
  UNIQUE KEY uq_local_deliveries_provider_external (provider, external_id),
  KEY idx_local_deliveries_cycle (cycle_id, id),
  CONSTRAINT fk_local_deliveries_cycle FOREIGN KEY (cycle_id)
    REFERENCES subscription_production_cycles (id) ON DELETE CASCADE
);
-- down: DROP TABLE local_deliveries;
```

## Risks / Trade-offs

- [Formato do tracking UPS diferente do esperado] → `ups-tracking-status.js` com testes sobre payloads reais do sandbox (fixtures em `tests/`). Um tipo desconhecido não muda o status, só o último evento.
- [`paid_invoice_id` diferente de `ups_shipments.stripe_invoice_id` em ciclos antigos] → O ciclo fica em `none` ("Pronto sem etiqueta"). Um teste de repositório confirma a junção com o mesmo `in_…`. A fila só retém `ready` vencido por `windowDays` dias.
- [Subconsulta `MAX(id)` por linha da fila] → Índice `(cycle_id, id)`. A fila é paginada (≤ 100) e o volume de ciclos é baixo. Medir com `EXPLAIN` na tarefa 4.3.
- [Pico de "Pronto sem etiqueta" no deploy, porque ciclos `ready` dos últimos `windowDays` dias voltam à fila] → Faseado por mercado (D5). O operador pode filtrar e registrar. Ver Perguntas em aberto.
- [Rajada de e-mails `delivered` no primeiro ciclo do job, para envios entregues antes do deploy] → O job só envia `delivered` para envios com `shipped_at` depois do deploy do bloco 3 (constante de corte configurável). Os anteriores ganham `delivered` sem e-mail.
- [E-mail falha depois do aviso de atraso] → O aviso vale e `email_failed` aparece na timeline. A UI mostra "E-mail não enviado" e permite reavisar com confirmação.
- [Cascata apaga histórico ao remover assinatura] → Comportamento aceito. Mesmo efeito já existente para o ciclo.

## Migration Plan

1. Cada bloco de `tasks.md` tem a própria migração e só lê colunas criadas por ela ou antes.
2. Ordem de deploy por bloco: backend (migração + API) e depois painel. O painel tolera campos ausentes (`fulfillment`, `delay`, `cycleId` opcionais) para o caso de um deploy fora de ordem.
3. Rollback por bloco: reverter o deploy do painel e do backend e rodar o `down` da migração do bloco. O `down` de `1700000000035` volta `delivered` para `created` antes de remover colunas. Os `down` de `cycle_events` e `local_deliveries` descartam histórico e tentativas. Exportar as tabelas antes, se houver dado de produção.
4. Nenhum backfill. `delay_notice_count` começa em 0.

## Open Questions

Perguntas que a operação pode responder sem mudar specs nem tarefas (os valores entram em constantes ou textos):

- **Momento do e-mail `shipped`**: hoje sai na compra da etiqueta, antes da coleta. Mover para o primeiro `in_transit` fica para outra mudança. Confirmar se a operação quer isso.
- **Processo atual do Uber no BR**: quem chama o Uber, se o link de rastreio é copiado do app, se há prova de entrega e quem marca "entregue". Isso define se `trackingUrl` é obrigatório (hoje opcional) e o texto do `out_for_delivery`.
- **Lista de motivos de atraso** (`DELAY_REASONS`). Proposta inicial: `ingredient_shortage` (falta de ingrediente), `kitchen_capacity` (capacidade da cozinha), `quality_hold` (lote retido por qualidade), `carrier_delay` (atraso da transportadora), `weather` (clima), `other` (outro).
- **Política de exceção para perecível**: prazo para decidir entre reenviar e reembolsar, quem recebe o alerta (`opsEmails` atual ou outra lista) e se `exception` deve bloquear um novo aviso de atraso.
- **Pico inicial de "Pronto sem etiqueta"**: aceitável, ou o deploy do bloco 3 deve marcar envios antigos de outra forma?
- **Dicas de armazenamento** do e-mail `delivered`: texto aprovado em pt-BR e en-US (geladeira, freezer, validade depois de descongelado).
