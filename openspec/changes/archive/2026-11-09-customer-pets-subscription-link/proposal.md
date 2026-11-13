# Proposal

## Why

O detalhe do cliente mostra os pets na aba Pets e as assinaturas na aba Assinaturas, sem ligar uma coisa à outra. Para saber qual assinatura alimenta um pet, ou se o pet ficou sem plano, o operador precisa abrir cada assinatura.

A change irmã `customer-pets-subscription-link` em `eden-bowls-backend` passou a mandar esse vínculo:

- **No pet:** cada pet de `GET /api/v1/admin/onboarding/checkouts/:userId` traz `subscriptions`, com `id`, `stripeSubscriptionId`, `status` e `planLabel`, da mais recente para a mais antiga.
- **Na assinatura:** cada assinatura de `GET /api/v1/admin/users/:userId` traz `pets`, com `id` e `name`.

Contam as assinaturas em `active`, `trialing`, `past_due`, `paused` ou `incomplete`. Pet desativado no plano não conta.

## What Changes

- **Card do pet (aba Pets):**
  - um selo por item de `subscriptions`, na ordem da API;
  - cada selo mostra o id da Stripe e o status com a cor de status que o painel já usa nas assinaturas, e leva ao detalhe da assinatura;
  - com `subscriptions: []`, o card mostra "Sem assinatura".
- **Card da assinatura (aba Assinaturas):** uma linha "Pets" com os nomes da assinatura, separados por vírgula. Pet sem nome aparece como "Pet sem nome". Com `pets: []`, a linha mostra "-".
- **Backend sem os campos:** se a API ainda não mandar `subscriptions` no pet ou `pets` na assinatura, o painel não mostra nada daquilo. Ele não afirma "Sem assinatura" a partir de um campo ausente.
- **Sem mudança:** nenhuma rota nova é chamada e `contracts/backend-routes.json` não muda.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `operations/customer-detail`: o card do pet mostra a assinatura que o possui, e o card da assinatura mostra os seus pets.

## Impact

- `src/pages/UserDetailPage.tsx`: tipo `OnboardingDetail.pets[].subscriptions` e os selos no card do pet.
- `src/lib/customerSubscriptions.ts`: `pets` no tipo `CustomerSubscription` e um `formatSubscriptionPets`.
- `src/components/CustomerSubscriptionCard.tsx`: linha "Pets".
- `src/index.css`: espaço dos selos no card do pet, se o estilo atual não bastar.
- `src/test/fixtures.ts`, `src/pages/UserDetailPage.test.tsx`, `src/lib/customerSubscriptions.test.ts`.
