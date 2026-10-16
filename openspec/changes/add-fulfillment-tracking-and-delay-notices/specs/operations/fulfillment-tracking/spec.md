## Purpose

Deriva o status de envio de cada ciclo a partir da UPS e da entrega local, mantém trânsito e entrega da UPS atualizados e avisa cliente e operação quando o envio muda.

## ADDED Requirements

### Requirement: Status de envio derivado do envio mais recente não anulado

O sistema SHALL derivar o status de envio de um ciclo pago, sem armazená-lo no ciclo. Se o ciclo tiver entrega local, a mais recente MUST definir o status: `requested` → `awaiting_pickup`, `out_for_delivery` → `in_transit`, `delivered` → `delivered`, `failed` → `exception`, `cancelled` → `none`. Senão, o envio UPS não anulado da fatura paga do ciclo MUST definir o status: `pending` ou `created` → `awaiting_pickup`, `created` com trânsito confirmado pela UPS → `in_transit`, `delivered` → `delivered`, `unknown` → `exception`. Sem envio, ou só com envios `voided`, o status MUST ser `none`.

#### Scenario: Etiqueta anulada

- **WHEN** o único envio UPS da fatura do ciclo está `voided`
- **THEN** o status de envio é `none`

#### Scenario: Resultado incerto da UPS

- **WHEN** o envio UPS do ciclo está `unknown`
- **THEN** o status de envio é `exception`

#### Scenario: Etiqueta criada

- **WHEN** o envio UPS do ciclo está `created` e a UPS ainda não registrou coleta
- **THEN** o status de envio é `awaiting_pickup`

### Requirement: Rastreio UPS atualiza trânsito e entrega

O job de rastreio e o botão de atualizar rastreio MUST interpretar a resposta da UPS. Um evento de entrega MUST marcar o envio como `delivered` e guardar o horário. Um evento de coleta ou trânsito MUST marcar trânsito. Qualquer outro tipo, inclusive exceção, MUST só atualizar a descrição e o horário do último evento, sem mudar o status de envio. Cada primeira passagem para trânsito ou entrega MUST gravar `fulfillment_changed` no ciclo da fatura.

#### Scenario: UPS informa entrega

- **WHEN** o job consulta um envio `created` e a UPS devolve um evento de entrega
- **THEN** o envio fica `delivered`, o ciclo mostra status de envio `delivered` e há um evento `fulfillment_changed` de `in_transit` (ou `awaiting_pickup`) para `delivered`

#### Scenario: UPS informa exceção

- **WHEN** a UPS devolve um evento de exceção
- **THEN** o último evento mostra a descrição da UPS e o status de envio não muda

### Requirement: E-mail de entrega uma vez por ciclo

Quando o status de envio de um ciclo passa a `delivered`, nos EUA ou no BR, o cliente MUST receber o e-mail `delivered` no idioma do mercado, com dicas de armazenamento. O e-mail MUST ser enviado no máximo uma vez por ciclo, mesmo com reprocessamento ou nova tentativa de entrega. O envio MUST gravar `email_sent` ou `email_failed`. Envios despachados antes da ativação desta regra MUST NOT gerar o e-mail.

#### Scenario: Entrega repetida não repete o e-mail

- **WHEN** o job processa a mesma entrega duas vezes
- **THEN** o cliente recebe um único e-mail `delivered`

#### Scenario: Envio anterior à ativação

- **WHEN** um envio comprado antes da ativação é marcado como entregue
- **THEN** o status de envio vira `delivered` e nenhum e-mail é enviado

### Requirement: Exceção gera só alerta interno

Quando o status de envio de um ciclo passa a `exception`, o sistema MUST enviar um alerta interno aos endereços de operação configurados e MUST NOT enviar e-mail ao cliente. A decisão de reenviar ou reembolsar é do operador.

#### Scenario: Entrega local falha

- **WHEN** uma entrega local passa a `failed`
- **THEN** a operação recebe o alerta interno, o cliente não recebe e-mail e a fila conta o ciclo em "Exceções de entrega"

### Requirement: E-mail de despacho permanece como está

O e-mail `shipped` MUST continuar sendo enviado como hoje, quando a etiqueta UPS é comprada. O envio dele MUST gravar `email_sent` ou `email_failed` no ciclo da fatura, quando esse ciclo existir.

#### Scenario: Etiqueta comprada pela fila

- **WHEN** um operador gera a etiqueta UPS pela fila
- **THEN** o cliente recebe o mesmo e-mail `shipped` de hoje e a timeline mostra `fulfillment_changed` para `awaiting_pickup` e `email_sent` com template `shipped`
