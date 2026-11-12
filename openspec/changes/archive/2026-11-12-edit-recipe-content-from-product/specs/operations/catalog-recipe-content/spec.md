# Spec Delta

## ADDED Requirements

### Requirement: Recipe content sections are addressable

The life stage, store presentation, home image, plan thumbnail and label sections MUST carry the stable anchors `fase`, `apresentacao`, `imagem`, `miniatura` and `rotulo`, on the recipe page and in the product side panel. Opening the recipe page with one of these anchors in the URL MUST scroll to that section once the content loads.

#### Scenario: Link to the label

- **WHEN** an operator opens `/catalog/recipes/US/beef#rotulo`
- **THEN** the page scrolls to the label section after the recipe loads

#### Scenario: Unknown anchor

- **WHEN** the URL carries `#outra-coisa`
- **THEN** the page opens at the top as without an anchor

## MODIFIED Requirements

### Requirement: Variation opens its recipe content page

The variation table MUST show each variation's recipe key. For a saved variation that has one, the row MUST offer "Conteúdo", which opens the recipe content of the product's market in the product side panel; the panel MUST link to `/catalog/recipes/:market/:recipeKey`. A variation without a recipe key MUST say it has no linked recipe and MUST NOT offer content.

#### Scenario: Link to the recipe page

- **WHEN** a BR product detail loads a variation with the recipe key `turkey` and the operator clicks "Conteúdo"
- **THEN** the side panel opens with the BR recipe `turkey` and links to `/catalog/recipes/BR/turkey`

#### Scenario: Variation without a recipe

- **WHEN** a product detail loads a variation whose recipe key is null
- **THEN** its row says it has no linked recipe and has no content action
