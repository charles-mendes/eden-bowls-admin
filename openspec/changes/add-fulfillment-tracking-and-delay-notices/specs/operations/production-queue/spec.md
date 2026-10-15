## MODIFIED Requirements

### Requirement: Civil window includes today even after the UTC timestamp

The system SHALL default `windowDays` to 7 and MUST accept 7, 14, or 30. Window membership MUST use the cycle's due date in civil dates of the query timezone (default `America/Sao_Paulo`). An unpaid cycle is due on its charge; a paid cycle is due on its preparation day, the first valid day of the market whose local midnight is at or after the payment. In-window rows are due today through today + `windowDays` days, inclusive of today even when the due instant is already earlier than UTC now. Query `includeOverdue` defaults to true. When true, overdue rows are those whose civil due date is before today, that are either not `ready` or `ready` with a fulfillment status other than `delivered`, and whose due date is not older than `windowDays` before today. `includeOverdue=0` MUST omit overdue rows and MUST NOT omit civil-today rows. When Stripe advances `current_period_end`, a paid cycle MUST stay listed by its own due date; only the unpaid renewal moves.

#### Scenario: Default 7-day civil window

- **WHEN** an operator loads the queue with no window query
- **THEN** in-window rows are those whose civil due date is today through 7 days ahead in the query timezone

#### Scenario: Period end earlier today is still today

- **WHEN** an unpaid cycle's charge is earlier than UTC now but still today's civil date in `America/Sao_Paulo`
- **THEN** the row is in the queue, `dueBucket` is `today`, and `includeOverdue=0` does not hide it

#### Scenario: Overdue capped and optional

- **WHEN** `includeOverdue` is true and a non-ready cycle's civil due date is 3 days before today with `windowDays=7`
- **THEN** it appears as overdue; a non-ready row 10 days before today does not; `includeOverdue=0` hides overdue rows

#### Scenario: Renewal advances the period end

- **WHEN** a cycle is paid and the ledger moves `current_period_end` to the next renewal
- **THEN** the paid cycle stays in the queue by its preparation day until it is ready, and the next renewal appears as awaiting payment when it enters the window

#### Scenario: Ciclo pronto em trânsito continua como atrasado

- **WHEN** a data de preparo de um ciclo `ready` foi há 2 dias, com `windowDays=7`, e o status de envio é `in_transit`
- **THEN** a linha continua na fila como atrasada até o status de envio ser `delivered`

#### Scenario: Ciclo pronto entregue sai depois do seu dia

- **WHEN** a data de preparo de um ciclo `ready` foi ontem e o status de envio é `delivered`
- **THEN** a linha não está na fila

## ADDED Requirements

### Requirement: Itens da fila expõem status de envio derivado

Cada item da fila MUST trazer `fulfillment.status` com um destes valores: `none`, `awaiting_pickup`, `in_transit`, `delivered`, `exception`. O valor é derivado na leitura a partir dos registros de envio do ciclo e nunca é armazenado no ciclo. Um ciclo não pago MUST ser `none`. O item MUST trazer também `cycleId` (nulo quando não há linha de ciclo), `paidInvoiceId`, `deliveryDate` e, em `fulfillment`, transportadora, código de rastreio, URL de rastreio, descrição e horário do último evento.

#### Scenario: Ciclo não pago não tem envio

- **WHEN** a fila lista uma renovação não paga
- **THEN** `fulfillment.status` é `none` e os campos de rastreio são nulos

#### Scenario: Envio não é status de produção

- **WHEN** o envio UPS de um ciclo é entregue
- **THEN** `productionStatus` continua `ready` e só `fulfillment.status` muda para `delivered`

### Requirement: Operadores filtram a fila por envio

`GET /api/v1/admin/production/queue` MUST aceitar `fulfillment` com `ready_unshipped`, `in_transit` ou `exception`, e MUST recusar outros valores com 400. `ready_unshipped` MUST trazer ciclos `ready` com status de envio `none`. Os outros valores MUST trazer o status de envio de mesmo nome. O filtro MUST ser aplicado na consulta ao banco, junto com a paginação.

#### Scenario: Pronto sem etiqueta

- **WHEN** um operador filtra com `fulfillment=ready_unshipped`
- **THEN** só aparecem ciclos `ready` com status de envio `none`, incluindo os que só têm envio UPS anulado

#### Scenario: Filtro de envio inválido

- **WHEN** alguém envia `fulfillment=shipped`
- **THEN** a resposta é 400 e nenhuma fila é devolvida

### Requirement: Métricas da fila contam trabalho de envio

As `metrics` da fila MUST incluir `readyAwaitingShipment` (ciclos `ready` com status de envio `none` ou `awaiting_pickup`) e `deliveryExceptions` (ciclos com status de envio `exception`). As duas MUST respeitar `windowDays`, `account` e `includeOverdue`, e MUST ignorar `q`, `productionStatus` e `fulfillment`, como as contagens de prazo existentes.

#### Scenario: Métricas ignoram o filtro de envio

- **WHEN** a grade está filtrada por `fulfillment=in_transit` e outros dois ciclos da janela estão com status de envio `exception`
- **THEN** `metrics.deliveryExceptions` é 2

### Requirement: Tela de Produção mostra o envio e a próxima ação de envio

A página Produção MUST mostrar a coluna "Envio" com a transportadora, um link de rastreio clicável quando houver e o último evento. Num ciclo pago `ready` com status de envio `none`, quem tem `shipping.write` MUST ver "Gerar etiqueta" numa linha dos EUA e "Registrar envio" numa linha do BR. "Gerar etiqueta" compra a etiqueta UPS da fatura paga do ciclo pelo fluxo de envio existente. A página MUST incluir os filtros "Pronto sem etiqueta", "Em trânsito" e "Com exceção" e os cards "Prontos aguardando envio" e "Exceções de entrega". `readonly` e quem não tem `shipping.write` MUST NOT ver ações de envio.

#### Scenario: Linha EUA pronta oferece etiqueta

- **WHEN** um operador com `shipping.write` vê um ciclo EUA pago, `ready` e sem envio
- **THEN** a ação principal da linha é "Gerar etiqueta"; depois do sucesso, a coluna Envio mostra UPS, o código de rastreio com link para a página de rastreio da UPS e o status "Aguardando coleta"

#### Scenario: Linha BR pronta oferece entrega manual

- **WHEN** um operador com `shipping.write` vê um ciclo BR pago, `ready` e sem entrega
- **THEN** a ação principal da linha é "Registrar envio"

#### Scenario: Readonly só vê o estado do envio

- **WHEN** um usuário `readonly` abre Produção
- **THEN** a coluna Envio, os filtros novos e os cards novos aparecem, e "Gerar etiqueta", "Registrar envio" e "Avisar atraso" não aparecem

### Requirement: Linhas da fila mostram selos de atraso

Uma linha MUST mostrar "Atrasado" quando está atrasada e não está `ready`, ou quando a data de entrega é anterior a hoje e o status de envio não é `delivered`. Uma linha com aviso de atraso MUST mostrar "Cliente avisado · nova data DD/MM" com a data do aviso mais recente. Quando essa data for anterior a hoje e o status de envio não for `delivered`, o selo MUST usar o tom de erro para marcar urgência.

#### Scenario: Atraso avisado

- **WHEN** um ciclo tem aviso de atraso com nova data 2026-10-20 e hoje é 2026-10-16
- **THEN** a linha mostra "Cliente avisado · nova data 20/10" no tom de alerta

#### Scenario: Data prometida venceu

- **WHEN** o mesmo ciclo não foi entregue e hoje é 2026-10-21
- **THEN** o selo usa o tom de erro
