# Tasks

## 1. Pets no card da assinatura

- [x] 1.1 Em `src/lib/customerSubscriptions.ts`, adicionar `pets?: Array<{ id: string; name: string }>` a `CustomerSubscription` e criar `formatSubscriptionPets(pets)`: nomes separados por vírgula, "Pet sem nome" para nome vazio e "-" para lista vazia. Cobrir em `src/lib/customerSubscriptions.test.ts` e rodar `npx vitest run src/lib/customerSubscriptions.test.ts`
- [x] 1.2 Em `CustomerSubscriptionCard.tsx`, mostrar o item "Pets" no `meta-grid` só quando `item.pets !== undefined`

## 2. Assinatura no card do pet

- [x] 2.1 Em `UserDetailPage.tsx`, adicionar `subscriptions?: Array<{ id: string; stripeSubscriptionId: string; status: string; planLabel: string | null }>` aos pets de `OnboardingDetail`. No `.pet-card`, mostrar um selo por item, com link para `/billing/subscriptions/:id`, o id da Stripe e o status com `formatStripeStatus` e `subscriptionBadgeClass`. Mostrar "Sem assinatura" com lista vazia, e nada sem a chave. Ajustar `src/index.css` só se o selo não couber no card

## 3. Testes

- [x] 3.1 Em `src/test/fixtures.ts`, colocar `subscriptions` no pet do onboarding e `pets` na assinatura do cliente. Em `src/pages/UserDetailPage.test.tsx`, um teste por cenário do spec. Rodar `npx vitest run src/pages/UserDetailPage.test.tsx`
- [x] 3.2 `npx vitest related --run` nos arquivos alterados, `npx eslint --quiet` neles e `npx tsc -p tsconfig.app.json --noEmit` passam
