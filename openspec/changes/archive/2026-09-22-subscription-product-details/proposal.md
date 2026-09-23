# Proposal

## Why

Na tela de detalhe da assinatura (`/billing/subscriptions/:id`) a seção Snapshots mostra quatro blocos de JSON cru (`petsSnapshot`, `planSelection`, `address`, `shipping`). O operador não consegue ler pet, sabores, endereço e frete sem interpretar payload. A visão 360 já apresenta o mesmo tipo de dado em seções legíveis, com o JSON só recolhido.

## What Changes

- A seção Snapshots do detalhe da assinatura passa a mostrar **Detalhes do produto**, **Endereço** e **Frete** no mesmo padrão visual da visão 360.
- O JSON dos quatro payloads permanece disponível, recolhido em **JSON técnico**.
- Desconto e pagamento continuam só na visão 360. A API da assinatura não envia `checkoutReference`.
- Pet e mix vêm de `planSelection`. Pet que existe só em `petsSnapshot` ainda aparece na tabela, sem sabor. Se o mesmo `pet_id` tiver nomes diferentes, a tabela usa o nome do plano.
- A visão 360 mantém o título **Plano e itens**, os cards de desconto e pagamento, e o JSON técnico. Nenhuma requirement de `operations/onboarding-checkouts` muda.

## Capabilities

### New Capabilities

- `operations/subscription-detail`: leitura operacional do ledger da assinatura no painel — produto, endereço, frete e JSON técnico recolhido, sem recálculo live.

### Modified Capabilities

- Nenhuma. `operations/onboarding-checkouts` continua cobrindo prazo e recorrência da visão 360. Extrair o markup compartilhado não altera esse comportamento.

## Impact

- Código: `eden-bowls-admin` — `SubscriptionDetailPage`, extração de seções a partir de `CheckoutSnapshotPanels`, testes da página.
- API: nenhuma. `GET /api/v1/admin/billing/subscriptions/:id` já devolve `petsSnapshot`, `planSelection`, `address` e `shipping`.
- Loja (`eden-bowls`): sem impacto. Não usa esses componentes nem esses campos de ledger.
- Backend (`eden-bowls-backend`): sem tarefa nesta mudança. O webhook que promove `editPending` em `invoice.paid` grava `planSelection` novo e não reescreve `petsSnapshot`; isso pode deixar o nome do snapshot defasado, e a tela trata essa divergência na leitura. Corrigir o webhook fica fora do escopo.
