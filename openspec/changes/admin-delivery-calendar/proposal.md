# Proposal

## Why

`redesign-my-plan` guarda os dias fechados na tabela `delivery_closed_days` e preenche Brasil 2026–2027 e o calendário UPS de 2026 por migration. A operação ainda não consegue incluir feriado regional, fechamento pontual nem o ano seguinte da UPS sem deploy. Esta mudança é a tela do painel que edita essa tabela.

## What Changes

- Listar os dias fechados por mercado (`BR` ou `US`) e por ano, com rótulo, origem e as três marcações independentes: preparo, coleta e entrega.
- Feriados nacionais do Brasil, fixos e móveis, já aparecem preenchidos em cada ano. A operação pode desativar um deles (por exemplo, abrir no Carnaval). Não pode apagar a regra.
- Nos EUA, a operação cadastra o calendário UPS de cada ano quando a UPS publicar, com as marcações de coleta e entrega. 24/12 e 31/12 são o exemplo: marcações diferentes do feriado que fecha o dia inteiro.
- Feriados regionais e fechamentos pontuais podem ser adicionados e removidos. No Brasil, regional é na prática Curitiba e Paraná, porque a entrega fica num raio de 40 km de Curitiba. Nos EUA, regional é o estado da cozinha. Fechamento pontual cobre manutenção, falta de energia e casos parecidos.
- Registrar quem adicionou, alterou, desativou ou removeu cada data, e quando.
- Antes de salvar um fechamento novo, mostrar as assinaturas com entregas afetadas por aquela data.
- Remover ou desativar um fechamento só abre a data. Não altera entregas já agendadas.
- O cliente não acessa esta tela. Ele vê só o resultado no calendário do Meu Plano.

O que acontece com uma entrega já agendada num dia que passa a fechar, quem pode editar, se há antecedência mínima e se a operação é avisada quando falta o calendário UPS do ano seguinte ficam em aberto no design. Não entram como comportamento desta proposal.

## Capabilities

### New Capabilities

- `operations/delivery-calendar`: calendário de dias fechados por mercado, editado no painel, com histórico e a lista de assinaturas afetadas antes de um fechamento novo.

### Modified Capabilities

- Nenhuma. `operations/production-queue` continua a fila de status (`to_prepare`, `in_production`, `ready`, `blocked`) e não ganha requisito novo. `operations/admin-market-scope` e `operations/admin-panel-copy` continuam valendo: a tela usa o mercado da sessão e o texto do operador fica em português. O efeito sobre entregas já agendadas não muda esses specs; está em aberto no design.

## Impact

- Painel (`eden-bowls-admin`): página nova em Operação, no mesmo shell de Produção (`PageFrame`, `FiltersBar`, `Dialog`, `apiRequest`). Rota, menu e testes da página esperam as perguntas em aberto.
- API (`eden-bowls-backend`): leitura e escrita de `delivery_closed_days`, tabela criada em `redesign-my-plan`. Histórico pelo `AdminAuditService`, o mesmo usado em `production.status.update`. A lista de assinaturas afetadas usa a projeção de entregas do Meu Plano, porque as entregas seguintes não são linhas próprias.
- Loja (`eden-bowls`): sem tela nova. O calendário do Meu Plano passa a refletir as linhas ativas da tabela.
- Fora desta mudança: regras semanais (domingo fechado no Brasil; preparo de segunda a sexta nos EUA), geração automática do ano brasileiro sem linhas nacionais e o fallback dos EUA sem linhas. Isso permanece em `redesign-my-plan`.
