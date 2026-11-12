# Design

## Context

- Content UI already exists as components: `RecipeLifeStageSection`, `RecipePresentationSection`, `RecipeImageSection`, `RecipePlanImageSection`, `RecipeLabelSection`, composed by `RecipeContentSections` and used by `RecipeContentPage` and the product side panel. They take `recipeKey` + `market` and build paths with `recipeContentPath` (`src/lib/recipeContent.ts`).
- `ProductDetailPage.tsx` (~1400 lines) carries the recipe select, `recipeCandidate`, the sibling suggestion in `updateDialogDraft`, inline recipe creation, the side panel with focus trap and dirty tracking, and per-variation content badges.

## Goals / Non-Goals

**Goals:** one page per recipe product; reuse the section components; remove the recipe-selection code.

**Non-Goals:** visual redesign of the sections; changing the label form fields.

## Decisions

- **Sections take `productId` instead of `recipeKey` + `market`.** `recipeContentPath` becomes `productContentPath(productId, suffix)`; the section props change, their behaviour does not.
- **Tabs with URL anchors.** Anchor → tab mapping: `fase` → Dados gerais, `apresentacao` → Apresentação, `imagem`/`miniatura` → Imagens, `rotulo` → Rótulo, `variacoes` → Variações. Reuse the dirty tracking of the side panel (`onDirtyChange`) for the tab-switch confirmation.
- **Old links redirect via `GET /api/v1/admin/catalog/products?market=&code=`.** A small `RecipeRedirect` route component; no recipe page kept.
- **Product list state** comes from the backend list fields (code, life stage, image, label status) added by the backend change; filters are client-side as the Receitas list did.

## Risks / Trade-offs

- [`ProductDetailPage` grows with tabs] → Extract `ProductGeneralTab` and `ProductVariationsTab`; the content tabs are the existing sections.
- [CSS global de `table` quebra componentes] → Playwright screenshot of every tab before delivery.
