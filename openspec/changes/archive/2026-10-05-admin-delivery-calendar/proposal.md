# Proposal

## Why

`redesign-my-plan` guarda os dias fechados na tabela `delivery_closed_days` e preenche Brasil 2026–2027 e o calendário UPS de 2026 por migration; o de 2027 entrou depois, pela migration `1700000000026`. A operação ainda não consegue incluir feriado regional, fechamento pontual nem o ano seguinte da UPS sem deploy. Esta mudança é a tela do painel que edita essa tabela.

## What Changes

- Cada linha passa a ter um tipo: `national` (feriado nacional do Brasil), `regional`, `carrier` (calendário UPS dos EUA) ou `adhoc` (fechamento pontual). A chave única passa a ser mercado + data + tipo, então uma data pode ter uma linha de cada tipo. Um dia fica fechado para preparo, coleta ou entrega se qualquer linha ativa daquela data fechar aquela marcação.
- Listar os dias fechados por mercado (`BR` ou `US`) e por ano, com rótulo, tipo, se está ativa e as três marcações independentes: preparo, coleta e entrega.
- Feriados nacionais do Brasil, fixos e móveis, já aparecem preenchidos em cada ano. A operação pode desativar e reativar um deles (por exemplo, abrir no Carnaval). Feriado nacional nunca é apagado.
- Nos EUA, a operação cadastra o calendário UPS de cada ano quando a UPS publicar, com as marcações de cada dia. 24/12 (só coleta fechada) e 31/12 (coleta e entrega fechadas) são o exemplo de marcações diferentes do feriado que fecha o dia inteiro.
- Feriados regionais e fechamentos pontuais podem ser adicionados e removidos. No Brasil, regional é na prática Curitiba e Paraná, porque a entrega fica num raio de 40 km de Curitiba. Nos EUA, regional é o estado da cozinha. Fechamento pontual cobre manutenção, falta de energia e casos parecidos. Remover um pontual não reabre a data se houver outra linha ativa nela, como o `national` (BR) ou o `carrier` (US) de 01/01/2028.
- Qualquer linha pode ser desativada e reativada, e suas marcações podem ser alteradas.
- Antes de salvar algo que fecha um dia, mostrar as assinaturas com entregas afetadas, indicando as travadas. Na confirmação:
  - Se houver entrega travada (`in_production`, `ready`, `blocked` ou depois do `editable_until`), o fechamento é recusado.
  - As editáveis vão para o próximo dia válido de preparo.
  - Fechamento, remarcações, auditoria e uma linha pendente de sincronização com o Stripe por assinatura são salvos numa única transação. Se algo falhar, nada é salvo.
- Um job aplica o novo `trial_end` no Stripe a partir dessas linhas, com retentativas idempotentes. Não sobrescreve um `trial_end` que mudou depois do fechamento. O painel mostra sincronizações atrasadas e, juntas, as com falha ou em conflito, com a data esperada, a data alvo e, no conflito, a data encontrada no Stripe. Quem tem `production.write` pode reenviar uma sincronização com falha ou em conflito; antes de reenviar um conflito a tela mostra os dois valores. O reenvio fica na auditoria.
- Remover, desativar ou desligar uma marcação só abre a data. Não altera entregas já agendadas.
- Registrar cada inclusão, remoção, ativação, desativação e mudança de marcação: quem fez, quando, valor anterior e novo, e as assinaturas remarcadas. O histórico aparece no painel.
- Alertas sem bloqueio: fechamento a menos de 7 dias da data; e faltar menos de 90 dias para o fim do último ano UPS cadastrado nos EUA.
- Quem edita: os perfis com `production.write` (`admin` e `operator`), os mesmos que controlam a fila de produção. `readonly` vê sem controles de escrita.
- O cliente não acessa esta tela. Ele vê só o resultado no calendário do Meu Plano.

## Capabilities

### New Capabilities

- `operations/delivery-calendar`: calendário de dias fechados por mercado e tipo, editado no painel, com prévia e remarcação das entregas afetadas, sincronização do `trial_end` com o Stripe, histórico e alertas.

### Modified Capabilities

- Nenhuma. `operations/production-queue` continua a fila de status (`to_prepare`, `in_production`, `ready`, `blocked`) e não ganha requisito novo; o calendário só lê esses status para saber se uma entrega está travada. `operations/admin-market-scope` e `operations/admin-panel-copy` continuam valendo: a tela usa o mercado da sessão e o texto do operador fica em português.

## Impact

- API (`eden-bowls-backend`):
  - Migration que adiciona `type` em `delivery_closed_days`, preenche a partir de `origin` e troca a chave única para (`market`, `closed_on`, `type`).
  - Migration da tabela de sincronização `delivery_calendar_stripe_syncs` e um job novo no scheduler existente.
  - Endpoints de leitura, prévia, escrita, histórico, sincronizações e alertas.
  - Histórico pelo `AdminAuditService`, o mesmo usado em `production.status.update`. A prévia e a remarcação usam a projeção de entregas do Meu Plano, porque as entregas seguintes não são linhas próprias.
- Painel (`eden-bowls-admin`): página nova em Operação, no mesmo shell de Produção (`PageFrame`, `FiltersBar`, `Dialog`, `apiRequest`), com lista, diálogos de inclusão e prévia, histórico e alertas.
- Loja (`eden-bowls`): sem tela nova. O calendário do Meu Plano passa a refletir as linhas ativas da tabela e as datas remarcadas.
- Fora desta mudança:
  - Regras semanais (domingo fechado no Brasil; preparo de segunda a sexta nos EUA), que permanecem em `redesign-my-plan`.
  - Geração automática do ano brasileiro sem linhas nacionais e fallback dos EUA sem linhas, que também permanecem em `redesign-my-plan`.
