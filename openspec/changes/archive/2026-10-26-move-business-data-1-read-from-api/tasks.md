# Tasks

Fase 1 de 3. Sai depois do change de mesmo nome da API (`eden-bowls-backend`). Rode só os testes relacionados (`npx vitest run <arquivo>`).

## 1. Percentual vindo da API

- [x] 1.1 Acrescentar `terms` a `PromoHealth` e a `firstPurchasePromoHealth` em `src/test/fixtures.ts`, criar `percentFor(health, term)` e trocar todos os usos de `TERM_PERCENT` em `CouponsPage.tsx`, removendo a constante (decisões 1 e 2). Verificar com `npx vitest run src/pages/CouponsPage.test.tsx`: os cenários "Percents from the response" e "Response without terms", e `rg "TERM_PERCENT" src` sem resultado.
- [x] 1.2 Montar o aviso da 1ª fatura com os percentuais de 3 e 6 meses da resposta (decisão 3). Verificar com `npx vitest run src/pages/CouponsPage.test.tsx`: o cenário "Note follows the response" e a frase sem parêntese quando faltam os dois.

## 2. Contrato

- [x] 2.1 Com o manifesto da API atualizado, rodar `npm run contract:sync`. Verificar que `contracts/backend-routes.json` passa a ter `GET /api/v1/recipes` e que `npx vitest run src/lib/api.test.ts` passa.
