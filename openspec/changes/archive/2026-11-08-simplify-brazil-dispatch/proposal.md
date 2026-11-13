# Proposal

## Why

O caminho da cozinha já é um botão por etapa. O que pesa é a passagem para a rua: Expedir abre Entregas Brasil sem o pedido, "A despachar" mistura o que ainda está na cozinha, o diálogo pede cinco campos quando a API só exige o meio, e o Hoje cobra a mesma caixa em mais de um card. Fechar "Entregue" é um clique por pedido. A change irmã `simplify-brazil-dispatch` em `eden-bowls-backend` entrega o filtro no servidor, a conta do Hoje e o id da fatura.

## What Changes

- Expedir, num pedido pronto do Brasil, abre `/operations/courier?fatura={paidInvoiceId}&assinatura={id}`. Se a entrega é depois de amanhã, o link leva também `de={hoje}&ate={entrega}`, para o pedido pronto antes do dia estar na lista. Sem `paidInvoiceId`, o link é `/operations/courier`, como hoje. Se a linha está em "A despachar" e pode sair, o diálogo de despacho abre. Se a fatura já está em outra aba carregada, essa aba abre e o diálogo não. Se não está no período, a tela diz isso e aponta para essa assinatura, onde Despachar já existe.
- "A despachar" abre só com prontos. "Mostrar todos" pede `preparo=todos` e fica na URL. O despacho de um não pronto continua com a confirmação que a API já exige.
- Despacho novo com meio Uber mostra meio e custo (opcional) na frente. Nome, link e observação ficam em "Detalhes". Outro meio, e qualquer edição, mostram o formulário inteiro. O mesmo diálogo vale na assinatura.
- O Hoje junta a espera de NF-e ao despacho: "N pedidos a despachar · M aguardando NF-e" vira um item só, e N passa a ser a conta de prontos. Com a trava fiscal ligada (obrigatória em produção), M diz quantos desses prontos ainda não podem sair. Sem CPF, rejeitada, com erro e problema de endereço continuam nos cards que já têm.
- Em "Em rota", quem tem `shipping.write` seleciona entregas e marca entregue com uma hora, padrão agora, editável. Não há "marcar tudo". Cada selecionada usa o `POST` que já existe. A que a API recusar fica na lista, com o motivo.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `operations/production-queue`: Expedir do Brasil leva a fatura.
- `operations/courier-deliveries`: filtro de prontos, abertura pela fatura, saída curta da Uber e entregue em lote.
- `operations/today-overview`: um item de despacho, com a espera de NF-e na mesma linha.

## Impact

- `src/pages/ProductionQueuePage.tsx`, `src/pages/CourierDeliveriesPage.tsx`, `src/components/shipping/CourierDelivery.tsx`, `src/pages/DashboardPage.tsx`.
- A assinatura usa o mesmo diálogo, então a saída curta vale lá também. O botão Entregue de uma linha só continua marcando agora, com a confirmação de hoje.
- Depende da API irmã. Sem ela, o filtro e o `paidInvoiceId` não existem.
