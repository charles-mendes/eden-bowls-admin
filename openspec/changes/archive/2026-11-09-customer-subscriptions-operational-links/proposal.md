# Proposal

## Why

A aba **Assinaturas** do cliente (`/users/:id?aba=assinaturas`) mostra só o ID Stripe, o status, o plano, o fim do período e se está cancelando. Para validar o cliente, o operador abre cada assinatura ou procura nas filas de Produção, Entregas Brasil e NF-e.

A change irmã `customer-subscriptions-operational-links` em `eden-bowls-backend` (commit 92f840f) passou a mandar, no mesmo `GET /api/v1/admin/users/:userId`, o contrato, o pagamento, o frete do checkout e o último ciclo pago com produção, entrega e NF-e. Esta change mostra esses dados.

## What Changes

- A aba troca a tabela por um cartão por assinatura:
  - cabeçalho: link do ID Stripe para o detalhe da assinatura, status, plano e mercado;
  - dados: início, fim do período, cancelando, contrato (prazo, entregas cobradas, renovação), cartão e frete pago no checkout.
- Bloco **Último ciclo** em cada cartão: pago em, preparo, entrega prevista, produção (status e nota), entrega (courier ou UPS, com status e data ou rastreio) e NF-e (número, status, erro, e-mail).
  - Cada item linka para a tela de origem: fila de produção, Entregas Brasil, detalhe da assinatura e `/operations/nfe/:id`.
- Bloco que não veio no payload, por falta de permissão, não aparece. `latestCycle: null` mostra "Nenhum ciclo pago". `latestCycleUnavailable` mostra um aviso.
- O mapa de status UPS sai de `SubscriptionDetailPage.tsx` para `src/lib/upsLabels.ts` e passa a ser usado nas duas telas.
- **Sem mudança:** nenhuma rota nova é chamada, e `contracts/backend-routes.json` não muda.
- **Fora do escopo:** alertas na linha (NF-e ausente ou rejeitada, entrega que falhou, pronto sem despacho, edição pendente).

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `operations/customer-detail`: a aba Assinaturas mostra o contrato e o último ciclo pago com suas ligações.

## Impact

- `src/pages/UserDetailPage.tsx`: tipo de `subscriptions` e a aba.
- `src/lib/upsLabels.ts`, `src/pages/SubscriptionDetailPage.tsx`: mapa de status UPS compartilhado.
- `src/index.css`: estilo do cartão com os tokens existentes.
- `src/test/fixtures.ts`, `src/pages/UserDetailPage.test.tsx`.
