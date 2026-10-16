## Purpose

Permite ao operador avisar o cliente de que um ciclo vai atrasar, com motivo, nova data e confirmação, e registra o aviso como condição paralela ao status de produção.

## ADDED Requirements

### Requirement: Operadores avisam atraso de um ciclo pago

Quem tem `production.write` MUST registrar um aviso de atraso em `POST /api/v1/admin/production/cycles/:cycleId/delay-notices` com `reason` (de uma lista fechada), `newDate` (`YYYY-MM-DD`) e `message` opcional. `newDate` MUST ser posterior a hoje no fuso do mercado do ciclo. `message` MUST ter no máximo 500 caracteres depois de aparado. O ciclo MUST estar pago e não entregue.

#### Scenario: Aviso válido

- **WHEN** um operador avisa atraso de um ciclo pago `in_production` com motivo `ingredient_shortage` e nova data amanhã
- **THEN** a resposta é 201, o ciclo guarda a nova data, o horário do aviso e a contagem 1, e um evento `delay_notified` registra motivo, nova data e texto

#### Scenario: Data no passado ou hoje

- **WHEN** `newDate` é hoje ou anterior no fuso do mercado
- **THEN** a resposta é 400 e nada é gravado

#### Scenario: Motivo fora da lista

- **WHEN** `reason` não está na lista de motivos
- **THEN** a resposta é 400 e nada é gravado

#### Scenario: Ciclo não pago ou entregue

- **WHEN** o ciclo aguarda pagamento, ou o status de envio é `delivered`
- **THEN** a resposta é 409 e nada é gravado

#### Scenario: Sem permissão de escrita

- **WHEN** um usuário sem `production.write` envia o aviso
- **THEN** a resposta é 403 e nada é gravado

### Requirement: Atraso é condição paralela ao status

O aviso de atraso MUST NOT mudar o status de produção nem o status de envio. O ciclo MUST expor a data prometida mais recente, o horário do último aviso e a quantidade de avisos. A sequência de eventos `delay_notified` MUST ser a fonte de verdade desses valores.

#### Scenario: Status mantido

- **WHEN** um ciclo `in_production` recebe aviso de atraso
- **THEN** o status continua `in_production` e a fila mostra o selo "Cliente avisado"

### Requirement: Reaviso exige confirmação explícita

Quando o ciclo já tem aviso de atraso, a API MUST responder 409 com código `delay_notice_exists` e os dados do aviso anterior (motivo, nova data, horário, contagem), a menos que o corpo traga `confirmResend: true`. Com a confirmação, o novo aviso MUST ser gravado e enviado como um aviso a mais.

#### Scenario: Reaviso sem confirmação

- **WHEN** um operador envia um segundo aviso sem `confirmResend`
- **THEN** a resposta é 409 `delay_notice_exists` com o aviso anterior e nada muda

#### Scenario: Reaviso confirmado

- **WHEN** o operador reenvia com `confirmResend: true` e uma nova data
- **THEN** a contagem passa a 2, a data prometida é a nova e o cliente recebe um segundo e-mail

### Requirement: E-mail de atraso ao cliente

Cada aviso MUST enviar ao cliente o e-mail `production_delayed` no idioma do mercado (`pt-BR` no BR, `en-US` nos EUA), com motivo legível, nova data e o texto livre, quando houver. Uma falha no envio MUST NOT desfazer o aviso. Ela MUST gravar `email_failed`, e um envio aceito MUST gravar `email_sent`.

#### Scenario: Falha do e-mail mantém o aviso

- **WHEN** o servidor de e-mail recusa o envio do aviso
- **THEN** o aviso continua gravado, a resposta informa que o e-mail não foi enviado e a timeline mostra `email_failed`

### Requirement: Prévia antes de confirmar

O painel MUST mostrar a prévia do e-mail, gerada pela API sem efeito colateral, antes que o operador confirme o aviso. A ação "Avisar atraso" MUST aparecer no menu da linha só para quem tem `production.write`, em ciclos pagos e não entregues.

#### Scenario: Prévia não grava nada

- **WHEN** o operador pede a prévia e fecha o diálogo sem confirmar
- **THEN** nenhum evento é gravado e nenhum e-mail é enviado

#### Scenario: Diálogo de reaviso

- **WHEN** o operador abre "Avisar atraso" num ciclo já avisado
- **THEN** o diálogo mostra o aviso anterior e pede confirmação explícita de reenvio antes de enviar
