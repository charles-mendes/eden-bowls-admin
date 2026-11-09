# Tasks

## 1. Alertas no cartão

- [ ] 1.1 Em `src/lib/customerSubscriptions.ts`, criar o tipo `SubscriptionAlert` e `alertPresentation(alert, subscription)`, que devolve `{ text, badge, href, title }` conforme a tabela do spec, com fallback neutro; cobrir em `src/lib/customerSubscriptions.test.ts` (novo) e rodar `npx vitest run src/lib/customerSubscriptions.test.ts`
- [ ] 1.2 Mostrar os badges no cabeçalho de `CustomerSubscriptionCard.tsx`, cada um como link quando há `href`
- [ ] 1.3 Contador "N com alerta" na aba Assinaturas de `UserDetailPage.tsx`
- [ ] 1.4 Fixture com `alerts` e testes em `UserDetailPage.test.tsx`, um por cenário do spec; rodar `npx vitest run src/pages/UserDetailPage.test.tsx`

## 2. Verificação

- [ ] 2.1 `npx vitest related --run` nos arquivos alterados, `npx eslint --quiet` neles e `npx tsc -p tsconfig.app.json --noEmit` passam
