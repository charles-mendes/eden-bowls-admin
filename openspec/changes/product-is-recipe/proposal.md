# Proposal

## Why

The backend change `product-is-recipe` makes each product one recipe of one market: the content (life stage, presentation, images, label) belongs to the product, variations only carry the pack fields, and the `/api/v1/admin/catalog/recipe-content*` routes are replaced by `/api/v1/admin/catalog/products/:productId/content/*`. The panel spec still describes a separate Receitas menu and recipe page, a recipe select and "Criar receita" in the variation dialog, and a side panel whose content is shared across products — none of which exists after the backend change.

## What Changes

- One product page with tabs: **Dados gerais**, **Apresentação**, **Imagens**, **Rótulo**, **Variações**. The content sections move from the recipe page and side panel into these tabs.
- Product create asks name, market, code (suggested from the name) and life stage; code and market are read-only afterwards.
- The variation dialog edits only pack fields (SKU, name, weight, price, NCM, origin, confirmations); it shows the product's flavor as text and sends no recipe or flavor field.
- The product list shows code, life stage, variations, image and label state, with the **Sem imagem** and **Rótulo incompleto** filters that the Receitas list had.
- **Receitas** menu, `RecipesPage` and `RecipeContentPage` are removed; `/catalog/recipes*` links redirect to the product.
- Pending items "foto", "rótulo", "apresentação" open their tab; unsaved content asks before switching tab.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `operations/catalog-products`: publish body, general data save, presentation pending item; new requirements for create, locked identity, tabs, pending items, unsaved tabs, variation dialog, list state and old links; removal of the variation recipe and side panel requirements.
- `operations/catalog-recipe-content`: the presentation, error and anchor requirements move to the product page; the recipe list, recipe registration, recipe page, variation content link and variation recipe select are removed.

## Impact

- `src/pages/ProductDetailPage.tsx`, `src/pages/ProductsPage.tsx`, removal of `src/pages/RecipesPage.tsx` / `RecipeContentPage.tsx`, `src/App.tsx`, `src/lib/menu.ts`, `src/lib/recipeContent.ts` (paths), the `Recipe*Section` components, `src/pages/ReportsPage.tsx` links, fixtures, `mockAdminFetch.ts` and tests.
- `contracts/backend-routes.json` loses the recipe-content routes and gains the product content routes (`npm run contract:sync`).
- **Order**: apply and archive after this repo's `plan-settings-per-market`, which adds "Unsaved product fields are visible" that this change modifies.
- Paired with `eden-bowls-backend/openspec/changes/product-is-recipe` (`catalog-products`, `recipe-content`, `catalog-product-delete`); both are applied and archived together.
