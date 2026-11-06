# Proposal

## Why

Lote 3 da proposta de melhorias do painel (`docs/analise/proposta-melhorias.md`, na raiz do workspace): mercado de saída e endereço. O backend (`admin-flow-fixes-3` em `eden-bowls-backend`) passa a recusar o despacho, a compra de etiqueta e a NF-e quando o mercado ou o endereço não servem. O painel precisa mostrar o motivo antes do clique e o estado do e-mail ao cliente, sem nenhum campo para reescrever o endereço. Ainda não há produção, só QA, então a trava liga direto.

## What Changes

- **Exceções de mercado (PM-21).** Página nova "Exceções de mercado" (`/operations/market-exceptions`, menu Operação, permissão `shipping.read`). Lista as assinaturas cuja conta e país não combinam, com a conta, o país do endereço, o cliente, os ciclos pagos em aberto e o link para a assinatura. O detalhe da assinatura mostra um aviso quando ela está em exceção.
- **Trava do courier (PM-22).**
  - **Antes do clique.** Em "A despachar" e "Falhas", a linha com `issues` mostra o que falta no endereço, e "Despachar" fica indisponível. Não há "despachar mesmo assim".
  - **Recusa da API.** `422 courier_address_incomplete` e `422 shipment_market_exception` ganham texto próprio em `courierErrorText`.
- **Etiquetas UPS.** O motivo novo `shipment_market_exception` ganha texto em `labelIssueText`.
- **Problema de endereço (PM-24).**
  - **Onde.** As linhas do courier e das etiquetas, o detalhe da assinatura e o detalhe da NF-e.
  - **Estado.** Mostra "E-mail enviado em dd/mm", "E-mail não enviado", "Cliente corrigiu em dd/mm" ou "Sem correção há N dias".
  - **Contato.** Ao lado, o "Registrar contato" que já existe (lote 2).
- **NF-e.** O detalhe mostra o que falta (`missing_fields`: CPF, nome fiscal) e diz que o cliente corrige em Meu plano → Editar assinatura. "Corrigir dados" continua como exceção.
- **Contrato.** `npm run contract:sync` para a rota nova `GET /admin/market-exceptions`.

## Capabilities

### New Capabilities

- `operations/market-exceptions`: a lista de assinaturas fora de qualquer mercado de saída e o aviso no detalhe.

### Modified Capabilities

- `operations/courier-deliveries`: trava por endereço na linha e textos das recusas novas.
- `operations/ups-labels`: motivo de exceção de mercado.
- `operations/subscription-detail`: aviso de exceção e problema de endereço.
- `operations/nfe-invoices`: o que falta na nota e o problema de endereço.

## Impact

- **Páginas.**
  - novo: `src/pages/MarketExceptionsPage.tsx`;
  - rota em `src/App.tsx`, item em `src/lib/menu.ts`;
  - `src/pages/CourierDeliveriesPage.tsx`, `src/pages/LabelQueuePage.tsx`, `src/pages/SubscriptionDetailPage.tsx`, `src/pages/NfeDetailPage.tsx`.
- **Libs e componentes.**
  - novo: `src/lib/addressIssues.ts` (tipos, textos dos códigos, estado do e-mail), `src/components/AddressIssueStatus.tsx`;
  - `src/lib/courierDeliveries.ts`, `src/lib/upsLabels.ts`.
- **Testes.** `src/test/mockAdminFetch.ts` e `src/test/fixtures.ts`, com a rota nova e os campos novos.
- **Contrato.** `contracts/backend-routes.json` (`npm run contract:sync`).
- **Fora do escopo.** Contagens de exceções e bloqueios no Hoje (lote 5).
