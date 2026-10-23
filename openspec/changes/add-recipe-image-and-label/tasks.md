# Tasks

Cada fase começa depois que a mesma fase do change irmão `add-recipe-image-and-label` em `eden-bowls-backend` tiver rodado `npm run routes:manifest`. Rode só os testes relacionados (`npx vitest related <arquivo> --run` e `npx playwright test <spec> --workers=4`).

## 1. Fase 1 · Contrato e utilitário de imagem

- [x] 1.1 Rodar `npm run contract:sync` para trazer as rotas de conteúdo a `contracts/backend-routes.json` e adicionar os handlers `GET`/`PUT /image`/`DELETE /image` em `src/test/mockAdminFetch.ts`, com fixtures em `src/test/fixtures.ts` (conteúdo com e sem imagem, `recipeImageUrl` e `recipeLabelStatus` no `productDetail`). Verificar com `npx vitest run src/test/apiContract.test.ts`.
- [x] 1.2 Extrair a leitura base64 de `src/lib/feedbacks.ts` para `src/lib/imageUpload.ts` e acrescentar `readImageSize` e `checkRecipeImage` (decisão 2), mantendo `fileToFeedbackPhoto`. Verificar com `src/lib/imageUpload.test.ts` (tipo, peso, tamanho, mensagem com o recebido e o esperado) e `npx vitest related src/lib/feedbacks.ts --run`.

## 2. Fase 1 · Página de conteúdo e tabela

- [x] 2.1 Criar `src/pages/RecipeContentPage.tsx` e a rota em `src/App.tsx`, com as variações que compartilham o conteúdo, o mercado e a seção **Imagem** (prévia, **Escolher imagem**, conferência, **Salvar imagem**, **Remover imagem** com confirmação, erros no card), seguindo `.agents/skills/frontend-design/SKILL.md`. Verificar com `src/pages/RecipeContentPage.test.tsx`: os cenários de "Variation opens its recipe content page", "Panel checks the image before sending", "Content errors appear on the content page" e "Readonly sees content without controls" (imagem), e o corpo `{ mimeType, imageBase64 }` do PUT.
- [x] 2.2 Em `src/pages/ProductDetailPage.tsx`: coluna **Conteúdo** com o selo da imagem e o link **Conteúdo**, e a confirmação de imagem no diálogo só sem `recipeImageUrl`, com o texto "imagem no código da loja". Verificar com `ProductDetailPage.test.tsx`: os cenários de "Variation table shows the content state" (imagem) e "Stored image hides the image confirmation".
- [x] 2.3 Em `e2e/specs/admin-catalog.spec.ts`, abrir o conteúdo pela variação, recusar uma imagem de tamanho errado sem chamada de rede e salvar uma válida. Em `e2e/specs/admin-readonly.spec.ts`, a página sem controles. Verificar com `npx playwright test e2e/specs/admin-catalog.spec.ts e2e/specs/admin-readonly.spec.ts --workers=4`.

## 3. Fase 2 · Rótulo

- [x] 3.1 Rodar `npm run contract:sync` para o `PUT /label`, com mock e fixtures de rótulo completo e incompleto (US sem aviso). Verificar com `npx vitest run src/test/apiContract.test.ts`.
- [x] 3.2 Acrescentar a seção **Rótulo** a `RecipeContentPage.tsx` (decisões 3 e 4): campos, listas, linhas de análise, idioma do mercado, selo e faltantes da API, **Salvar rótulo** e o 409 no card. Verificar com `RecipeContentPage.test.tsx`: os cenários de "Label form edits every label field", o corpo enviado sem linhas vazias e readonly sem controles.
- [x] 3.3 Em `ProductDetailPage.tsx`: selo do rótulo na coluna **Conteúdo** e a confirmação de rótulo só quando `recipeLabelStatus` não é `complete`. Verificar com `ProductDetailPage.test.tsx`: o cenário de rótulo de "Manual confirmations only for content kept in the store code".
- [x] 3.4 Estender `e2e/specs/admin-catalog.spec.ts` com preencher e salvar um rótulo US, e `admin-readonly.spec.ts` com a seção sem controles. Verificar com `npx playwright test e2e/specs/admin-catalog.spec.ts e2e/specs/admin-readonly.spec.ts --workers=4`.

