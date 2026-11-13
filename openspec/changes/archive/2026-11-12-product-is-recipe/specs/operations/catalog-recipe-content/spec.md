## RENAMED Requirements

- FROM: `### Requirement: Recipe page edits the store presentation`
- TO: `### Requirement: Product page edits the store presentation`

## MODIFIED Requirements

### Requirement: Product page edits the store presentation

The **Apresentação** tab of the product page MUST show the stored presentation of the product in its market: short name (`tag`, 1 to 40 characters, the store tab and plan chip label), title, tagline, resume, highlights (one input each, 1 to 8) and the five colors (`color`, `accentColor`, `pillBg`, `pillText`, `pillBorder`). An operator with `catalog.write` MUST be able to save the whole presentation with `PUT /api/v1/admin/catalog/products/:productId/content/presentation`; without it the fields MUST be read-only and there MUST be no save button. When the API refuses with `recipe_presentation_invalid`, the page MUST mark each listed field as invalid, keep the typed values and name the fields in the message.

#### Scenario: Seeded presentation

- **WHEN** an operator opens the BR `beef` product and the API returns its presentation
- **THEN** the tab shows its short name, title, tagline, resume, one input per highlight and the five colors

#### Scenario: Save a presentation

- **WHEN** an operator edits the tagline and saves
- **THEN** the page sends the whole presentation to the presentation route of that product and shows a success message

#### Scenario: Invalid color refused

- **WHEN** the API answers 422 `recipe_presentation_invalid` with `colors.pillBg`
- **THEN** the pill background field is marked invalid, the typed values stay and the message names that field

#### Scenario: Recipe without presentation

- **WHEN** the product has no stored presentation
- **THEN** the tab starts empty and says the variations of the product cannot be activated until it is saved

### Requirement: Content errors appear on the content page

The panel MUST show the API refusals (`recipe_image_invalid`, `recipe_content_in_use`) in Portuguese inside the tab that triggered them, keep the stored content on screen and keep the form values the operator typed.

#### Scenario: Removing the image of an active recipe

- **WHEN** an operator confirms **Remover imagem** and the API answers 409 `recipe_content_in_use`
- **THEN** the **Imagens** tab says the image cannot be removed while a variation of this product is active, and the image stays on screen

### Requirement: Recipe content sections are addressable

The life stage, store presentation, home image, plan thumbnail and label sections MUST carry the stable anchors `fase`, `apresentacao`, `imagem`, `miniatura` and `rotulo` on the product page. Opening the product page with one of these anchors in the URL MUST open the tab that holds the section and scroll to it once the product loads.

#### Scenario: Link to the label

- **WHEN** an operator opens `/catalog/products/42#rotulo`
- **THEN** the page opens the **Rótulo** tab after the product loads

#### Scenario: Unknown anchor

- **WHEN** the URL carries `#outra-coisa`
- **THEN** the page opens on **Dados gerais** as without an anchor

## REMOVED Requirements

### Requirement: Recipes menu lists the recipes of a market

**Reason**: The product list is the recipe list.
**Migration**: "Product list shows the recipe state" in `operations/catalog-products`; the **Receitas** menu item is removed and `/catalog/recipes` redirects to Produtos.

### Requirement: Operator registers a recipe

**Reason**: A recipe is created as a product.
**Migration**: "Operator creates a recipe product" in `operations/catalog-products`.

### Requirement: Recipe page stands on its own

**Reason**: The content lives on the product page; old links redirect.
**Migration**: "Old recipe links open the product" in `operations/catalog-products`.

### Requirement: Variation opens its recipe content page

**Reason**: Variation and content are on the same page.
**Migration**: None.

### Requirement: Variation dialog sets the recipe key

**Reason**: A variation takes its product's recipe.
**Migration**: "Variation dialog saves one pack" in `operations/catalog-products`.
