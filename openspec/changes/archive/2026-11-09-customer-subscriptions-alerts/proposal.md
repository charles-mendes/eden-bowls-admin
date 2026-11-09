# Proposal

## Why

A change irmã `customer-subscriptions-alerts` em `eden-bowls-backend` passou a mandar `alerts` em cada assinatura de `GET /api/v1/admin/users/:userId`: NF-e com problema ou atrasada, entrega que falhou, pronto sem despacho e alteração pendente. O cartão da assinatura na aba Assinaturas ainda não mostra esses alertas, então o operador precisa ler o bloco "Último ciclo" inteiro para achar o problema.

## What Changes

- O cabeçalho de cada cartão mostra um badge por alerta, na ordem da API, com texto curto e a cor de status do painel:

  | Código | Texto | Cor |
  |---|---|---|
  | `nfe_problem` | NF-e rejeitada / com erro / sem CPF | erro |
  | `nfe_missing` | NF-e atrasada | aviso |
  | `delivery_failed` | Entrega falhou | aviso |
  | `ready_not_dispatched` | Pronto sem despacho | aviso |
  | `pending_change` | Alteração pendente | info |

- Cada badge que tem tela de origem vira link:
  - NF-e com problema → `/operations/nfe/:id`;
  - entrega falhou → Entregas Brasil, aba Falhas;
  - pronto sem despacho → detalhe da assinatura, `#entrega-brasil` no Brasil e `#envio-ups` nos EUA;
  - NF-e atrasada → lista de NF-e;
  - alteração pendente → detalhe da assinatura.

  O `title` de cada badge explica o alerta: o erro da nota, a data de entrega, os tipos de alteração.
- A aba Assinaturas mostra no contador quantas assinaturas têm algum alerta.
- Um código desconhecido aparece como badge neutro com o próprio código, sem quebrar a tela.
- **Sem mudança:** nenhuma rota nova é chamada.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `operations/customer-detail`: o cartão da assinatura mostra os alertas operacionais.

## Impact

- `src/lib/customerSubscriptions.ts`: tipo `SubscriptionAlert` e o texto, a cor e o link de cada código.
- `src/components/CustomerSubscriptionCard.tsx`: badges no cabeçalho.
- `src/pages/UserDetailPage.tsx`: contador da aba.
- `src/test/fixtures.ts`, `src/pages/UserDetailPage.test.tsx`.
