## Purpose

Registra a entrega local no Brasil, hoje feita por Uber e marcada à mão pelo operador, com status e transições pensados para a futura integração com o Uber Direct.

## ADDED Requirements

### Requirement: Operadores registram envio local de ciclo BR pronto

Quem tem `shipping.write` MUST registrar um envio local em `POST /api/v1/admin/production/cycles/:cycleId/local-deliveries`, com `trackingUrl` opcional (URL `https`). O ciclo MUST ser do mercado BR, pago e `ready`. O registro MUST começar como `requested`, com provider `uber_manual`. Um ciclo MUST ter no máximo uma entrega aberta (`requested` ou `out_for_delivery`) e MUST NOT ganhar nova entrega depois de uma `delivered`.

#### Scenario: Registro válido

- **WHEN** um operador registra envio de um ciclo BR pago e `ready`
- **THEN** a resposta é 201, a entrega está `requested`, o status de envio do ciclo é `awaiting_pickup` e há um evento `fulfillment_changed`

#### Scenario: Ciclo dos EUA

- **WHEN** o ciclo pertence ao mercado dos EUA
- **THEN** a resposta é 422 e nada é gravado

#### Scenario: Já existe entrega aberta

- **WHEN** o ciclo já tem entrega `requested` ou `out_for_delivery`
- **THEN** a resposta é 409 e nada é gravado

### Requirement: Transições fechadas da entrega local

`PATCH /api/v1/admin/local-deliveries/:id` com `shipping.write` MUST aceitar só estas transições: `requested` → `out_for_delivery`, `failed` ou `cancelled`; `out_for_delivery` → `delivered` ou `failed`. Qualquer outra MUST ser recusada com 409. `failed` MUST exigir `failureReason` de 1 a 255 caracteres. Cada transição MUST gravar o horário dela e um evento `fulfillment_changed`.

#### Scenario: Caminho feliz

- **WHEN** o operador move a entrega para `out_for_delivery` e depois para `delivered`
- **THEN** as duas mudanças são aceitas e o status de envio do ciclo termina em `delivered`

#### Scenario: Pular etapa

- **WHEN** o operador tenta mover de `requested` direto para `delivered`
- **THEN** a resposta é 409 e a entrega não muda

#### Scenario: Falha sem motivo

- **WHEN** o operador marca `failed` sem `failureReason`
- **THEN** a resposta é 400 e a entrega não muda

### Requirement: Reenvio cria novo registro

Depois de `failed` ou `cancelled`, um novo envio do mesmo ciclo MUST criar um novo registro e MUST manter o anterior sem alteração. O status de envio do ciclo MUST seguir o registro mais recente.

#### Scenario: Reenvio após falha

- **WHEN** a entrega de um ciclo falhou e o operador registra um novo envio
- **THEN** existem dois registros, o antigo `failed` e o novo `requested`, e o status de envio do ciclo é `awaiting_pickup`

### Requirement: Cliente BR é avisado da saída para entrega

Quando uma entrega local passa a `out_for_delivery`, o cliente MUST receber o e-mail `out_for_delivery` em `pt-BR`, com o link de rastreio quando houver, no máximo uma vez por registro de entrega. O envio MUST gravar `email_sent` ou `email_failed`.

#### Scenario: Saiu para entrega

- **WHEN** o operador marca uma entrega com link de rastreio como `out_for_delivery`
- **THEN** o cliente recebe um e-mail em português com o link e a timeline mostra `email_sent` com template `out_for_delivery`

### Requirement: Status preparados para integração futura

Os status de entrega local MUST ser os mesmos para qualquer provider. O registro MUST ter um identificador externo opcional, único por provider, reservado para a integração com o Uber Direct. Hoje só `uber_manual` MUST ser aceito.

#### Scenario: Provider desconhecido

- **WHEN** uma requisição informa um provider diferente de `uber_manual`
- **THEN** a resposta é 400 e nada é gravado
