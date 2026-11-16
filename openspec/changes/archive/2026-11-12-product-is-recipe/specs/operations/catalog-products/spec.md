## MODIFIED Requirements

### Requirement: Detail mutations wait until the product loads

On product detail, **Salvar**, **Publicar**, **Desativar**, **Sincronizar Stripe**, and **Excluir produto** MUST NOT be rendered until the product GET has resolved. A session without `catalog.write` MUST NOT see save, publish, deactivate, or delete. A session without `catalog.sync` MUST NOT see **Sincronizar Stripe**. After the product has loaded, a publish of that loaded draft MUST send `active` true and MUST NOT include `variants`, plan country, code or plan days. **Desativar** is the control that unpublishes a loaded published product (`PATCH` with `active` false). **Excluir produto** MUST appear only when the loaded product has `canDelete` true.

#### Scenario: Publish is absent while the product is loading

- **WHEN** a session with `catalog.write` and `catalog.sync` opens a product detail and the product GET has not resolved
- **THEN** **Publicar**, **Desativar**, **Salvar**, **Sincronizar Stripe**, and **Excluir produto** are not on the screen and no PATCH has been sent

#### Scenario: Readonly detail has no mutations

- **WHEN** a session with only `catalog.read` opens a loaded product detail
- **THEN** save, publish, deactivate, sync, and delete controls are absent

#### Scenario: Publish uses the loaded product

- **WHEN** a session with `catalog.write` publishes a loaded draft
- **THEN** the PATCH body is `active` true
- **AND** the PATCH body does not include `variants`, `planCountry` or `planDays`

#### Scenario: Published linked product deactivates instead of deleting

- **WHEN** a session with `catalog.write` opens a loaded published product whose `canDelete` is false
- **THEN** the screen shows **Desativar** and does not show **Excluir produto**
- **AND** confirming **Desativar** asks to take the product off the store while keeping the record and current billing, then sends `PATCH` with `active` false

### Requirement: Unsaved product fields are visible

**Salvar** in the "Dados gerais" tab MUST send name, aliases, short label and life stage, and MUST NOT send `variants`, plan country or code. It MUST stay available while the product is published, since these fields apply to every variation. When a field on screen differs from the loaded product, the page MUST say so and that it must be saved before leaving, and closing the browser tab MUST warn. Saving the product or reloading it MUST clear that warning, except the reload after a save in another tab, which MUST keep the typed fields and their warning.

#### Scenario: Product save omits variations

- **WHEN** a session with `catalog.write` renames a loaded product and saves
- **THEN** the PATCH body includes the name and does not include `variants`, `planCountry` or the code

#### Scenario: Changed field warns before leaving

- **WHEN** a session with `catalog.write` changes the short label of a loaded product and has not saved
- **THEN** the page says the general data is changed and must be saved before leaving

### Requirement: Missing presentation blocks activation in the product page

An inactive variation of a product without a stored presentation MUST list "apresentação" among its pending items, and a refused activation with `presentation` in `missing` MUST name the missing store presentation and offer to open the "Apresentação" tab.

#### Scenario: Activation refused without presentation

- **WHEN** the API refuses an activation with `missing: ['presentation']`
- **THEN** the page says the recipe's store presentation is missing

## ADDED Requirements

### Requirement: Operator creates a recipe product

A session with `catalog.write` MUST create a product with **Nome**, **Mercado**, **Código** and **Fase de vida**. The code MUST be filled from the name as a lowercase slug until the operator edits it, and the dialog MUST say code and market cannot change later. API refusals (`product_code_taken`, `recipe_key_invalid`) MUST appear in Portuguese inside the dialog, keeping what was typed. After creating, the panel MUST open the new product's detail.

#### Scenario: Create Receita de Cordeiro

- **WHEN** a writer types "Receita de Cordeiro" for BR with stage Adulto and saves
- **THEN** the panel sends name, `planCountry` BR, code `receita-de-cordeiro` and `lifeStage` adult, and opens the product detail

#### Scenario: Code taken

- **WHEN** the API answers 409 `product_code_taken`
- **THEN** the dialog says the market already has a product with that code and keeps the typed values

### Requirement: Code and market are read-only after creation

The product detail MUST show the code and the market as text, never as inputs, for every session.

#### Scenario: Writer opens a draft

- **WHEN** a writer opens a loaded draft product
- **THEN** code and market are shown as text and no request can change them

### Requirement: Product page groups the recipe in tabs

The product detail MUST have the tabs **Dados gerais** (name, code, market, status, aliases, short label, life stage), **Apresentação**, **Imagens** (home image and plan thumbnail), **Rótulo** and **Variações**. Each content tab MUST behave as the content sections of `operations/catalog-recipe-content` and save to the product's content routes. Changing the life stage MUST say it applies to every variation of the product.

#### Scenario: Open the label tab

- **WHEN** a writer opens **Rótulo** on the BR `beef` product
- **THEN** the tab shows the BR label of the product with its status and missing items

#### Scenario: Readonly tabs

- **WHEN** a `readonly` user opens any tab
- **THEN** the content is shown without save, upload or remove controls

### Requirement: Pending recipe items open their tab

