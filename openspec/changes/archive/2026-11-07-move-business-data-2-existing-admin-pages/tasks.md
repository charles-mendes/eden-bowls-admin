# Tasks

Fase 2 de 3. Sai depois do change de mesmo nome da API (`eden-bowls-backend`, PR #16). Rode só os testes relacionados (`npx vitest run <arquivo>`).

## 1. Apresentação da receita

- [x] 1.1 Acrescentar `RecipePresentation` a `src/lib/recipeContent.ts` (`presentation`/`presentationUpdatedAt` em `RecipeContent`, limites iguais aos da API, texto em português de `recipe_presentation_invalid`) e criar `src/components/RecipePresentationSection.tsx` (decisão 1), montado em `RecipeContentPage.tsx`. Verificar com `npx vitest run src/pages/RecipeContentPage.test.tsx`: os cenários "Seeded presentation", "Save a presentation", "Invalid color refused" e "Recipe without presentation", e a seção só leitura sem `catalog.write`.
- [x] 1.2 Em `ProductDetailPage.tsx`, acrescentar "apresentação" às pendências (`recipePresentationReady`) e `presentation` a `MISSING_LABELS`. Verificar com `npx vitest run src/pages/ProductDetailPage.test.tsx`: o cenário "Activation refused without presentation".
- [x] 1.3 Acrescentar "Nome curto" (`tag`, até 40) à seção, pedido pela remoção dos `.md` na loja. Verificar com `npx vitest run src/pages/RecipeContentPage.test.tsx`: o cenário "Seeded presentation" mostra o nome curto.

## 2. Percentual do cupom

- [x] 2.1 Acrescentar "Desconto na 1ª fatura" ao formulário de `CouponsPage.tsx`, enviado como `percent_off`, com os avisos da decisão 2 e o aviso de divergência no cartão (decisão 3). Verificar com `npx vitest run src/pages/CouponsPage.test.tsx`: os cenários "Raise the 3-month percent", "Keep the stored percent" e "Coupon mapped with another percent".

## 3. Trânsito dos EUA

- [x] 3.1 Acrescentar `max_transit_days` a `ShippingSettings`, `emptySettings` (1) e `rulesOf`, e o campo na seção UPS com o aviso acima de 1 dia (decisão 4). Verificar com `npx vitest run src/pages/ShippingPage.test.tsx`: os cenários "Save two days" e "Value from the API".

## 4. Limite do pacote grande

- [x] 4.1 Acrescentar `largePackLimit` e `weight` aos tipos de `ProductDetailPage.tsx`, o campo na seção "Plano" com os pesos das variações ativas, e o salvar em produto publicado só com `largePackLimit` (decisão 5). Verificar com `npx vitest run src/pages/ProductDetailPage.test.tsx`: os cenários "Save the limit of a published product" e "Out of range".

## 5. Contrato e verificação

- [x] 5.1 Com o manifesto da API da fase 2, rodar `npm run contract:sync`. Verificar que `contracts/backend-routes.json` tem `PUT /api/v1/admin/catalog/recipe-content/:flavorSlug/presentation` e que `npx vitest run src/lib/api.test.ts` passa.
- [x] 5.2 Rodar `npx vitest run --changed`, `npx tsc -b` e `npx playwright test e2e/specs/admin-catalog.spec.ts e2e/specs/admin-billing.spec.ts --workers=4`.

Nota da 5.2: `admin-catalog.spec.ts` "registers a new one" já falhava antes desta mudança, porque o cadastro de receita passou a enviar `lifeStage` em `add-life-stage-recipes`. A expectativa foi atualizada.
