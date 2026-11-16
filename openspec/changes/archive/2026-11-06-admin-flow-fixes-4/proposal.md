# Proposal

## Why

Lote 4 da proposta de melhorias do painel (`docs/analise/proposta-melhorias.md`, na raiz do workspace): a trava fiscal (PM-25). O backend (`admin-flow-fixes-4` em `eden-bowls-backend`) passa a recusar o despacho do courier de um ciclo sem NF-e autorizada, quando o interruptor `COURIER_REQUIRE_AUTHORIZED_NFE` está ligado, e a dizer na fila qual a nota de cada fatura. Hoje Entregas Brasil não mostra a nota, e o operador só descobriria a trava pelo erro genérico do despacho.

A loja não muda. Ainda não há produção, só QA: com o interruptor desligado (padrão fora de produção), a fila só informa a nota e o despacho segue como hoje.

## What Changes

- **Entregas Brasil, linha de "A despachar" e de "Falhas".**
  - Mostra a NF-e da fatura (`nfe` da fila): "NF-e {número}" quando autorizada.
  - Com `nfe_required` ligado e a nota não autorizada, mostra "Aguardando NF-e: {motivo}" e o botão "Despachar" (ou "Despachar de novo") fica indisponível, com o motivo como explicação. Motivos: sem nota registrada; em emissão (`pending`, `submitted`); falta CPF ou nome fiscal (`blocked_missing_document`); rejeitada; com erro; cancelada.
  - Com a nota rejeitada, com erro ou sem CPF, a linha leva ao detalhe da nota (`/operations/nfe/:id`), onde já estão "Nova tentativa" e a correção dos dados.
  - Com `nfe_required` desligado, a linha só informa ("NF-e: {motivo}"), e o botão segue como hoje.
  - Nota autorizada sem número: "NF-e autorizada".
- **Erro do despacho.** `courier_nfe_not_authorized` ganha texto próprio no diálogo de despacho (Entregas Brasil e detalhe da assinatura), com a situação da nota de `nfe_status`. Cobre a corrida em que a nota muda entre a leitura da fila e o clique.
- **Hoje.** `fulfillment.courierAwaitingNfe` acima de zero mostra "N pedidos a despachar aguardando NF-e", com o Brasil na tela, levando a Entregas Brasil. É parte de "N pedidos a despachar", que não muda: os dois itens abrem "A despachar". Com `null` (trava desligada) ou zero, nada aparece.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `operations/courier-deliveries`: requisito novo para a NF-e na linha e o despacho indisponível sem nota autorizada; requisito novo para o texto do erro `courier_nfe_not_authorized`.
- `operations/today-overview`: o item "aguardando NF-e" em "Shipping and invoice work opens the filtered screen".

## Impact

- **Código:** `src/lib/courierDeliveries.ts` (tipo `nfe` e `nfe_required`, textos do motivo, `courierErrorText`), `src/pages/CourierDeliveriesPage.tsx`, `src/lib/today.ts` e `src/pages/DashboardPage.tsx` (`fulfillmentItems`); simulação em `src/test/fixtures.ts`.
- **API:** nenhuma rota nova; `contracts/backend-routes.json` não muda. Depende dos campos novos do backend; sem eles (backend antigo) a linha não mostra nota e nada trava no painel.
