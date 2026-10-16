## Purpose

Guarda o histórico append-only de cada ciclo de produção (mudanças de status, avisos de atraso, envio e e-mails) e mostra esse histórico ao operador no painel.

## ADDED Requirements

### Requirement: Cada mudança do ciclo grava um evento na mesma transação

O sistema MUST gravar um evento de ciclo para cada fato que altera um ciclo de produção. O evento MUST ser gravado na mesma transação de banco da mudança, de modo que a mudança e o evento sejam confirmados juntos ou falhem juntos. Os tipos MUST ser `production_status_changed`, `blocked`, `reopened`, `note_updated`, `delay_notified`, `fulfillment_changed`, `email_sent` e `email_failed`. Cada evento MUST registrar o tipo, o autor (`admin` com usuário e e-mail, ou `system`), um payload JSON e a data.

#### Scenario: Bloqueio grava evento

- **WHEN** um operador bloqueia um ciclo com a nota "Falta de frango"
- **THEN** o ciclo fica `blocked` e existe um evento `blocked` com autor `admin`, `from`, `to` e a nota

#### Scenario: Falha ao gravar o evento desfaz a mudança

- **WHEN** a inserção do evento falha durante uma mudança de status
- **THEN** o status do ciclo não muda e a API responde com erro

#### Scenario: Reabrir grava `reopened`

- **WHEN** um operador move um ciclo de `blocked` para `to_prepare`, ou de `ready` para `in_production`
- **THEN** o evento gravado é `reopened`

#### Scenario: Job grava como sistema

- **WHEN** o job de rastreio marca um envio como entregue
- **THEN** o evento `fulfillment_changed` tem autor `system` e nenhum usuário

### Requirement: Eventos são append-only

O sistema MUST NOT alterar nem apagar eventos de ciclo por nenhuma rota ou job. Um evento só MUST deixar de existir quando o próprio ciclo for removido junto com a assinatura.

#### Scenario: Correção vira novo evento

- **WHEN** um operador muda a nota de um ciclo já anotado
- **THEN** o evento antigo permanece e um novo evento `note_updated` registra o valor anterior e o novo

### Requirement: Eventos de e-mail não guardam conteúdo

Eventos `email_sent` e `email_failed` MUST registrar só o template, o idioma (`en-US` ou `pt-BR`) e a referência do envio. Eles MUST NOT guardar assunto, corpo nem endereço do destinatário.

#### Scenario: E-mail de envio na timeline

- **WHEN** a etiqueta UPS de um ciclo é comprada e o e-mail `shipped` é enviado
- **THEN** o ciclo tem um evento `email_sent` com template `shipped` e idioma `en-US`, sem corpo nem destinatário

### Requirement: Operadores consultam a timeline do ciclo

Quem tem `production.read` MUST obter os eventos de um ciclo em `GET /api/v1/admin/production/cycles/:cycleId/events`, do mais recente para o mais antigo, com no máximo 200 itens. A equipe de um só mercado MUST receber 403 para ciclos do outro mercado. A fila MUST oferecer "Histórico" no menu da linha quando o ciclo tem `cycleId`, abrindo um painel lateral com data, autor e descrição legível de cada evento.

#### Scenario: Readonly vê o histórico

- **WHEN** um usuário `readonly` escolhe "Histórico" numa linha
- **THEN** o painel lateral lista os eventos do ciclo sem nenhuma ação de escrita

#### Scenario: Ciclo de outro mercado

- **WHEN** um operador do BR pede os eventos de um ciclo dos EUA
- **THEN** a resposta é 403

#### Scenario: Renovação sem ciclo gravado

- **WHEN** uma linha não paga ainda não tem linha de ciclo
- **THEN** "Histórico" não aparece no menu
