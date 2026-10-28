# Proposal

## Why

A página "Cupons 1ª compra" tem uma cópia própria do percentual de cada prazo (`TERM_PERCENT = { 1: 10, 3: 25, 6: 40 }` em `CouponsPage.tsx`) e repete "25%/40%" num texto fixo. Se a API mudar o percentual, o painel continua mostrando o antigo. A API passou a devolver o percentual de cada prazo na resposta de saúde dos cupons (change irmão `move-business-data-1-read-from-api` da API). Esta é a parte do painel na fase 1 de 3.

## What Changes

- A página lê o percentual de cada prazo do campo `terms` da saúde dos cupons e deixa de ter a constante `TERM_PERCENT`.
- O cartão de cada prazo, o seletor de prazo e o placeholder do formulário de criação mostram o percentual vindo da API.
- O aviso "O percentual maior (25%/40%)…" passa a citar os percentuais vindos da API.
- Sem `terms` na resposta (API antiga), a página mostra `-` no lugar do percentual em vez de um número fixo.
- Contrato: `npm run contract:sync` depois que a API publicar o manifesto com `GET /api/v1/recipes`.

## Capabilities

### New Capabilities

### Modified Capabilities

- `operations/billing-coupons`: o percentual de cada prazo exibido na página vem da API.

## Impact

- `src/pages/CouponsPage.tsx`, `src/pages/CouponsPage.test.tsx`, `src/test/fixtures.ts` (`firstPurchasePromoHealth` com `terms`), `contracts/backend-routes.json`.
- Depende da API com `terms` publicada antes.
