# Design

## Context

- **ProductionQueuePage:**
  - `fulfillmentPath`/`courierPath` montam o Expedir.
  - As linhas são agrupadas por `dueBucket`, com o cabeçalho de `bucketHeader`.
  - O card Atrasados lê `metrics.overdue`.
- **DashboardPage:**
  - `fulfillmentItems` monta cada linha com um `to` e uma ação.
  - A linha de despacho já recebe "· M aguardando NF-e" por concatenação de título.
- **CourierDeliveriesPage:**
  - `addressOnly` (`problema=endereco`) filtra pelo `address_issue` aberto.
  - As linhas travadas já usam `issueCodeText` (`src/lib/addressIssues.ts`).
- **SubscriptionDetailPage:**
  - lista `awaitingCourier` com um botão Despachar sempre ativo para `shipping.write`.
- **API (change irmã):**
  - mantém o pronto atrasado do Brasil na fila, com `dueBucket: 'overdue'`;
  - tira os `ready` de `metrics.overdue`;
  - manda `courierIssues` no item da fila, `courier_issues` no detalhe e `fulfillment.courierAddressLocked` no Hoje.

## Goals / Non-Goals

**Goals**

- Depois de "Marcar como pronto", o pedido atrasado continua na tela com a próxima ação.
- A trava de endereço aparece antes do clique, em todas as telas do caminho.

**Non-Goals**

- Editar o endereço ou o nome de quem recebe no painel.
- Despachar mesmo assim.
- Mudar o filtro `prazo=atrasados` na URL ou na API.

## Decisions

### 1. Grupo "Prontos para expedir" calculado no painel

O grupo é calculado no painel a partir de `dueBucket === 'overdue' && productionStatus === 'ready'`. Não precisa de campo novo:

- a chave de agrupamento vira `readyLate` para essas linhas;
- a ordenação põe `readyLate` antes de `overdue`;
- o cabeçalho é "Prontos para expedir".

O card Atrasados continua em `metrics.overdue`, que a API já calcula sem os prontos. A lista de `?prazo=atrasados` mostra os dois grupos.

### 2. Trava na linha pronta

Um helper novo, `fulfillmentAction(item)`, decide o que a linha pronta mostra:

| Caso | O que a linha mostra |
| --- | --- |
| Brasil com `courierIssues?.length` | "Travado: " mais os textos de `issueCodeText` separados por " · ", e o link "Ver na entrega" para `courierPath(item)` |
| Brasil sem trava | Expedir, como hoje |
| EUA | etiquetas, como hoje |
| Contas divergentes | "Mercado divergente", como hoje |

`QueueItem` ganha `courierIssues?: string[] | null`.

### 3. Item de despacho do Hoje com partes linkadas

`Work` ganha `parts?: { text: string; to?: string }[]`, renderizadas depois do título, separadas por " · ":

- "M travados por endereço" leva a `courierHref()` com `problema=endereco`;
- "K aguardando NF-e" continua sem link próprio, como hoje;
- o título e a ação "Abrir entregas" não mudam.

`Fulfillment` (`src/lib/today.ts`) ganha `courierAddressLocked?: number | null`. Com isso, o "aguardando NF-e" deixa de ser concatenado ao título e passa a ser uma das partes.

### 4. Filtro de endereço inclui o travado

O filtro `addressOnly` passa a aceitar a linha quando:

- `item.address_issue` está aberto, como já é hoje; ou
- `item.issues?.length` não é zero.

O texto do chip continua "Com problema de endereço".

### 5. Despachar travado na assinatura

- `SubscriptionDetail` ganha `courier_issues?: string[] | null`.
- Com trava, cada Despachar de `awaitingCourier` fica com `disabled` e `aria-describedby` apontando para a frase "Travado: …", mostrada uma vez acima da tabela da seção.
- Sem o campo, o botão continua como hoje.

## Risks / Trade-offs

- **"Prontos para expedir" só junta os atrasados.** O pronto no prazo continua no grupo do seu dia, com Expedir. Isso evita mexer na ordem de quem a cozinha atende hoje.
- **O filtro mais largo mostra linhas sem problema aberto.** O texto do Hoje e do chip continua "endereço", e isso é coerente com a linha, que já diz o que falta.

## Migration Plan

Sobe junto com o backend. Com a API antiga:

- os campos novos não vêm e a tela fica como hoje;
- o grupo novo só aparece quando a API mantiver o pronto atrasado.
