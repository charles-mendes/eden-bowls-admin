# Design

## Context

- **Aba Pets:** `UserDetailPage.tsx` só busca `GET /admin/onboarding/checkouts/:userId` quando a aba Pets ou a aba Checkout abre, e desenha cada pet como `.pet-card`. O tipo `OnboardingDetail` é local da página.
- **Aba Assinaturas:** usa `CustomerSubscriptionCard`, com o tipo `CustomerSubscription` de `src/lib/customerSubscriptions.ts`. O status já tem rótulo, em `formatStripeStatus`, e cor, em `subscriptionBadgeClass`.
- **Rota do detalhe:** o link para o detalhe da assinatura é `/billing/subscriptions/:id`, com o id do ledger, como no cabeçalho do card.

## Goals / Non-Goals

**Goals:**

- Mostrar o vínculo nos dois lados, usando só o que a API já manda.

**Non-Goals:**

- Calcular o vínculo no painel. A regra de status e de pet desativado fica no backend.
- Uma rota ou uma busca nova. A aba Pets não passa a carregar `/admin/users/:userId` de novo para isso.

## Decisions

### 1. Reaproveitar o rótulo e a cor do status

O selo do pet usa `formatStripeStatus` e `subscriptionBadgeClass`, então "Pausado", "Pagamento atrasado" e "Incompleto" saem com o mesmo texto e a mesma cor do card da assinatura. Um status desconhecido cai no fallback que essas funções já têm.

### 2. Campo ausente não é lista vazia

Durante o deploy, o painel pode chegar antes do backend. Com a chave ausente, o card não mostra o vínculo. "Sem assinatura" só aparece com `subscriptions: []`, e "-" só aparece com `pets: []`. Assim o painel não afirma que o pet está sem plano quando a API só ainda não sabe responder.

### 3. Nomes como texto, sem link

No card da assinatura, os nomes saem como texto simples, via `formatSubscriptionPets(pets)` em `customerSubscriptions.ts`. Os pets não têm tela própria, e a aba Pets fica a um clique.

## Risks / Trade-offs

- **[Selo longo no card do pet]** Um id da Stripe é comprido e pode quebrar o layout em tela estreita. → O selo usa a mesma classe de link de tabela do cabeçalho do card. Se precisar, o CSS deixa o texto quebrar.
