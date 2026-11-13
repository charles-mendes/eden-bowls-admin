# Design

## Context

Ver proposal.md. O backend expõe `upsLabel: 'unresolved'`, o bloco `fulfillment` e `lastContact` em `/admin/today`; `failure_kind` e os campos novos da fila do courier; `409 ups_label_needs_confirmation`; `GET /admin/billing/subscriptions/:id/paid-cycles`; e `GET/POST …/contacts`. Etiquetas UPS já confirma no front com os dados da fila (`window.confirm`); o detalhe da assinatura não confirma. "Envio UPS" e "Entrega Brasil" do detalhe montam "a expedir" a partir de `billingHistory` (faturas da Stripe, depois de sincronizar).

## Goals / Non-Goals

**Goals:** cada decisão com o dado na mesma tela; nenhum caminho novo que permita algo que hoje é recusado.

**Non-Goals:** critério único de mercado e fila de exceção (PM-21); travas de endereço e fiscal; "prontos aguardando NF-e" (PM-25); coleta UPS; ações em lote na produção.

## Decisions

**Confirmação em lote: uma pergunta, decidida antes.** Etiquetas UPS mantém a confirmação única do lote (com a lista dos não prontos). Os pedidos que o operador confirmou vão com `confirm_not_ready: true`. Se a API ainda responder 409 para um pedido (mudou desde que a fila carregou), ele termina como "Precisa confirmar: <motivos>", sem compra, e o lote segue. No detalhe da assinatura, o 409 abre a confirmação com os motivos e reenvia.

**Editar usa o mesmo modal.** O modal de despacho ganha um modo de edição: preenchido com o meio, entregador, link, custo e nota gravados (o estado de hoje nasce em Uber e não acompanha a troca de alvo, então o estado inicial vem da entrega e é refeito a cada abertura), título "Editar entrega", salva com `PATCH`, sem a confirmação de não pronto e sem dizer que o cliente recebe e-mail.

**Tipo da falha obrigatório no painel.** Radio de três opções no modal "Falhou"; o texto continua obrigatório. A API aceita sem tipo, mas o painel sempre envia.

**Endereço para copiar.** Um bloco de texto com as linhas na ordem do Uber (rua e número, complemento, bairro, cidade/UF, CEP) e um botão "Copiar endereço"; o telefone tem o próprio "Copiar". Usa `navigator.clipboard` com retorno visual; sem clipboard, o texto continua selecionável.

**Ciclos pagos no detalhe.** As duas seções passam a listar os ciclos de `paid-cycles`. A escolha da seção continua a de hoje (país do endereço) até PM-21. "Sincronizar faturas" fica na seção de faturas, para consulta. As ações por linha (comprar etiqueta, despachar) continuam as mesmas, agora por ciclo.

**Contato como componente.** `CustomerContact` recebe a assinatura e um motivo sugerido (pagamento recusado em Hoje, falha de entrega no courier), abre um Dialog com motivo, resultado e nota, e mostra o telefone com copiar quando houver. O último contato é texto curto: "Contatado ontem, 14:05, sem resposta, por Ana". Sem `customers.contact.write`, o botão não aparece; o histórico aparece para quem lê a assinatura.

**Pendências de Hoje.** Uma lista nova "Expedição e notas", só com as contagens maiores que zero e do mercado em tela, cada uma com link filtrado (`courierHref({aba})`, `nfeListHref({status})`, `/operations/labels`). Bling desconectado aparece só quando `blingConnected === false` e o Brasil está em tela. "Em rota há mais de 24 h" é um recorte: o link abre a aba inteira, da saída mais antiga para a mais nova.

**Próximo passo BR pela entrega.** O preparo fica `ready` depois do despacho, então o painel usa `courierDelivery` do item: `none` → "Despachar", `out_for_delivery` → "Em rota", `delivered` → "Entregue", `failed` → "Despachar de novo".

**Âncora em Etiquetas UPS.** A seção "Verificar na UPS" ganha `id="verificar-ups"` (o `Section` passa a aceitar `id`), e a página rola até ela depois de carregar a fila quando o hash é `#verificar-ups`. Sem isso o link de Hoje cai no topo, na lista de compra.

## Risks / Trade-offs

- [Painel antes do backend] → Sem `fulfillment` a lista nova não aparece; sem `paid-cycles` as seções mostram erro. Por isso o backend sai primeiro, no mesmo dia (o 409 novo exige o painel novo).
- [Telefone exposto] → Só nas telas que já exigem `shipping.read` ou a leitura da assinatura no mercado.

## Migration Plan

Deploy logo depois do backend. `npm run contract:sync` e commit de `contracts/backend-routes.json` com as três rotas novas. Rollback: reverter o painel; o backend novo continua compatível, exceto o 409 da compra UPS, que o painel antigo mostra como erro.
