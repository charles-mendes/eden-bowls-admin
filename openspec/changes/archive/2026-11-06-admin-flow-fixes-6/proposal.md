# Proposal

## Why

Lote 6 da proposta de melhorias do painel (`docs/analise/proposta-melhorias.md`, na raiz do workspace): o registro da coleta UPS (PM-28, opção B, coleta avulsa). O backend (`admin-flow-fixes-6` em `eden-bowls-backend`) passa a pedir, listar, cancelar e fechar coletas na UPS, a dizer a coleta de cada etiqueta criada e a contar no Hoje as etiquetas sem coleta.

Hoje, Etiquetas UPS compra e imprime, e o operador chama a UPS por fora, sem registro. Com volume que varia por dia (segunda 8 caixas, terça nenhuma, quarta 15), a coleta é pedida só nos dias com etiqueta, com a quantidade do dia, e fica registrada com o número de confirmação (PRN).

A loja não muda.

## What Changes

- **Etiquetas UPS, seção "Coleta".**
  - Lista as etiquetas criadas sem coleta, todas marcadas.
  - O operador escolhe a data (hoje por padrão), a janela (pronto a partir de, fecha às) e a quantidade de caixas, que vem sugerida pelo número de etiquetas marcadas.
  - "Pedir coleta à UPS" confirma antes, dizendo data, janela e quantidade, e mostra o PRN depois.
  - Cada recusa da API ganha texto próprio: dia fechado ou fora do prazo, janela inválida, etiqueta que já está em outra coleta, telefone do remetente faltando (com link para Configurações > Frete), e a UPS sem resposta.
- **Coletas pedidas.** Na mesma seção, as coletas da semana (data, janela, caixas, PRN, situação).
  - "Cancelar coleta" num pedido confirmado, com confirmação, cancela na UPS.
  - Uma coleta sem resposta da UPS mostra "Verificar no portal da UPS" e "Não foi criada", que solta as etiquetas depois de conferir.
- **Etiquetas criadas.** Cada linha diz "Coleta pedida para dd/mm · PRN {número}" ou "Sem coleta".
- **Configurações > Frete.** O cartão da sede dos EUA ganha o campo "Telefone", exigido pela UPS na coleta.
- **Hoje (PM-26, parte de coleta).** `fulfillment.upsLabelsWithoutPickup` acima de zero mostra "N etiquetas sem coleta pedida", com os EUA na tela, levando a Etiquetas UPS na seção de coleta (`/operations/labels#coleta`).

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `operations/ups-labels`: requisitos novos para pedir a coleta, para a lista de coletas com cancelar e "não foi criada", e para a coleta na linha da etiqueta criada.
- `operations/today-overview`: o item "etiquetas sem coleta pedida" em "Shipping and invoice work opens the filtered screen".

## Impact

- **Código:**
  - `src/pages/LabelQueuePage.tsx` e um componente novo da seção de coleta;
  - `src/lib/upsLabels.ts` (tipos e textos de erro);
  - `src/components/shipping/HeadquartersCard.tsx` e o tipo das configurações de frete (telefone);
  - `src/lib/today.ts` e `src/pages/DashboardPage.tsx`;
  - simulação em `src/test/mockAdminFetch.ts` e `src/test/fixtures.ts`.
- **API:** quatro rotas novas do backend; `npm run contract:sync` e commitar `contracts/backend-routes.json`.