## 4. Vínculo explícito da variação com a receita

- [x] 4.1 Rodar `npm run contract:sync` para o `GET /admin/catalog/recipe-content?market=`, com mock e fixtures da lista de receitas, `recipeKey` nas variações do PATCH e a recusa `recipe_key_invalid`. Verificar com `npx vitest run src/test/apiContract.test.ts`.
- [x] 4.2 Em `ProductDetailPage.tsx`: campo **Receita (conteúdo)** no diálogo (sugestões vindas da lista de receitas do mercado, explicação, nova variação preenchida pelo slug do sabor, `recipeKey` no payload, vazio como `null`, mensagem do 422), e a coluna **Conteúdo** com a chave, "Sem receita vinculada" e o link só com chave. Verificar com `ProductDetailPage.test.tsx`: os cenários de "Variation dialog sets the recipe key" e "Variation without a recipe".
- [x] 4.3 Em `RecipeContentPage.tsx`: mostrar a chave da receita e o produto de cada variação (com link para o produto). Verificar com `RecipeContentPage.test.tsx`: o cenário "Content page names the sharing variations".
- [x] 4.4 Estender `e2e/specs/admin-catalog.spec.ts` com desvincular uma variação pelo diálogo. Verificar com `npx playwright test e2e/specs/admin-catalog.spec.ts --workers=4`.

## 5. Menu e cadastro de receitas

- [x] 5.1 Rodar `npm run contract:sync` para `POST`/`PATCH`/`DELETE` de receita e acrescentar ao mock e às fixtures `name` na lista e no conteúdo, receita sem variações e as recusas `recipe_key_taken`, `recipe_in_use` e `recipe_not_registered` (Vitest e e2e). Verificar com `npx vitest run src/test/apiContract.test.ts`.
- [x] 5.2 Criar `src/pages/RecipesPage.tsx`, a rota `/catalog/recipes` e o item **Receitas** em `src/lib/menu.ts` (grupo Loja, admin, operator e readonly), com o filtro de mercado, as colunas, os filtros rápidos e o diálogo **Nova receita**. Verificar com `src/pages/RecipesPage.test.tsx` e `src/lib/menu.test.ts`: os cenários de "Recipes menu lists the recipes of a market" e "Operator registers a recipe".
- [x] 5.3 Mover `RecipeContentPage.tsx` para `/catalog/recipes/:market/:recipeKey` (mercado da URL, nome no cabeçalho, **Renomear**, **Excluir receita** só sem variações, explicação sem variações, voltar para a lista) e retirar a rota dentro do produto. Verificar com `RecipeContentPage.test.tsx`: os cenários de "Recipe page stands on its own".
- [x] 5.4 Em `ProductDetailPage.tsx`, trocar o campo de texto por um `select` das receitas cadastradas do mercado ("Sem receita" vira `null`, uma variação nova começa na receita do slug sugerido quando cadastrada, link para **Receitas**, mensagem de `recipe_not_registered`) e apontar o link **Conteúdo** para a rota nova. Verificar com `ProductDetailPage.test.tsx`: os cenários de "Variation dialog sets the recipe key" e "Variation opens its recipe content page".
- [x] 5.5 Atualizar `e2e/specs/admin-catalog.spec.ts` (lista, cadastro de receita, `select` na variação e rota nova da página) e `e2e/specs/admin-readonly.spec.ts` (lista sem **Nova receita** e página sem **Renomear**/**Excluir**). Verificar com `npx playwright test e2e/specs/admin-catalog.spec.ts e2e/specs/admin-readonly.spec.ts --workers=4`.

## 6. Integração

- [ ] 6.1 Em QA, com os três changes da fase entregues, cadastrar imagem e rótulo de um sabor US inativo pelo painel, ativar a variação sem as confirmações manuais e abrir `/recipes/<key>` no domínio US. Verificar que o banner e o rótulo são os cadastrados.
