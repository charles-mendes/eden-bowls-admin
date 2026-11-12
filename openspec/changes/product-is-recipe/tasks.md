# Tasks

## 1. Content components by product

- [ ] 1.1 Replace `recipeContentPath` with `productContentPath(productId, suffix)` in `src/lib/recipeContent.ts`; switch the five `Recipe*Section` components and `RecipeContentSections` to `productId`; verify with `RecipeContentSections.test.tsx` and the section tests.

## 2. Product create and list

- [ ] 2.1 Create dialog in `ProductsPage.tsx`: name, market, code (slug from name until edited), life stage, refusals in Portuguese, opens the detail; verify with `ProductsPage.test.tsx` (create, `product_code_taken`).
- [ ] 2.2 List columns code, life stage, variations, image, label and the **Sem imagem** / **Rótulo incompleto** filters; verify with `ProductsPage.test.tsx`.

## 3. Product page in tabs

- [ ] 3.1 Tabs **Dados gerais** (name, aliases, short label, life stage editable; code and market as text), **Apresentação**, **Imagens**, **Rótulo**, **Variações**; anchors open their tab; unsaved-content confirmation on tab switch; verify with `ProductDetailPage.test.tsx` and a Playwright screenshot of each tab.
- [ ] 3.2 Publish sends only `active` true; general data save sends name, aliases, short label, life stage; verify with `ProductDetailPage.test.tsx`.
- [ ] 3.3 Variation dialog with pack fields only, flavor/code/life stage as text, `variation_weight_taken` message; remove `recipeCandidate`, the sibling suggestion, inline recipe creation, the recipe select, the side panel and its focus trap; pending items open tabs; verify with `ProductDetailPage.test.tsx`.

## 4. Remove the recipe screens

- [ ] 4.1 Remove `RecipesPage`, `RecipeContentPage`, their tests and the **Receitas** menu item; add the `/catalog/recipes` and `/catalog/recipes/:market/:recipeKey` redirects; update `ReportsPage.tsx` links; verify with `menu.test.ts` and a redirect test.
- [ ] 4.2 Update `src/test/fixtures.ts` and `mockAdminFetch.ts` to the new routes; `npm run contract:sync` after the backend manifest is updated, commit `contracts/backend-routes.json`; verify the Vitest contract check and the touched page tests.

## 5. Integration check

- [ ] 5.1 With the backend change applied locally: create a product, fill every tab, add 300 g and 500 g, publish, and confirm it appears in the store plan; open an old `/catalog/recipes/BR/beef#rotulo` link; Playwright screenshots.
