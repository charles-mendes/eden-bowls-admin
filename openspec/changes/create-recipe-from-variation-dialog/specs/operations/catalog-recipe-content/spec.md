# Spec Delta

## MODIFIED Requirements

### Requirement: Variation dialog sets the recipe key

The variation dialog MUST have a **Receita (conteúdo)** select listing the recipes registered in the product's market as name and key, plus **Sem receita**. It MUST explain that variations with the same recipe share image and label, and it MUST offer to register a missing recipe inside the dialog instead of linking to **Receitas**. A new variation MUST start on the recipe whose key equals its suggested flavor slug when one is registered, otherwise on **Sem receita**. The saved value MUST be sent as `recipeKey`, **Sem receita** as `null`. A 422 `recipe_not_registered` MUST appear in the dialog.

#### Scenario: Unlinking a variation

- **WHEN** an operator picks **Sem receita** for the inactive variation SKU 3000 and saves
- **THEN** the PATCH sends `recipeKey` null and the row says it has no linked recipe

#### Scenario: Registered recipes only

- **WHEN** an operator opens the dialog in a BR product and BR has the recipes `beef` and `senior-beef`
- **THEN** the select offers "Sem receita", `beef` and `senior-beef` with their names, and no free text

#### Scenario: Recipe removed meanwhile

- **WHEN** the API refuses the save with 422 `recipe_not_registered`
- **THEN** the dialog says the recipe is no longer registered in the market and keeps the other fields

#### Scenario: No link that leaves the dialog

- **WHEN** an operator opens the dialog in a BR product
- **THEN** the field hint has no link to **Receitas**, so registering a recipe never discards the dialog
