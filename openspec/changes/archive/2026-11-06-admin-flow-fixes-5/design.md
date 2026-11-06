# Design

## Context

Veja `proposal.md` (Why). O que existe hoje e importa aqui:

- **Fila de produção.** `ProductionQueuePage.tsx` já tem:
  - `patchStatus(item, status, note)`, que chama o `PATCH`, mostra a falta de separação (`formatSeparationShortage`) e recarrega;
  - o modal "Bloquear pedido", que já conhece `paymentState`;
  - o selo de cobertura.
- **Estoque.** `StockPage.tsx` lê `mercado`, `janela`, `situacao` e `busca` da URL, e `stockHref` monta o link.
- **Filas.** `CourierDeliveriesPage.tsx` lê `aba` da URL. As duas filas só mostram "a lista mostra os N primeiros".
- **Hoje.** `DashboardPage.tsx` monta os itens de expedição em `fulfillmentItems` com `add(market, count, …)`.

## Goals / Non-Goals

**Goals:**

- Lote, confirmações e período usando só o que o backend já dá ou passa a dar.
- Um só jeito de ler e escrever o período nas duas filas.

**Non-Goals:**

- Seleção entre páginas da fila de produção.
- Desfazer um lote.
- Filtro de problema de endereço no backend (o filtro é da tela, sobre as linhas já lidas).

## Decisions

### 1. O lote reusa `patchStatus` sem recarregar a cada pedido

`patchStatus` ganha um modo interno que não recarrega nem limpa avisos e devolve `{ ok, item, error, stock }`. O lote:

- chama esse modo em série, na ordem da fila;
- junta as faltas de separação e as falhas;
- recarrega uma vez no fim.

A ação de uma linha continua igual.

**Alternativa:** `Promise.all`. Rejeitada: a baixa de estoque e as travas rodam no `updateStatus` de cada pedido, e em paralelo duas separações da mesma receita disputariam o saldo e embaralhariam os avisos.

### 2. A seleção vive em estado da página, por chave `id|currentPeriodEnd`

É a mesma chave das linhas. Limpa quando muda `requestKey` (página, filtros, janela) e depois de um lote. Uma linha que sai da fila depois do lote não fica selecionada.

### 3. Uma confirmação de estoque para a linha e para o lote

O componente `StockShortageConfirm` mostra o texto e as receitas de `stockShortages` (nome e tamanho) e o link de estoque. A linha o usa com um pedido; o lote, com a lista. O link é `stockHref({ mercado, situacao: 'short', busca })`, com `mercado` só quando a sessão tem os dois mercados, como no resto da página.

### 4. A prévia do bloqueio é lida ao abrir o modal

Um efeito no modal chama `GET /admin/production/queue/:id/block-preview?periodEnd=…` só para ciclo não pago. A data é formatada no fuso do mercado do item (`America/Sao_Paulo` ou `America/New_York`), como o Vencimento. Uma resposta que chega depois de o modal fechar, ou de outro item abrir, é descartada. Se a prévia falha, o texto genérico fica.

### 5. `src/lib/deliveryRange.ts` para as duas filas

- **Leitura e escrita.** `readRange(params)` e `rangeParams(range)` cuidam de `de` e `ate` na URL.
- **Presets e textos.** Os presets "Até amanhã" e "Próximos 7 dias" saem dali, calculados no fuso da fila (courier em São Paulo, etiquetas em Nova York), e também `nextFromRange(range, nextFrom)` e `laterRange(range)` (7 dias depois de `to`).
- **Validação.** O backend valida. O painel só mostra o texto de `invalid_delivery_range`.

### 6. Filtro de problema de endereço na tela

As linhas já trazem `address_issue` desde o lote 3. `problema=endereco` filtra no cliente "A despachar" e "Falhas" no courier, e "Prontos" nas etiquetas. As outras abas e grupos não são filtrados, porque não trazem o campo.

### 7. Hoje por mercado

`fulfillmentItems` ganha dois `add` por mercado: os problemas de endereço (texto com `stale`) e as exceções. Os dois respeitam `shownMarkets`, como os outros. Os tipos de `Fulfillment` em `lib/today.ts` ganham os campos como opcionais, e um backend antigo sem eles não mostra nada.

## Risks / Trade-offs

- **[Risco] Um lote grande demora.** → Um pedido por vez, com o contador "Atualizando 3 de 12" na barra. No volume atual (até 6 BR por dia), são poucos segundos.
- **[Risco] O número de problemas do Hoje e a fila filtrada divergem.** O Hoje conta todos os problemas abertos da conta. A fila mostra só os das suas linhas no período: um ciclo depois de amanhã, uma etiqueta já criada ou uma entrega em rota ficam fora. → O texto do Hoje fala em "problemas de endereço abertos", não em pedidos da lista. A fila vazia diz "Nenhum pedido com problema de endereço neste período.", com o seletor de período ao lado. Cada problema também aparece no detalhe da assinatura (lote 3).
- **[Risco] Falta pela ordem da fila não é saldo negativo garantido.** → O texto diz "pode deixar o saldo negativo". O aviso depois da separação, que já existe, diz o saldo real.

## Migration Plan

- Deploy depois da API `admin-flow-fixes-5`, no mesmo dia. Antes dela, a prévia do bloqueio responde 404 e o texto genérico fica.
- Rollback: reverter o deploy do painel. A API continua compatível com o painel anterior, que só passa a ver as filas até amanhã.
