# Design

## Context

Ver proposal.md (Why). O painel é React + Vite e fala só com `/api/v1`. A proteção por permissão e mercado está na API (`requirePermission`, escopo `query`/`record`); o painel só esconde e filtra. A fila de produção (`ProductionQueuePage`) já guarda os filtros na URL com `useSearchParams` e `productionQueueHref`, e esse é o padrão a copiar. A sessão traz `markets` de `/admin/me`, que fica vazio para um operador sem mercado gravado, embora a API o trate como dos dois mercados enquanto `ADMIN_ENFORCE_STAFF_MARKET` está desligada.

Este change tem um irmão na API com o mesmo nome. A parte do painel funciona antes do irmão estar no ar, com as degradações descritas abaixo.

## Goals / Non-Goals

**Goals:**

- Cada atalho de Hoje cai na tela onde a ação acontece, já filtrada.
- Nenhum texto manda o operador fazer o que ele não pode ou não deve (preencher nome da conta, reescrever endereço).
- Filtros de quatro telas sobrevivem a links e ao botão voltar.

**Non-Goals:**

- Nenhuma trava nova: o despacho, a etiqueta, a NF-e e a edição de endereço continuam aceitando e recusando o que aceitam hoje.
- Hoje não ganha contagens de courier, NF-e ou endereço (PM-26, lote 2).
- "Expedir" não mostra se o pedido já foi expedido. A fila não tem esse dado; ele vem com PM-13 no lote 2 ou com `fulfillmentStatus` do change `add-fulfillment-tracking-and-delay-notices`.
- Nenhum registro de contato pelo WhatsApp (PM-17, lote 2). Os textos só dizem que o contato é pelo WhatsApp.

## Decisions

**Filtros na URL com nomes em português e um helper por tela.** A fila já usa `prazo`, `mercado`, `busca`. As telas novas seguem: `status`, `conta`, `busca`, `pagina`, `de`, `ate`, `aba`, `janela`, `situacao`. Cada tela ganha uma função `...Href(filters)` ao lado de `productionQueueHref`, e Hoje e o detalhe da NF-e montam os links por elas. Alternativa: guardar no `localStorage`. Descartada: não resolve o link de Hoje e diverge da fila.

**"Precisam de ação" como valor de URL próprio.** A URL leva `status=needs_action` e a requisição leva os três status separados por vírgula, que o irmão da API passa a aceitar. Sem o irmão no ar, a API recusa a lista com `422` (`invalid_nfe_filters`, porque a lista passa do limite de 32 caracteres): o painel mostra o erro no `div.alert`, sem quebrar os outros filtros. Por isso o painel só entra depois do irmão (ver Migration Plan).

**Link da NF-e para a assinatura pela busca de Assinantes.** O detalhe da NF-e tem `stripe_subscription_id`, mas a rota da assinatura no painel usa o id local numérico, que a nota não traz. A busca de Assinantes já casa `stripe_subscription_id`, então o link é `/billing?busca=<sub>&status=all`. Alternativa: a API devolver o id local no detalhe da nota. Fica para quando houver outro motivo de mexer em `presentDetail`; o link atual custa um clique a mais.

**"Expedir" decide pela conta e pelo país do item.** A fila de courier filtra pelo país do endereço e a de etiquetas pela conta `us`. Exigir os dois iguais garante que o pedido está na tela aberta. O caso divergente mostra "Mercado divergente", sem link, até a fila de exceção (PM-21). Alternativa: decidir só pelo país. Descartada: num cruzado US com endereço BR, abriria Etiquetas UPS sem o pedido.

**Atualização da NF-e em dois ritmos.** Hoje o detalhe recarrega a cada 60 s fixo. O intervalo passa a depender do status carregado: 5 s em `pending`/`submitted`, 60 s no resto. O job do Bling roda a cada 60 s; 5 s é só para o resultado aparecer logo após a virada, sem carga relevante.

**Motivo obrigatório só no painel.** O painel exige 3 a 255 caracteres; a API aceita `reason` opcional e o grava na auditoria. Assim o painel antigo continua funcionando durante o deploy, e a API não passa a recusar um corpo que aceitava. Alternativa: exigir na API. Descartada para este lote, que não muda o que o sistema aceita.

**Mercados efetivos com fallback.** O menu usa `effectiveMarkets` quando vem; sem ele, `markets`; com os dois vazios, mostra tudo (comportamento atual). Assim o painel novo funciona contra a API antiga, e o operador sem mercado não perde o card UPS nem os itens. A tela de outro mercado só bloqueia quando a lista efetiva é conhecida e não inclui o mercado.

**Textos de bloqueio de etiqueta sem citar e-mail nem contato registrado.** O e-mail de endereço inválido (PM-24) e o registro de contato (PM-17) não existem ainda. O texto diz só onde o cliente corrige e que o próximo passo do operador é o WhatsApp. Quando PM-24 entrar, o texto ganha a data do e-mail.

## Risks / Trade-offs

- [Conflito com `add-fulfillment-tracking-and-delay-notices`, que também troca a ação da linha `ready`] → "Expedir" é uma troca de um texto por um link, sem dado novo. Quem aplicar o outro change substitui este requisito pela ação por mercado dele. Esse change propõe `local_deliveries`, que a API já substituiu por `courier_deliveries` (change arquivado `br-courier-delivery`); ele precisa ser revisto antes do apply de qualquer forma.
- ["Expedir" aparece em pedido já expedido] → O destino mostra o pedido na aba ou seção certa (Em rota, Entregues, etiqueta criada), então o operador vê o estado ao chegar. O estado na própria linha fica para o lote 2.
- [Contador do card "Sem etiqueta UPS" ≠ tamanho de Etiquetas UPS] → O card conta os prontos da janela de Hoje; a fila lista 30 dias de ciclos pagos, prontos ou não. O texto do card passa a dizer "prontos hoje sem etiqueta".
- [A sugestão de contagem inicial usa "nenhum movimento no mercado"] → Uma contagem que bate com o saldo não grava movimento, então um mercado contado com tudo zerado continuaria vendo a sugestão. Aceitável: a sugestão some no primeiro lançamento de produção.
- [Operador sem mercado, com `ADMIN_ENFORCE_STAFF_MARKET` ligada] → A API recusa as rotas com `market_required` e `effectiveMarkets` vem vazio. O menu mostra tudo, como hoje, e as telas mostram o erro da API. X-02 decide se esse caso existe.

## Migration Plan

1. Subir o irmão da API (aceita `reason`, lista de status, busca por nome, `effectiveMarkets`). Nada no painel atual quebra: os campos são aditivos.
2. Subir o painel.
3. Rollback: reverter o painel. A API pode ficar, porque só aceita mais.

`contracts/backend-routes.json` não muda: nenhuma rota é criada, renomeada ou removida.
