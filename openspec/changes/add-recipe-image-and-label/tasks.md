# Tasks

Cada fase começa depois que a mesma fase do change irmão `add-recipe-image-and-label` em `eden-bowls-backend` tiver rodado `npm run routes:manifest`. Rode só os testes relacionados (`npx vitest run --related <arquivo>` e `npx playwright test <spec> --workers=4`).

## 1. Fase 1 · Contrato e utilitário de imagem

- [ ] 1.1 Rodar `npm run contract:sync` para trazer as rotas de conteúdo a `contracts/backend-routes.json` e adicionar os handlers `GET`/`PUT /image`/`DELETE /image` em `src/test/mockAdminFetch.ts`, com fixtures em `src/test/fixtures.ts` (conteúdo com e sem imagem, `recipeImageUrl` e `recipeLabelStatus` no `productDetail`). Verificar com `npx vitest run src/test/apiContract.test.ts`.
- [ ] 1.2 Extrair a leitura base64 de `src/lib/feedbacks.ts` para `src/lib/imageUpload.ts` e acrescentar `readImageSize` e `checkRecipeImage` (decisão 2), mantendo `fileToFeedbackPhoto`. Verificar com `src/lib/imageUpload.test.ts` (tipo, peso, tamanho, mensagem com o recebido e o esperado) e `npx vitest run --related src/lib/feedbacks.ts`.

## 2. Fase 1 · Página de conteúdo e tabela

- [ ] 2.1 Criar `src/pages/RecipeContentPage.tsx` e a rota em `src/App.tsx`, com as variações que compartilham o conteúdo, o mercado e a seção **Imagem** (prévia, **Escolher imagem**, conferência, **Salvar imagem**, **Remover imagem** com confirmação, erros no card), seguindo `.agents/skills/frontend-design/SKILL.md`. Verificar com `src/pages/RecipeContentPage.test.tsx`: os cenários de "Variation opens its recipe content page", "Panel checks the image before sending", "Content errors appear on the content page" e "Readonly sees content without controls" (imagem), e o corpo `{ mimeType, imageBase64 }` do PUT.
- [ ] 2.2 Em `src/pages/ProductDetailPage.tsx`: coluna **Conteúdo** com o selo da imagem e o link **Conteúdo**, e a confirmação de imagem no diálogo só sem `recipeImageUrl`, com o texto "imagem no código da loja". Verificar com `ProductDetailPage.test.tsx`: os cenários de "Variation table shows the content state" (imagem) e "Stored image hides the image confirmation".
- [ ] 2.3 Em `e2e/specs/admin-catalog.spec.ts`, abrir o conteúdo pela variação, recusar uma imagem de tamanho errado sem chamada de rede e salvar uma válida. Em `e2e/specs/admin-readonly.spec.ts`, a página sem controles. Verificar com `npx playwright test e2e/specs/admin-catalog.spec.ts e2e/specs/admin-readonly.spec.ts --workers=4`.

## 3. Fase 2 · Rótulo

- [ ] 3.1 Rodar `npm run contract:sync` para o `PUT /label`, com mock e fixtures de rótulo completo e incompleto (US sem aviso). Verificar com `npx vitest run src/test/apiContract.test.ts`.
- [ ] 3.2 Acrescentar a seção **Rótulo** a `RecipeContentPage.tsx` (decisões 3 e 4): campos, listas, linhas de análise, idioma do mercado, selo e faltantes da API, **Salvar rótulo** e o 409 no card. Verificar com `RecipeContentPage.test.tsx`: os cenários de "Label form edits every label field", o corpo enviado sem linhas vazias e readonly sem controles.
- [ ] 3.3 Em `ProductDetailPage.tsx`: selo do rótulo na coluna **Conteúdo** e a confirmação de rótulo só quando `recipeLabelStatus` não é `complete`. Verificar com `ProductDetailPage.test.tsx`: o cenário de rótulo de "Manual confirmations only for content kept in the store code".
- [ ] 3.4 Estender `e2e/specs/admin-catalog.spec.ts` com preencher e salvar um rótulo US, e `admin-readonly.spec.ts` com a seção sem controles. Verificar com `npx playwright test e2e/specs/admin-catalog.spec.ts e2e/specs/admin-readonly.spec.ts --workers=4`.

## 4. Integração

- [ ] 4.1 Em QA, com os três changes da fase entregues, cadastrar imagem e rótulo de um sabor US inativo pelo painel, ativar a variação sem as confirmações manuais e abrir `/recipes/<key>` no domínio US. Verificar que o banner e o rótulo são os cadastrados.
