# Tasks

## 1. Status UPS compartilhado

- [x] 1.1 Mover `SHIPMENT_STATUS` de `SubscriptionDetailPage.tsx` para `src/lib/upsLabels.ts` (`UPS_SHIPMENT_STATUS`) e importar de volta; verificar com `npx vitest run src/pages/SubscriptionDetailPage.test.tsx`

## 2. Aba Assinaturas

- [x] 2.1 Ampliar o tipo de `subscriptions` em `UserDetailPage.tsx` com o formato da change do backend (contrato, `paymentMethod`, `checkoutShipping`, `latestCycle`, `latestCycleUnavailable`); verificar com `npx tsc -p tsconfig.app.json --noEmit`
- [x] 2.2 Trocar a tabela por um cartão por assinatura com cabeçalho, dados do contrato e bloco "Último ciclo", com estilo nos tokens existentes de `index.css`
- [x] 2.3 Fixture com contrato e último ciclo em `src/test/fixtures.ts` e testes em `UserDetailPage.test.tsx`, um por cenário do spec; rodar `npx vitest run src/pages/UserDetailPage.test.tsx`

## 3. Verificação

- [x] 3.1 `npx vitest run --related src/pages/UserDetailPage.tsx src/pages/SubscriptionDetailPage.tsx src/lib/upsLabels.ts`, `npx eslint` nos arquivos alterados e o teste do contrato de rotas passam