For an inactive variation, the pending items "foto", "rótulo" and "apresentação" MUST be actions that open the **Imagens**, **Rótulo** and **Apresentação** tabs. The items "preço", "Stripe" and "NCM" MUST stay plain text.

#### Scenario: Missing presentation

- **WHEN** a writer clicks "apresentação" in the pending items of a variation
- **THEN** the **Apresentação** tab opens

#### Scenario: Missing price

- **WHEN** a variation lists "preço" as pending
- **THEN** "preço" is plain text and opens nothing

### Requirement: Leaving a content tab with unsaved changes asks first

Switching tabs or leaving the page MUST ask for confirmation when the presentation or label form holds unsaved changes, or a chosen home image or plan thumbnail was not saved. Declining MUST keep the tab and the typed values.

#### Scenario: Unsaved label

- **WHEN** a writer types an ingredient in **Rótulo** and clicks **Variações**
- **THEN** the page asks to discard the changes, and declining keeps **Rótulo** open with the ingredient

#### Scenario: Nothing changed

- **WHEN** a writer opens **Rótulo** and switches tab without editing
- **THEN** the tab changes without asking

### Requirement: Variation dialog saves one pack

**Editar** MUST open a dialog filled with that variation's SKU, name, weight, price, NCM, origin and readiness confirmations, and show the product's flavor, code and life stage as text. **Adicionar variação** MUST open the same dialog empty. Confirming MUST send `PATCH` with `variants` containing only that item (with its id when it exists) and MUST NOT send `recipeKey`, flavor, slug, aliases, life stage, short label or plan country. A new variation MUST be rejected in the dialog when both name and SKU are empty, without a request. A 422 `variation_weight_taken` MUST appear in the dialog. Cancel MUST close the dialog without a request. After a successful save the dialog MUST close and the table MUST show the saved variation.

#### Scenario: Edit sends one existing variation

- **WHEN** a session with `catalog.write` edits the price of a saved variation on a draft and confirms the dialog
- **THEN** the PATCH body is `variants` with that single variation, its id and the new price, and no flavor or recipe field

#### Scenario: Weight already on the product

- **WHEN** the API refuses a new 300 g variation with 422 `variation_weight_taken`
- **THEN** the dialog stays open with the typed fields and says the product already has a 300 g variation

#### Scenario: Cancel discards the dialog

- **WHEN** a session with `catalog.write` opens **Editar** and cancels
- **THEN** no PATCH is sent and the table still shows the variation as it was loaded

### Requirement: Product list shows the recipe state

The product list MUST show, for each product, its code, life stage, active and total variations, whether it has a home image and its label status. It MUST offer the quick filters **Sem imagem** and **Rótulo incompleto**, the latter also matching products without a label.

#### Scenario: Products of BR

- **WHEN** a readonly session opens Produtos with BR `beef` (2 of 2 variations active, with image) and `senior-lamb` (draft, no variations, no image)
- **THEN** the list shows both with their codes, "2/2" and "0/0" variations, and the image and label states

#### Scenario: Quick filter

- **WHEN** an operator turns on **Sem imagem**
- **THEN** only `senior-lamb` stays on the list

### Requirement: Old recipe links open the product

Opening `/catalog/recipes/:market/:recipeKey` MUST look up the product of that market and code and redirect to its detail, keeping a section anchor. Opening `/catalog/recipes` MUST redirect to Produtos. An unknown code MUST say the recipe no longer exists and link to Produtos.

#### Scenario: Bookmark of a recipe page

- **WHEN** an operator opens `/catalog/recipes/BR/beef#rotulo`
- **THEN** the panel opens the BR `beef` product on the **Rótulo** tab

## REMOVED Requirements

### Requirement: Variation dialog saves one variation

**Reason**: The dialog no longer edits flavor, slug, aliases or the recipe, and no recipe is created from it; replaced by "Variation dialog saves one pack".
**Migration**: None.

### Requirement: Variation dialog offers to create the missing recipe

**Reason**: A variation has no recipe of its own; it takes its product's.
**Migration**: Create the product of the recipe, then add the size to it.

### Requirement: Recipe created from the dialog is selected in the variation

**Reason**: Recipes are created as products.
**Migration**: "Operator creates a recipe product".

### Requirement: Recipe creation failures stay inside the dialog

**Reason**: No recipe creation in the variation dialog.
**Migration**: Refusals appear in the product create dialog.

### Requirement: Product page opens the recipe content in a side panel

**Reason**: The content is part of the product page, in tabs.
**Migration**: "Product page groups the recipe in tabs".

### Requirement: Recipe hints of the product page point to the side panel

**Reason**: No side panel; hints point to the tabs.
**Migration**: "Pending recipe items open their tab".

### Requirement: Side panel says the content is shared

**Reason**: Content is no longer shared across products; it belongs to one product.
**Migration**: None.

### Requirement: Product page reflects what the side panel saved

**Reason**: Content and variations are on the same page; each tab save reloads the product.
**Migration**: None.

### Requirement: Closing the panel with unsaved content asks first

**Reason**: No side panel.
**Migration**: "Leaving a content tab with unsaved changes asks first".

### Requirement: Recipe pending items open the missing section

**Reason**: Pending items open tabs instead of the side panel.
**Migration**: "Pending recipe items open their tab".
